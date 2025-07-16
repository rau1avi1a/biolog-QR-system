// =============================================================================
// app/api/netsuite/route.js - Consolidated NetSuite operations (FIXED: Standardized Response Format)
// =============================================================================
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


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

      const { default: db } = await import('@/db');
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

      const { default: db } = await import('@/db');
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

      
      case 'fullImport': {
        const { createImportService } = await import('@/db/services/netsuite/importItem.service.js');
        const importService = await createImportService(user);
        const result = await importService.performFullImport();
        
        return NextResponse.json({
          success: result.success,
          data: result.success ? result.results : null,
          error: result.success ? null : result.error,
          message: result.success ? 'Full import completed successfully' : 'Full import failed'
        });
      }

      case 'scanNewItems': {
        const { createImportService } = await import('@/db/services/netsuite/importItem.service.js');
        const importService = await createImportService(user);
        const result = await importService.scanNewItems();
        
        return NextResponse.json({
          success: result.success,
          data: result.success ? {
            newItems: result.newItems,
            totalScanned: result.totalScanned
          } : null,
          error: result.success ? null : result.error,
          message: result.success ? `Found ${result.newItems?.length || 0} new items` : 'Scan failed'
        });
      }

      case 'inventoryData': {
        const { createImportService } = await import('@/db/services/netsuite/importItem.service.js');
        const importService = await createImportService(user);
        
        const offset = parseInt(searchParams.get('offset') || '0');
        const limit = parseInt(searchParams.get('limit') || '1000');
        
        const query = importService.getInventoryQuery();
        const result = await importService.executeSuiteQL(query, offset, limit);
        
        return NextResponse.json({
          success: true,
          data: result,
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
          console.log('🔍 Creating work order for batch:', batchId);
          
          // Get the batch with full population
          const batch = await db.services.batchService.getBatchById(batchId);
          if (!batch) {
            return NextResponse.json({
              success: false,
              data: null,
              error: 'Batch not found'
            }, { status: 404 });
          }
      
          // DEBUG: Log the batch data
          console.log('📋 Batch debug info:', {
            id: batch._id,
            fileId: batch.fileId?._id,
            hasSnapshot: !!batch.snapshot,
            snapshotEnabled: batch.snapshot?.enabled,
            hasSolutionRef: !!batch.snapshot?.solutionRef,
            solutionRefType: typeof batch.snapshot?.solutionRef,
            solutionRefId: batch.snapshot?.solutionRef?._id || batch.snapshot?.solutionRef,
            solutionRefDisplayName: batch.snapshot?.solutionRef?.displayName,
            solutionRefNetsuiteId: batch.snapshot?.solutionRef?.netsuiteInternalId,
            hasComponents: batch.snapshot?.components?.length > 0,
            componentCount: batch.snapshot?.components?.length || 0
          });
      
          // Check if we have the required data
          if (!batch.snapshot) {
            return NextResponse.json({
              success: false,
              data: null,
              error: 'Batch snapshot not found - batch may not be properly configured'
            }, { status: 400 });
          }
      
          if (!batch.snapshot.solutionRef) {
            return NextResponse.json({
              success: false,
              data: null,
              error: 'Solution reference not found in batch snapshot - please configure the solution for this recipe'
            }, { status: 400 });
          }
      
          // Check if the solution has NetSuite ID
          const solutionRef = batch.snapshot.solutionRef;
          const netsuiteId = solutionRef?.netsuiteInternalId || solutionRef?.netsuiteId;
          
          if (!netsuiteId) {
            console.log('❌ Solution missing NetSuite ID:', {
              solutionId: solutionRef._id || solutionRef,
              displayName: solutionRef.displayName,
              sku: solutionRef.sku
            });
            
            return NextResponse.json({
              success: false,
              data: null,
              error: `Solution "${solutionRef.displayName || solutionRef.sku || 'Unknown'}" does not have a NetSuite Internal ID configured`
            }, { status: 400 });
          }
      
          console.log('✅ Solution validation passed:', {
            solutionId: solutionRef._id || solutionRef,
            displayName: solutionRef.displayName,
            netsuiteId: netsuiteId
          });
      
          try {
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
      
            console.log('✅ Work order created successfully:', result.workOrder.tranId);
      
          } catch (workOrderError) {
            console.error('❌ Work order creation failed:', workOrderError.message);
            
            // Update batch with error status
            await db.services.batchService.updateBatch(batchId, {
              workOrderStatus: 'failed',
              workOrderError: workOrderError.message,
              workOrderFailedAt: new Date()
            });
            
            return NextResponse.json({
              success: false,
              data: null,
              error: `Work order creation failed: ${workOrderError.message}`
            }, { status: 500 });
          }
      
        } else if (assemblyItemId) {
          // Direct work order creation (not from batch)
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

      case 'assemblybuild': {
        const assemblyBuildId = searchParams.get('id');
        const workOrderId = searchParams.get('workOrderId');
        
        if (assemblyBuildId) {
          // Get specific assembly build
          const { createAssemblyBuildService } = await import('@/db/services/netsuite/assemblyBuild.service.js');
          const assemblyBuildService = createAssemblyBuildService(user);
          const result = await assemblyBuildService.getAssemblyBuildStatus(assemblyBuildId);
          
          return NextResponse.json({
            success: result.success,
            data: result.success ? result.assemblyBuild : null,
            error: result.success ? null : result.error
          });
          
        } else if (workOrderId) {
          // Get assembly builds for a work order
          const { createAssemblyBuildService } = await import('@/db/services/netsuite/assemblyBuild.service.js');
          const assemblyBuildService = createAssemblyBuildService(user);
          const result = await assemblyBuildService.getAssemblyBuildsForWorkOrder(workOrderId);
          
          return NextResponse.json({
            success: result.success,
            data: {
              assemblyBuilds: result.assemblyBuilds,
              count: result.count
            },
            error: result.success ? null : result.error
          });
          
        } else {
          return NextResponse.json({
            success: false,
            data: null,
            error: 'Either assemblyBuildId or workOrderId is required'
          }, { status: 400 });
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

      const { default: db } = await import('@/db');
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

        case 'importSelected': {
        const { selectedItems } = body;
        
        if (!selectedItems || !Array.isArray(selectedItems)) {
          return NextResponse.json({
            success: false,
            data: null,
            error: 'selectedItems array is required'
          }, { status: 400 });
        }
        
        const { createImportService } = await import('@/db/services/netsuite/importItem.service.js');
        const importService = await createImportService(user);
        const result = await importService.importSelectedItems(selectedItems);
        
        return NextResponse.json({
          success: result.success,
          data: result.success ? result.results : null,
          error: result.success ? null : result.error,
          message: result.success ? 'Selected items imported successfully' : 'Import failed'
        });
      }

      case 'suiteql': {
        const { query, offset = 0, limit = 1000 } = body;
        
        if (!query) {
          return NextResponse.json({
            success: false,
            data: null,
            error: 'SuiteQL query is required'
          }, { status: 400 });
        }
        
        const { createImportService } = await import('@/db/services/netsuite/importItem.service.js');
        const importService = await createImportService(user);
        const result = await importService.executeSuiteQL(query, offset, limit);
        
        return NextResponse.json({
          success: true,
          data: result,
          error: null
        });
      }

case 'workorder': {
  const { batchId, quantity } = body;

  // Validate inputs
  if (!batchId) {
    return NextResponse.json({
      success: false,
      data: null,
      error: 'batchId is required'
    }, { status: 400 });
  }
  if (!quantity || quantity <= 0) {
    return NextResponse.json({
      success: false,
      data: null,
      error: 'quantity is required and must be greater than 0'
    }, { status: 400 });
  }

  try {
    // Enqueue the background job
    const result = await db.services.AsyncWorkOrderService.queueWorkOrderCreation(
      batchId,
      quantity,
      user._id
    );

    return NextResponse.json({
      success: true,
      data: result,
      error: null,
      message: 'Work order creation started in background'
    });

  } catch (err) {
    console.error('Failed to queue work order:', err);
    return NextResponse.json({
      success: false,
      data: null,
      error: `Could not enqueue work order: ${err.message}`
    }, { status: 500 });
  }
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

  console.log('🔧 NetSuite import action called with components:', bomData.components?.map(c => ({
    ingredient: c.ingredient,
    units: c.units,
    quantity: c.quantity
  })));

  if (!bomData || !fileId) {
    return NextResponse.json({
      success: false,
      data: null,
      error: 'BOM data and file ID are required'
    }, { status: 400 });
  }

  // FIXED: Find the solution item by NetSuite ID BEFORE processing components
  const solutionNetsuiteId = bomData.assemblyItemId;
  let solutionItem = null;

  if (solutionNetsuiteId) {
    console.log('🔍 Looking for solution with NetSuite ID:', solutionNetsuiteId);
    
    solutionItem = await db.models.Item.findOne({ 
      netsuiteInternalId: solutionNetsuiteId,
      itemType: 'solution' 
    });

    if (solutionItem) {
      console.log('✅ Found solution item:', {
        id: solutionItem._id,
        displayName: solutionItem.displayName,
        sku: solutionItem.sku,
        netsuiteId: solutionItem.netsuiteInternalId
      });
    } else {
      console.warn('⚠️ Solution with NetSuite ID not found in database:', solutionNetsuiteId);
      // You might want to create the solution item here, or return an error
      // For now, we'll continue without it but log the warning
    }
  }

  // Import the unit mapping function
  const { mapNetSuiteUnit } = await import('@/db/lib/netsuite-units.js');

  // Map NetSuite components to local format
  const mappingResults = await db.netsuite.mapNetSuiteComponents(bomData.components || []);
  const components = mappingResults.map(result => {
    const comp = result.netsuiteComponent;
    const match = result.bestMatch;
    
    // FIXED: Map the NetSuite unit ID to symbol
    const mappedUnit = mapNetSuiteUnit(comp.units);

    console.log('🔧 Unit mapping in backend:', {
      ingredient: comp.ingredient,
      originalUnit: comp.units,
      mappedUnit: mappedUnit
    });
    
    return {
      itemId: match?.chemical?._id || null,
      amount: comp.quantity || comp.bomQuantity || 0,
      unit: mappedUnit, // ← Now using mapped symbol (e.g., 'mL' instead of '35')
      netsuiteData: {
        itemId: comp.itemId,
        itemRefName: comp.itemRefName || comp.ingredient,
        ingredient: comp.ingredient,
        bomQuantity: comp.bomQuantity || comp.quantity,
        componentYield: comp.componentYield || 100,
        units: comp.units, // ← Keep original NetSuite ID for reference
        mappedUnit: mappedUnit, // ← Store mapped symbol
        lineId: comp.lineId,
        bomComponentId: comp.bomComponentId,
        itemSource: comp.itemSource,
        type: 'netsuite'
      }
    };
  });

  // FIXED: Include solutionRef in the update data
  const updateData = {
    recipeQty: 1,
    recipeUnit: 'mL',
    components,
    solutionRef: solutionItem?._id || null, // ← ADD THIS LINE - Set the solution reference
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

  console.log('📝 Update data being saved:', {
    fileId,
    hasSolutionRef: !!updateData.solutionRef,
    solutionRefId: updateData.solutionRef,
    solutionNetsuiteId: updateData.netsuiteImportData.solutionNetsuiteId,
    componentCount: updateData.components.length
  });

  const updatedFile = await db.services.fileService.updateFileMeta(fileId, updateData);

  return NextResponse.json({
    success: true,
    data: {
      file: updatedFile,
      mappingResults,
      summary: {
        totalComponents: components.length,
        mappedComponents: components.filter(c => c.itemId).length,
        unmappedComponents: components.filter(c => !c.itemId).length,
        solutionFound: !!solutionItem,
        solutionRef: solutionItem?._id
      }
    },
    error: null,
    message: `BOM imported successfully${solutionItem ? ' with solution reference' : ' (solution not found in database)'}`
  });
}


    case 'assemblybuild': {
      const { 
        batchId, 
        workOrderInternalId, 
        quantityCompleted,
        actualComponents,
        completionDate 
      } = body;
    
      if (!quantityCompleted || quantityCompleted <= 0) {
        return NextResponse.json({
          success: false,
          data: null,
          error: 'Quantity completed is required and must be greater than 0'
        }, { status: 400 });
      }
    
      const { createAssemblyBuildService } = await import('@/db/services/netsuite/assemblyBuild.service.js');
      const assemblyBuildService = createAssemblyBuildService(user);
      let result;
    
      if (batchId) {
        // Complete work order for a specific batch
        const submissionData = {
          solutionQuantity: quantityCompleted,
          solutionUnit: body.solutionUnit || 'mL',
          confirmedComponents: actualComponents || [],
          solutionLotNumber: body.solutionLotNumber
        };
        
        result = await assemblyBuildService.completeWorkOrderForBatch(batchId, submissionData);
        
      } else if (workOrderInternalId) {
        // Direct assembly build creation
        result = await assemblyBuildService.createAssemblyBuild({
          workOrderInternalId,
          quantityCompleted,
          actualComponents,
          completionDate
        });
        
      } else {
        return NextResponse.json({
          success: false,
          data: null,
          error: 'Either batchId or workOrderInternalId is required'
        }, { status: 400 });
      }
    
      return NextResponse.json({
        success: result.success,
        data: result,
        error: result.success ? null : result.error,
        message: 'Assembly build created successfully'
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

      const { default: db } = await import('@/db');
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