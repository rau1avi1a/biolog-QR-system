// =============================================================================
// app/api/netsuite/route.js - Consolidated NetSuite operations (FIXED: Standardized Response Format)
// =============================================================================
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import db from '@/db';

export const dynamic = 'force-dynamic';

// Helper function to get user from JWT token
async function getUserFromRequest(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    await db.connect();
    const user = await db.models.User.findById(payload.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.hasNetSuiteAccess()) {
      throw new Error('NetSuite access not configured');
    }

    return user;

  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    await db.connect();

    switch (action) {
      case 'health': {
        const healthCheck = {
          timestamp: new Date().toISOString(),
          user: {
            id: user._id,
            email: user.email,
            hasNetSuiteAccess: user.hasNetSuiteAccess()
          },
          netsuite: {
            configured: true,
            connectionTest: null,
            error: null
          }
        };
        
        try {
          const auth = await db.netsuite.createNetSuiteAuth(user);
          const testResult = await auth.testConnection();
          
          healthCheck.netsuite.connectionTest = {
            success: testResult.success,
            message: testResult.message,
            testedAt: new Date().toISOString()
          };
        } catch (error) {
          healthCheck.netsuite.connectionTest = {
            success: false,
            message: error.message,
            testedAt: new Date().toISOString()
          };
        }
        
        return NextResponse.json({
          success: true,
          data: healthCheck,
          error: null
        });
      }

      case 'test': {
        const auth = await db.netsuite.createNetSuiteAuth(user);
        const testResult = await auth.testConnection();
        
        return NextResponse.json({
          success: true,
          data: {
            success: testResult.success,
            message: testResult.message,
            configured: true,
            timestamp: new Date().toISOString()
          },
          error: null
        });
      }

      case 'search': {
        const searchQuery = searchParams.get('q');
        if (!searchQuery || searchQuery.trim().length < 2) {
          return NextResponse.json({
            success: true,
            data: {
              items: [],
              message: 'Search query too short (minimum 2 characters)',
              query: searchQuery,
              count: 0
            },
            error: null
          });
        }

        const bomService = await db.netsuite.createBOMService(user);
        const assemblyItems = await bomService.searchAssemblyItems(searchQuery.trim());
        
        return NextResponse.json({
          success: true,
          data: {
            items: assemblyItems || [],
            query: searchQuery,
            count: assemblyItems?.length || 0
          },
          error: null
        });
      }

      case 'getBOM': {
        const assemblyItemId = searchParams.get('assemblyItemId');
        if (!assemblyItemId) {
          return NextResponse.json({
            success: false,
            data: null,
            error: 'Assembly Item ID is required for getBOM action'
          }, { status: 400 });
        }

        const bomService = await db.netsuite.createBOMService(user);
        const bomData = await bomService.getAssemblyBOM(assemblyItemId);
        
        return NextResponse.json({
          success: true,
          data: {
            bom: {
              bomId: bomData.bomId,
              bomName: bomData.bomName,
              revisionId: bomData.revisionId,
              revisionName: bomData.revisionName,
              effectiveStartDate: bomData.effectiveStartDate,
              effectiveEndDate: bomData.effectiveEndDate
            },
            recipe: bomData.recipe || bomData.normalizedComponents || [],
            components: bomData.components,
            mappedComponents: bomData.mappedComponents,
            assemblyItemId: assemblyItemId,
            debug: {
              rawComponentsCount: bomData.components?.length || 0,
              normalizedComponentsCount: bomData.normalizedComponents?.length || 0,
              recipeComponentsCount: bomData.recipe?.length || 0
            }
          },
          error: null
        });
      }

      case 'units': {
        const unitId = searchParams.get('id');
        const type = searchParams.get('type');
        
        // Import units from netsuite-units.js
        const { netsuiteUnits } = await import('@/db/lib/netsuite-units.js');
        
        if (unitId) {
          const unit = netsuiteUnits[unitId];
          if (!unit) {
            return NextResponse.json({
              success: false,
              data: null,
              error: `Unit ID ${unitId} not found`
            }, { status: 404 });
          }
          
          return NextResponse.json({
            success: true,
            data: { 
              unit: { id: unitId, ...unit }
            },
            error: null
          });
        }
        
        let units = Object.entries(netsuiteUnits).map(([id, unit]) => ({
          id,
          ...unit
        }));
        
        if (type) {
          units = units.filter(unit => unit.type === type);
        }
        
        return NextResponse.json({
          success: true,
          data: {
            units,
            count: units.length
          },
          error: null
        });
      }

      case 'workorder': {
        const workOrderId = searchParams.get('id');
        const status = searchParams.get('status');
        const assemblyItem = searchParams.get('assemblyItem');
        const limit = searchParams.get('limit');
        
        const workOrderService = await db.netsuite.createWorkOrderService(user);

        if (workOrderId) {
          const workOrder = await workOrderService.getWorkOrderStatus(workOrderId);
          return NextResponse.json({
            success: true,
            data: workOrder,
            error: null
          });
        } else {
          const filters = {};
          if (status) filters.status = status;
          if (assemblyItem) filters.assemblyItem = assemblyItem;
          if (limit) filters.limit = parseInt(limit);
          
          const workOrders = await workOrderService.listWorkOrders(filters);
          return NextResponse.json({
            success: true,
            data: {
              workOrders,
              count: workOrders.length,
              filters
            },
            error: null
          });
        }
      }

      case 'setup': {
        const hasAccess = user.hasNetSuiteAccess();
        const envConfigured = !!(
          process.env.NETSUITE_ACCOUNT_ID &&
          process.env.NETSUITE_CONSUMER_KEY &&
          process.env.NETSUITE_CONSUMER_SECRET &&
          process.env.NETSUITE_TOKEN_ID &&
          process.env.NETSUITE_TOKEN_SECRET
        );
        
        return NextResponse.json({
          success: true,
          data: {
            configured: hasAccess || envConfigured,
            userConfigured: hasAccess,
            envConfigured: envConfigured,
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role
            }
          },
          error: null
        });
      }

      case 'mapping': {
        const itemId = searchParams.get('itemId');
        const netsuiteId = searchParams.get('netsuiteId');
        
        if (itemId && netsuiteId) {
          // Get mapping for specific item
          const localItem = await db.services.itemService.getById(itemId);
          const netsuiteItem = await db.services.itemService.search({ netsuiteId });
          
          return NextResponse.json({
            success: true,
            data: {
              mapping: {
                localItem,
                netsuiteItem: netsuiteItem[0] || null,
                mapped: !!netsuiteItem[0]
              }
            },
            error: null
          });
        }
        
        // List all mapped items
        const mappedItems = await db.models.Item.find({ 
          netsuiteInternalId: { $exists: true, $ne: null } 
        })
        .select('_id displayName sku netsuiteInternalId itemType')
        .lean();
        
        return NextResponse.json({
          success: true,
          data: {
            mappedItems,
            count: mappedItems.length
          },
          error: null
        });
      }

      default:
        return NextResponse.json({
          success: false,
          data: null,
          error: 'Invalid action. Available actions: health, test, search, getBOM, units, workorder, setup, mapping'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('NetSuite GET API Error:', error);
    return NextResponse.json({ 
      success: false,
      data: null,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();

    await db.connect();

    switch (action) {
      case 'setup': {
        const { 
          accountId, 
          consumerKey, 
          consumerSecret, 
          tokenId, 
          tokenSecret,
          useEnvVars = false 
        } = body;

        if (useEnvVars) {
          user.setNetSuiteCredentials({
            accountId: process.env.NETSUITE_ACCOUNT_ID,
            consumerKey: process.env.NETSUITE_CONSUMER_KEY,
            consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
            tokenId: process.env.NETSUITE_TOKEN_ID,
            tokenSecret: process.env.NETSUITE_TOKEN_SECRET
          });
        } else {
          if (!accountId || !consumerKey || !consumerSecret || !tokenId || !tokenSecret) {
            return NextResponse.json({
              success: false,
              data: null,
              error: 'All NetSuite credentials are required'
            }, { status: 400 });
          }

          user.setNetSuiteCredentials({
            accountId,
            consumerKey,
            consumerSecret,
            tokenId,
            tokenSecret
          });
        }

        await user.save();

        // Test the connection
        try {
          const auth = await db.netsuite.createNetSuiteAuth(user);
          const testResult = await auth.testConnection();
          
          return NextResponse.json({
            success: true,
            data: {
              message: 'NetSuite credentials configured successfully',
              configured: user.hasNetSuiteAccess(),
              connectionTest: testResult
            },
            error: null
          });
        } catch (testError) {
          return NextResponse.json({
            success: true,
            data: {
              message: 'NetSuite credentials saved but connection test failed',
              configured: user.hasNetSuiteAccess(),
              connectionTest: { success: false, message: testError.message }
            },
            error: null
          });
        }
      }

      case 'workorder': {
        const { 
          batchId, 
          assemblyItemId, 
          quantity, 
          startDate, 
          endDate,
          location,
          subsidiary,
          department 
        } = body;

        if (!quantity || quantity <= 0) {
          return NextResponse.json({
            success: false,
            data: null,
            error: 'Quantity is required and must be greater than 0'
          }, { status: 400 });
        }

        const workOrderService = await db.netsuite.createWorkOrderService(user);
        let result;

        if (batchId) {
          const batch = await db.services.batchService.getBatchById(batchId);
          if (!batch) {
            return NextResponse.json({
              success: false,
              data: null,
              error: 'Batch not found'
            }, { status: 404 });
          }

          result = await workOrderService.createWorkOrderFromBatch(batch, quantity, {
            startDate,
            endDate,
            location,
            subsidiary,
            department
          });

          // Update batch with work order info
          await db.services.batchService.updateBatch(batchId, {
            workOrderId: result.workOrder.tranId || result.workOrder.id,
            workOrderCreated: true,
            workOrderCreatedAt: new Date(),
            workOrderStatus: 'created',
            netsuiteWorkOrderData: {
              workOrderId: result.workOrder.id,
              tranId: result.workOrder.tranId,
              bomId: result.workOrder.bomId,
              revisionId: result.workOrder.revisionId,
              quantity: quantity,
              status: result.workOrder.status,
              createdAt: new Date(),
              lastSyncAt: new Date()
            }
          });

        } else if (assemblyItemId) {
          result = await workOrderService.createWorkOrder({
            assemblyItemId,
            quantity,
            startDate,
            endDate,
            location,
            subsidiary,
            department
          });
        } else {
          return NextResponse.json({
            success: false,
            data: null,
            error: 'Either batchId or assemblyItemId is required'
          }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          data: result,
          error: null,
          message: 'Work order created successfully'
        });
      }

      case 'mapping': {
        const { components } = body;

        if (!components || !Array.isArray(components)) {
          return NextResponse.json({
            success: false,
            data: null,
            error: 'Components array is required'
          }, { status: 400 });
        }

        const mappingResults = await db.netsuite.mapNetSuiteComponents(components);

        const summary = {
          totalComponents: mappingResults.length,
          exactMatches: mappingResults.filter(r => r.bestMatch?.confidence === 1.0).length,
          highConfidenceMatches: mappingResults.filter(r => r.bestMatch?.confidence >= 0.8 && r.bestMatch?.confidence < 1.0).length,
          mediumConfidenceMatches: mappingResults.filter(r => r.bestMatch?.confidence >= 0.6 && r.bestMatch?.confidence < 0.8).length,
          componentsWithMatches: mappingResults.filter(r => r.bestMatch).length,
          unmappedComponents: mappingResults.filter(r => !r.bestMatch).length
        };

        return NextResponse.json({
          success: true,
          data: {
            mappingResults,
            summary
          },
          error: null,
          message: `Successfully mapped ${summary.componentsWithMatches}/${summary.totalComponents} components`
        });
      }

      case 'import': {
        const { bomData, fileId, overwriteExisting = false } = body;
        
        if (!bomData || !fileId) {
          return NextResponse.json({
            success: false,
            data: null,
            error: 'BOM data and file ID are required'
          }, { status: 400 });
        }

        // Map NetSuite components to local format
        const mappingResults = await db.netsuite.mapNetSuiteComponents(bomData.components || []);
        
        const components = mappingResults.map(result => {
          const comp = result.netsuiteComponent;
          const match = result.bestMatch;
          
          return {
            itemId: match?.chemical?._id || null,
            amount: comp.quantity || comp.bomQuantity || 0,
            unit: comp.units || 'ea',
            netsuiteData: {
              itemId: comp.itemId,
              itemRefName: comp.itemRefName || comp.ingredient,
              ingredient: comp.ingredient,
              bomQuantity: comp.bomQuantity || comp.quantity,
              componentYield: comp.componentYield || 100,
              units: comp.units,
              lineId: comp.lineId,
              bomComponentId: comp.bomComponentId,
              itemSource: comp.itemSource,
              type: 'netsuite'
            }
          };
        });

        // Update file with BOM data
        const updateData = {
          components,
          netsuiteImportData: {
            bomId: bomData.bomId,
            bomName: bomData.bomName,
            revisionId: bomData.revisionId,
            revisionName: bomData.revisionName,
            importedAt: new Date(),
            solutionNetsuiteId: bomData.assemblyItemId,
            lastSyncAt: new Date()
          }
        };

        const updatedFile = await db.services.fileService.updateFileMeta(fileId, updateData);
        
        return NextResponse.json({
          success: true,
          data: {
            file: updatedFile,
            mappingResults,
            summary: {
              totalComponents: components.length,
              mappedComponents: components.filter(c => c.itemId).length,
              unmappedComponents: components.filter(c => !c.itemId).length
            }
          },
          error: null,
          message: 'BOM imported successfully'
        });
      }

      case 'sync': {
        const { itemId, netsuiteItemId } = body;
        
        if (!itemId || !netsuiteItemId) {
          return NextResponse.json({
            success: false,
            data: null,
            error: 'Both itemId and netsuiteItemId are required'
          }, { status: 400 });
        }

        // Update local item with NetSuite ID
        const updatedItem = await db.services.itemService.update(itemId, {
          netsuiteInternalId: netsuiteItemId,
          netsuiteLastSync: new Date(),
          netsuiteSyncStatus: 'synced'
        });

        return NextResponse.json({
          success: true,
          data: updatedItem,
          error: null,
          message: 'Item synced with NetSuite successfully'
        });
      }

      default:
        return NextResponse.json({
          success: false,
          data: null,
          error: 'Invalid action. Available actions: setup, workorder, mapping, import, sync'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('NetSuite POST API Error:', error);
    return NextResponse.json({
      success: false,
      data: null,
      error: error.message
    }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const user = await getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();

    await db.connect();

    if (action === 'workorder') {
      const { workOrderId, action: woAction, quantityCompleted } = body;

      if (!workOrderId) {
        return NextResponse.json({
          success: false,
          data: null,
          error: 'Work order ID is required'
        }, { status: 400 });
      }

      const workOrderService = await db.netsuite.createWorkOrderService(user);
      let result;

      switch (woAction) {
        case 'complete':
          result = await workOrderService.completeWorkOrder(workOrderId, quantityCompleted);
          
          // Update associated batches
          await db.models.Batch.updateMany(
            { 'netsuiteWorkOrderData.workOrderId': workOrderId },
            { 
              'netsuiteWorkOrderData.status': 'built',
              'netsuiteWorkOrderData.completedAt': new Date(),
              workOrderStatus: 'completed'
            }
          );
          break;
          
        case 'cancel':
          result = await workOrderService.cancelWorkOrder(workOrderId);
          
          // Update associated batches
          await db.models.Batch.updateMany(
            { 'netsuiteWorkOrderData.workOrderId': workOrderId },
            { 
              'netsuiteWorkOrderData.status': 'cancelled',
              'netsuiteWorkOrderData.cancelledAt': new Date(),
              workOrderStatus: 'cancelled'
            }
          );
          break;

        case 'sync':
          result = await workOrderService.syncWorkOrderStatusWithBatch(workOrderId);
          break;
          
        default:
          return NextResponse.json({
            success: false,
            data: null,
            error: 'Invalid action. Supported actions: complete, cancel, sync'
          }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        data: result,
        error: null,
        message: `Work order ${woAction}${woAction.endsWith('e') ? 'd' : 'ed'} successfully`
      });
    }

    return NextResponse.json({
      success: false,
      data: null,
      error: 'Invalid action for PATCH'
    }, { status: 400 });

  } catch (error) {
    console.error('NetSuite PATCH API Error:', error);
    return NextResponse.json({
      success: false,
      data: null,
      error: error.message
    }, { status: 500 });
  }
}