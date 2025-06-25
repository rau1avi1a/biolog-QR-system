// app/api/netsuite/route.js - Consolidated NetSuite operations
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
            const testResult = await db.netsuite.testConnection(user);
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
          
          return NextResponse.json(healthCheck);
        }
  
        case 'test': {
          const testResult = await db.netsuite.testConnection(user);
          return NextResponse.json({
            success: testResult.success,
            message: testResult.message,
            configured: true
          });
        }
  
        case 'search': {
          const searchQuery = searchParams.get('q');
          if (!searchQuery || searchQuery.trim().length < 2) {
            return NextResponse.json({
              success: true,
              items: [],
              message: 'Search query too short'
            });
          }
  
          const assemblyItems = await db.netsuite.searchAssemblyItems(user, searchQuery.trim());
          
          return NextResponse.json({
            success: true,
            items: assemblyItems || [],
            query: searchQuery,
            count: assemblyItems?.length || 0
          });
        }
  
        case 'getBOM': {
          const assemblyItemId = searchParams.get('assemblyItemId');
          if (!assemblyItemId) {
            return NextResponse.json({
              success: false,
              message: 'Assembly Item ID is required for getBOM action'
            }, { status: 400 });
          }
  
          const bomData = await db.netsuite.getBOM(user, assemblyItemId);
          
          // FIXED - Return normalized recipe data instead of raw components
          return NextResponse.json({
            success: true,
            bom: {
              bomId: bomData.bomId,
              bomName: bomData.bomName,
              revisionId: bomData.revisionId,
              revisionName: bomData.revisionName,
              effectiveStartDate: bomData.effectiveStartDate,
              effectiveEndDate: bomData.effectiveEndDate
            },
            recipe: bomData.recipe || bomData.normalizedComponents || [], // Use normalized/formatted data
            components: bomData.components, // Raw NetSuite data for debugging
            mappedComponents: bomData.mappedComponents,
            assemblyItemId: assemblyItemId,
            debug: {
              rawComponentsCount: bomData.components?.length || 0,
              normalizedComponentsCount: bomData.normalizedComponents?.length || 0,
              recipeComponentsCount: bomData.recipe?.length || 0
            }
          });
        }
  
        case 'units': {
          const unitId = searchParams.get('id');
          const type = searchParams.get('type');
          
          if (unitId) {
            const unit = db.netsuite.units[unitId];
            if (!unit) {
              return NextResponse.json({
                success: false,
                error: `Unit ID ${unitId} not found`
              }, { status: 404 });
            }
            
            return NextResponse.json({
              success: true,
              unit: { id: unitId, ...unit }
            });
          }
          
          let units = Object.entries(db.netsuite.units).map(([id, unit]) => ({
            id,
            ...unit
          }));
          
          if (type) {
            units = units.filter(unit => unit.type === type);
          }
          
          return NextResponse.json({
            success: true,
            units
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
              data: workOrder
            });
          } else {
            const filters = {};
            if (status) filters.status = status;
            if (assemblyItem) filters.assemblyItem = assemblyItem;
            if (limit) filters.limit = parseInt(limit);
            
            const workOrders = await workOrderService.listWorkOrders(filters);
            return NextResponse.json({
              success: true,
              data: workOrders
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
            configured: hasAccess || envConfigured,
            userConfigured: hasAccess,
            envConfigured: envConfigured,
            user: {
              name: user.name,
              email: user.email,
              role: user.role
            }
          });
        }
  
        default:
          return NextResponse.json({
            success: false,
            message: 'Invalid action. Available actions: health, test, search, getBOM, units, workorder, setup'
          }, { status: 400 });
      }
  
    } catch (error) {
      console.error('NetSuite API Error:', error);
      return NextResponse.json({ 
        success: false,
        message: 'Authentication or configuration error',
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
              message: 'All NetSuite credentials are required'
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

        return NextResponse.json({
          success: true,
          message: 'NetSuite credentials configured successfully',
          configured: user.hasNetSuiteAccess()
        });
      }

      case 'workorder': {
        const { 
          batchId, 
          assemblyItemId, 
          quantity, 
          startDate, 
          endDate,
          location,
          subsidiary 
        } = body;

        if (!quantity || quantity <= 0) {
          return NextResponse.json({
            success: false,
            message: 'Quantity is required and must be greater than 0'
          }, { status: 400 });
        }

        const workOrderService = await db.netsuite.createWorkOrderService(user);
        let result;

        if (batchId) {
          await db.connect();
          const batch = await db.models.Batch.findById(batchId)
            .populate('fileId', 'fileName')
            .populate('snapshot.solutionRef', 'displayName sku netsuiteInternalId')
            .lean();
            
          if (!batch) {
            return NextResponse.json({
              success: false,
              message: 'Batch not found'
            }, { status: 404 });
          }

          result = await workOrderService.createWorkOrderFromBatch(batch, quantity, {
            startDate,
            endDate,
            location,
            subsidiary
          });

          await db.models.Batch.findByIdAndUpdate(batchId, {
            workOrderId: result.workOrder.tranId || result.workOrder.id,
            workOrderCreated: true,
            workOrderCreatedAt: new Date(),
            netsuiteWorkOrderData: {
              workOrderId: result.workOrder.id,
              tranId: result.workOrder.tranId,
              bomId: result.workOrder.bomId,
              revisionId: result.workOrder.revisionId,
              quantity: quantity,
              status: result.workOrder.status,
              createdAt: new Date()
            }
          });

        } else if (assemblyItemId) {
          result = await workOrderService.createWorkOrder({
            assemblyItemId,
            quantity,
            startDate,
            endDate,
            location,
            subsidiary
          });
        } else {
          return NextResponse.json({
            success: false,
            message: 'Either batchId or assemblyItemId is required'
          }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          message: 'Work order created successfully',
          data: result
        });
      }

      case 'mapping': {
        const { components } = body;

        if (!components || !Array.isArray(components)) {
          return NextResponse.json({
            success: false,
            message: 'Components array is required'
          }, { status: 400 });
        }

        const mappingResults = await db.netsuite.mapComponents(components);

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
          mappingResults,
          summary,
          message: `Successfully mapped ${summary.componentsWithMatches}/${summary.totalComponents} components`
        });
      }

      case 'import': {
        const { netsuiteComponents, createMissing = false } = body;
        
        if (!netsuiteComponents || !Array.isArray(netsuiteComponents)) {
          return NextResponse.json({
            success: false,
            message: 'NetSuite components array required'
          }, { status: 400 });
        }

        // Implementation for importing NetSuite items
        // You can implement this later if needed
        const results = [];
        
        return NextResponse.json({
          success: true,
          results,
          message: 'Import functionality not yet implemented'
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Available actions: setup, workorder, mapping, import'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('NetSuite POST API Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const user = await getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();

    if (action === 'workorder') {
      const { workOrderId, action: woAction, quantityCompleted } = body;

      if (!workOrderId) {
        return NextResponse.json({
          success: false,
          message: 'Work order ID is required'
        }, { status: 400 });
      }

      const workOrderService = await db.netsuite.createWorkOrderService(user);
      let result;

      switch (woAction) {
        case 'complete':
          result = await workOrderService.completeWorkOrder(workOrderId, quantityCompleted);
          
          await db.connect();
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
          
          await db.connect();
          await db.models.Batch.updateMany(
            { 'netsuiteWorkOrderData.workOrderId': workOrderId },
            { 
              'netsuiteWorkOrderData.status': 'cancelled',
              'netsuiteWorkOrderData.cancelledAt': new Date(),
              workOrderStatus: 'cancelled'
            }
          );
          break;
          
        default:
          return NextResponse.json({
            success: false,
            message: 'Invalid action. Supported actions: complete, cancel'
          }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: `Work order ${woAction}d successfully`,
        data: result
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid action for PATCH'
    }, { status: 400 });

  } catch (error) {
    console.error('NetSuite PATCH API Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}