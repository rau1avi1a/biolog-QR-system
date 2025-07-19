// app/api/netsuite/route.js - Complete NetSuite operations with OAuth2 support
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { NetSuiteAuthenticationError } from '@/db/services/netsuite/auth.service.js';

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

    return user;

  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

// Enhanced error handling for OAuth2 authentication failures
function handleNetSuiteError(error, request) {
  if (error instanceof NetSuiteAuthenticationError) {
    console.log('🔐 NetSuite authentication required, sending auth response');
    
    return NextResponse.json({
      success: false,
      data: null,
      error: error.message,
      authRequired: true,
      needsOAuth2: true,
      redirectUrl: error.redirectUrl || '/api/netsuite?action=oauth2-login',
      context: error.context
    }, { status: 401 });
  }
  
  // Regular error handling
  console.error('NetSuite API Error:', error);
  return NextResponse.json({ 
    success: false,
    data: null,
    error: error.message,
    authRequired: false
  }, { status: 500 });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const { default: db } = await import('@/db');
    await db.connect();

    // Handle OAuth2 authentication actions (no user auth required)
if (action === 'oauth2-login') {
  const { NetSuiteOAuth2 } = await import('@/db/services/netsuite/auth.service.js');
  
  try {
    // Build proper redirect URI
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const redirectUri = `${protocol}://${host}/api/netsuite?action=oauth2-callback`;
    
    // ✅ FIX: Don't override the state - let NetSuiteOAuth2.getAuthorizationUrl handle it
    // REMOVE THIS LINE: const state = Math.random().toString(36).substring(7);
    const authUrl = NetSuiteOAuth2.getAuthorizationUrl(redirectUri); // Remove the state parameter
    
    console.log('🔗 Redirecting user to NetSuite OAuth2 login');
    return NextResponse.redirect(authUrl);
  } catch (configError) {
    console.error('❌ OAuth2 configuration error:', configError);
    
    const errorUrl = new URL('/home', request.nextUrl.origin);
    errorUrl.searchParams.set('error', 'oauth_config_error');
    errorUrl.searchParams.set('details', configError.message);
    return NextResponse.redirect(errorUrl.toString());
  }
}

    if (action === 'oauth2-callback') {
      const { NetSuiteOAuth2 } = await import('@/db/services/netsuite/auth.service.js');
      
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const state = searchParams.get('state');
      const role = searchParams.get('role');
      const entity = searchParams.get('entity');
      const company = searchParams.get('company');
      
      console.log('🔄 OAuth2 callback received:', {
        hasCode: !!code,
        hasError: !!error,
        error: error,
        state: state,
        role: role,
        entity: entity,
        company: company,
        allParams: Object.fromEntries(searchParams.entries())
      });
      
      if (error) {
        console.error('❌ OAuth2 callback error:', error);
        // ✅ FIX: Redirect to correct home route
        const redirectUrl = new URL('/home', request.nextUrl.origin);
        redirectUrl.searchParams.set('error', 'oauth_denied');
        redirectUrl.searchParams.set('details', error);
        return NextResponse.redirect(redirectUrl.toString());
      }
      
      if (!code) {
        console.error('❌ No authorization code received');
        const redirectUrl = new URL('/home', request.nextUrl.origin);
        redirectUrl.searchParams.set('error', 'no_code');
        return NextResponse.redirect(redirectUrl.toString());
      }
      
      try {
        const user = await getUserFromRequest(request);
        
        // ✅ FIX: Use same redirect URI as in login
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const redirectUri = `${protocol}://${host}/api/netsuite?action=oauth2-callback`;
        
        console.log('🔄 Attempting token exchange with redirect URI:', redirectUri);
        
        const tokenData = await NetSuiteOAuth2.exchangeCodeForToken(code, redirectUri);
        
        user.setNetSuiteOAuth2Credentials(tokenData);
        await user.save();
        
        console.log('✅ OAuth2 credentials saved for user:', user._id);
        
        // ✅ FIX: Redirect to correct route with success message
        const successUrl = new URL('/home', request.nextUrl.origin);
        successUrl.searchParams.set('success', 'netsuite_connected');
        return NextResponse.redirect(successUrl.toString());
        
      } catch (authError) {
        console.error('💥 OAuth2 callback error:', authError);
        const errorUrl = new URL('/home', request.nextUrl.origin);
        errorUrl.searchParams.set('error', 'oauth_failed');
        errorUrl.searchParams.set('details', authError.message);
        return NextResponse.redirect(errorUrl.toString());
      }
    }

    if (action === 'oauth2-status') {
      try {
        const user = await getUserFromRequest(request);
        
        const isConnected = user.hasNetSuiteAccess();
        const isExpired = user.isNetSuiteTokenExpired();
        
        return NextResponse.json({
          success: true,
          data: {
            connected: isConnected,
            expired: isExpired,
            needsReauth: isConnected && isExpired && !user.netsuiteCredentials?.refreshToken,
            authType: user.netsuiteCredentials?.authType || 'none',
            lastRefresh: user.netsuiteCredentials?.lastTokenRefresh
          },
          error: null
        });
      } catch (authError) {
        return NextResponse.json({
          success: false,
          data: {
            connected: false,
            expired: true,
            needsReauth: true,
            authType: 'none'
          },
          error: authError.message
        });
      }
    }

    // For all other actions, require user authentication
    const user = await getUserFromRequest(request);

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
          if (error instanceof NetSuiteAuthenticationError) {
            healthCheck.netsuite.connectionTest = {
              success: false,
              message: 'NetSuite authentication required',
              needsAuth: true,
              testedAt: new Date().toISOString()
            };
          } else {
            healthCheck.netsuite.connectionTest = {
              success: false,
              message: error.message,
              testedAt: new Date().toISOString()
            };
          }
        }
        
        return NextResponse.json({
          success: true,
          data: healthCheck,
          error: null
        });
      }

      case 'test': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'search': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'fullImport': {
        try {
          const { createImportService } = await import('@/db/services/netsuite/importItem.service.js');
          const importService = await createImportService(user);
          const result = await importService.performFullImport();
          
          return NextResponse.json({
            success: result.success,
            data: result.success ? result.results : null,
            error: result.success ? null : result.error,
            message: result.success ? 'Full import completed successfully' : 'Full import failed'
          });
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'scanNewItems': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'inventoryData': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'getBOM': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'units': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'assemblybuild': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }
      
      case 'setup': {
        const hasAccess = user.hasNetSuiteAccess();
        const envConfigured = !!(
          process.env.NETSUITE_ACCOUNT_ID &&
          process.env.NETSUITE_CLIENT_ID &&
          process.env.NETSUITE_CLIENT_SECRET
        );
        
        return NextResponse.json({
          success: true,
          data: {
            configured: hasAccess || envConfigured,
            userConfigured: hasAccess,
            envConfigured: envConfigured,
            authType: 'oauth2',
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
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      default:
        return NextResponse.json({
          success: false,
          data: null,
          error: 'Invalid action. Available actions: health, test, search, getBOM, units, workorder, setup, mapping'
        }, { status: 400 });
    }

  } catch (error) {
    return handleNetSuiteError(error, request);
  }
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();

    const { default: db } = await import('@/db');
    await db.connect();

    // Handle OAuth2 disconnect
    if (action === 'oauth2-disconnect') {
      try {
        const user = await getUserFromRequest(request);
        
        user.clearNetSuiteCredentials();
        await user.save();
        
        console.log('🔓 NetSuite credentials cleared for user:', user._id);
        
        return NextResponse.json({
          success: true,
          data: { message: 'NetSuite account disconnected' },
          error: null
        });
      } catch (authError) {
        return NextResponse.json({
          success: false,
          data: null,
          error: authError.message
        }, { status: 401 });
      }
    }

    // For all other actions, require user authentication
    const user = await getUserFromRequest(request);

    switch (action) {
      case 'setup': {
        // OAuth2 doesn't need manual setup like OAuth1 did
        return NextResponse.json({
          success: true,
          data: {
            message: 'OAuth2 setup not required - use OAuth2 login flow instead',
            authType: 'oauth2',
            configured: user.hasNetSuiteAccess()
          },
          error: null
        });
      }

      case 'importSelected': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'suiteql': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'workorder': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'mapping': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'import': {
        try {
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

          // Find the solution item by NetSuite ID
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
            }
          }

          // Import the unit mapping function
          const { mapNetSuiteUnit } = await import('@/db/lib/netsuite-units.js');

          // Map NetSuite components to local format
          const mappingResults = await db.netsuite.mapNetSuiteComponents(bomData.components || []);
          const components = mappingResults.map(result => {
            const comp = result.netsuiteComponent;
            const match = result.bestMatch;
            
            const mappedUnit = mapNetSuiteUnit(comp.units);

            console.log('🔧 Unit mapping in backend:', {
              ingredient: comp.ingredient,
              originalUnit: comp.units,
              mappedUnit: mappedUnit
            });
            
            return {
              itemId: match?.chemical?._id || null,
              amount: comp.quantity || comp.bomQuantity || 0,
              unit: mappedUnit,
              netsuiteData: {
                itemId: comp.itemId,
                itemRefName: comp.itemRefName || comp.ingredient,
                ingredient: comp.ingredient,
                bomQuantity: comp.bomQuantity || comp.quantity,
                componentYield: comp.componentYield || 100,
                units: comp.units,
                mappedUnit: mappedUnit,
                lineId: comp.lineId,
                bomComponentId: comp.bomComponentId,
                itemSource: comp.itemSource,
                type: 'netsuite'
              }
            };
          });

          // Include solutionRef in the update data
          const updateData = {
            recipeQty: 1,
            recipeUnit: 'mL',
            components,
            solutionRef: solutionItem?._id || null,
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'assemblybuild': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      case 'sync': {
        try {
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
        } catch (error) {
          return handleNetSuiteError(error, request);
        }
      }

      default:
        return NextResponse.json({
          success: false,
          data: null,
          error: 'Invalid action. Available actions: setup, workorder, mapping, import, sync'
        }, { status: 400 });
    }

  } catch (error) {
    return handleNetSuiteError(error, request);
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
      try {
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
      } catch (error) {
        return handleNetSuiteError(error, request);
      }
    }

    return NextResponse.json({
      success: false,
      data: null,
      error: 'Invalid action for PATCH'
    }, { status: 400 });

  } catch (error) {
    return handleNetSuiteError(error, request);
  }
}