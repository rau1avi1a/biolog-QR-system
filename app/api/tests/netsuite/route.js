// =============================================================================
// app/api/tests/netsuite/route.js - NetSuite Test Suite
// =============================================================================
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import db from '@/db';

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

    return user;
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const test = searchParams.get('test') || 'all';
  const verbose = searchParams.get('verbose') === 'true';

  const results = {
    timestamp: new Date().toISOString(),
    test,
    verbose,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    },
    tests: []
  };

  try {
    await db.connect();

    // Test helper function
    const runTest = async (name, testFn, category = 'netsuite') => {
      const test = {
        name,
        category,
        status: 'running',
        startTime: new Date().toISOString(),
        duration: 0,
        error: null,
        result: null
      };

      try {
        const startTime = Date.now();
        const result = await testFn();
        const duration = Date.now() - startTime;

        test.status = 'passed';
        test.duration = duration;
        test.result = result;
        results.summary.passed++;
      } catch (error) {
        test.status = 'failed';
        test.error = {
          message: error.message,
          stack: verbose ? error.stack : undefined
        };
        results.summary.failed++;
      }

      test.endTime = new Date().toISOString();
      results.tests.push(test);
      results.summary.total++;
    };

    // =============================================================================
    // ENVIRONMENT CONFIGURATION TESTS
    // =============================================================================
    if (test === 'all' || test === 'config') {
      await runTest('Environment Variables Check', async () => {
        const envConfig = {
          NETSUITE_ACCOUNT_ID: {
            exists: !!process.env.NETSUITE_ACCOUNT_ID,
            value: process.env.NETSUITE_ACCOUNT_ID ? 
              process.env.NETSUITE_ACCOUNT_ID.substring(0, 6) + '...' : null,
            length: process.env.NETSUITE_ACCOUNT_ID?.length || 0
          },
          NETSUITE_CONSUMER_KEY: {
            exists: !!process.env.NETSUITE_CONSUMER_KEY,
            length: process.env.NETSUITE_CONSUMER_KEY?.length || 0
          },
          NETSUITE_CONSUMER_SECRET: {
            exists: !!process.env.NETSUITE_CONSUMER_SECRET,
            length: process.env.NETSUITE_CONSUMER_SECRET?.length || 0
          },
          NETSUITE_TOKEN_ID: {
            exists: !!process.env.NETSUITE_TOKEN_ID,
            length: process.env.NETSUITE_TOKEN_ID?.length || 0
          },
          NETSUITE_TOKEN_SECRET: {
            exists: !!process.env.NETSUITE_TOKEN_SECRET,
            length: process.env.NETSUITE_TOKEN_SECRET?.length || 0
          }
        };

        const allConfigured = Object.values(envConfig).every(config => config.exists);
        
        return {
          allConfigured,
          envConfig,
          missingVars: Object.entries(envConfig)
            .filter(([key, config]) => !config.exists)
            .map(([key]) => key)
        };
      }, 'config');

      await runTest('User NetSuite Configuration', async () => {
        try {
          const user = await getUserFromRequest(request);
          
          const hasNetSuiteAccess = typeof user.hasNetSuiteAccess === 'function' ? 
            user.hasNetSuiteAccess() : false;
          
          const credentials = user.netsuiteCredentials || {};
          
          return {
            userFound: true,
            hasNetSuiteAccess,
            credentialsConfigured: credentials.isConfigured || false,
            credentialFields: {
              accountId: !!credentials.accountId,
              consumerKey: !!credentials.consumerKey,
              consumerSecret: !!credentials.consumerSecret,
              tokenId: !!credentials.tokenId,
              tokenSecret: !!credentials.tokenSecret
            }
          };
        } catch (error) {
          return {
            userFound: false,
            error: error.message,
            suggestion: 'User not authenticated or NetSuite access not configured'
          };
        }
      }, 'config');
    }

    // =============================================================================
// ENDPOINT PERMISSION TESTS
// =============================================================================
if (test === 'all' || test === 'endpoints') {
    await runTest('Test Various NetSuite Endpoints', async () => {
      const auth = await db.netsuite.createNetSuiteAuth(null);
      const endpointsToTest = [
        { name: 'Assembly Items', endpoint: '/assemblyItem?limit=1' },
        { name: 'Inventory Items', endpoint: '/inventoryItem?limit=1' },
        { name: 'Work Orders', endpoint: '/workOrder?limit=1' },
        { name: 'Items (Generic)', endpoint: '/item?limit=1' },
        { name: 'Locations', endpoint: '/location?limit=1' },
        { name: 'Subsidiaries', endpoint: '/subsidiary?limit=1' },
        { name: 'Units Type', endpoint: '/unitsType?limit=1' },
        { name: 'Currency', endpoint: '/currency?limit=1' }
      ];
      
      const results = {};
      
      for (const { name, endpoint } of endpointsToTest) {
        try {
          console.log(`Testing endpoint: ${name} (${endpoint})`);
          const response = await auth.makeRequest(endpoint);
          results[name] = {
            success: true,
            hasData: !!(response.items || response.length > 0),
            itemCount: response.items?.length || (Array.isArray(response) ? response.length : 0)
          };
          console.log(`✅ ${name}: Success`);
        } catch (error) {
          results[name] = {
            success: false,
            error: error.message,
            isPermissionError: error.message.includes('permission') || error.message.includes('USER_ERROR')
          };
          console.log(`❌ ${name}: ${error.message}`);
        }
      }
      
      const workingEndpoints = Object.entries(results)
        .filter(([name, result]) => result.success)
        .map(([name]) => name);
      
      const permissionErrors = Object.entries(results)
        .filter(([name, result]) => result.isPermissionError)
        .map(([name]) => name);
      
      return {
        endpointResults: results,
        workingEndpoints,
        permissionErrors,
        totalTested: endpointsToTest.length,
        successfulEndpoints: workingEndpoints.length,
        hasWorkingEndpoint: workingEndpoints.length > 0
      };
    }, 'endpoints');
  }
  
  // =============================================================================
  // SIMPLE CONNECTION TEST (using the most basic endpoint)
  // =============================================================================
  if (test === 'all' || test === 'simple') {
    await runTest('Simple NetSuite Connection (Currency)', async () => {
      try {
        const auth = await db.netsuite.createNetSuiteAuth(null);
        
        // Try the simplest endpoint - Currency (usually has minimal permission requirements)
        const response = await auth.makeRequest('/currency?limit=1');
        
        return {
          success: true,
          endpoint: '/currency',
          hasData: !!(response.items || response.length > 0),
          responseType: typeof response,
          sampleData: response
        };
      } catch (error) {
        return {
          success: false,
          endpoint: '/currency',
          error: error.message,
          isPermissionError: error.message.includes('permission') || error.message.includes('USER_ERROR')
        };
      }
    }, 'simple');
  }

  // Add these tests to your NetSuite test suite

// =============================================================================
// SPECIFIC RECORD ACCESS TESTS
// =============================================================================
if (test === 'all' || test === 'specific') {
    await runTest('Test Specific Record Access', async () => {
      const auth = await db.netsuite.createNetSuiteAuth(null);
      const testsToRun = [
        {
          name: 'Get specific assembly item',
          endpoint: '/assemblyItem/2787', // Your test ID
          method: 'GET'
        },
        {
          name: 'Search assembly items',
          endpoint: '/assemblyItem?q=itemid IS "GEN III A1 Solution"',
          method: 'GET'
        },
        {
          name: 'Get account info',
          endpoint: '/account', // Account info endpoint
          method: 'GET'
        },
        {
          name: 'List supported records',
          endpoint: '/', // Root endpoint to see what's available
          method: 'GET'
        }
      ];
      
      const results = {};
      
      for (const test of testsToRun) {
        try {
          console.log(`Testing: ${test.name} - ${test.endpoint}`);
          const response = await auth.makeRequest(test.endpoint, test.method);
          results[test.name] = {
            success: true,
            hasData: !!response,
            responseType: typeof response,
            sampleKeys: typeof response === 'object' ? Object.keys(response).slice(0, 5) : []
          };
          console.log(`✅ ${test.name}: Success`);
        } catch (error) {
          results[test.name] = {
            success: false,
            error: error.message,
            isPermissionError: error.message.includes('permission') || error.message.includes('USER_ERROR'),
            isNotFound: error.message.includes('404') || error.message.includes('Not Found')
          };
          console.log(`❌ ${test.name}: ${error.message}`);
        }
      }
      
      return {
        results,
        successfulTests: Object.values(results).filter(r => r.success).length,
        totalTests: testsToRun.length
      };
    }, 'specific');
  }
  
  // =============================================================================
  // ALTERNATIVE API APPROACHES
  // =============================================================================
  if (test === 'all' || test === 'alternative') {
    await runTest('Test Alternative NetSuite APIs', async () => {
      const auth = await db.netsuite.createNetSuiteAuth(null);
      const baseUrl = auth.baseUrl.replace('/record/v1', '');
      
      const alternativeTests = [
        {
          name: 'SuiteQL Query',
          url: `${baseUrl}/query/v1/suiteql`,
          method: 'POST',
          body: { q: "SELECT id FROM assemblyItem WHERE rownum <= 1" }
        },
        {
          name: 'Metadata API',
          url: `${baseUrl}/record/v1/metadata-catalog`,
          method: 'GET'
        },
        {
          name: 'OpenAPI Spec',
          url: `${baseUrl}/record/v1/openapi/3.0`,
          method: 'GET'
        }
      ];
      
      const results = {};
      
      for (const test of alternativeTests) {
        try {
          console.log(`Testing alternative API: ${test.name}`);
          
          // Use fetch directly for alternative APIs
          const requestData = { url: test.url, method: test.method };
          const oauthData = auth.oauth.authorize(requestData, auth.token);
          
          const authHeader = auth.oauth.toHeader(oauthData);
          authHeader.Authorization = authHeader.Authorization.replace(
            'OAuth ',
            `OAuth realm="${auth.credentials.accountId}", `
          );
          
          const options = {
            method: test.method,
            headers: {
              ...authHeader,
              'Content-Type': 'application/json'
            }
          };
          
          if (test.body) {
            options.body = JSON.stringify(test.body);
          }
          
          const response = await fetch(test.url, options);
          
          if (response.ok) {
            const data = await response.json();
            results[test.name] = {
              success: true,
              status: response.status,
              hasData: !!data,
              sampleKeys: typeof data === 'object' ? Object.keys(data).slice(0, 5) : []
            };
          } else {
            const errorText = await response.text();
            results[test.name] = {
              success: false,
              status: response.status,
              error: errorText
            };
          }
        } catch (error) {
          results[test.name] = {
            success: false,
            error: error.message
          };
        }
      }
      
      return {
        results,
        successfulTests: Object.values(results).filter(r => r.success).length,
        totalTests: alternativeTests.length
      };
    }, 'alternative');
  }
  
  // =============================================================================
  // PERMISSION DIAGNOSIS
  // =============================================================================
  if (test === 'all' || test === 'diagnosis') {
    await runTest('Permission Diagnosis', async () => {
      const auth = await db.netsuite.createNetSuiteAuth(null);
      
      // Test different permission scenarios
      const permissionTests = [
        {
          name: 'Basic Authentication Test',
          test: async () => {
            // Just make the OAuth signature without calling an endpoint
            const url = `${auth.baseUrl}/assemblyItem`;
            const requestData = { url, method: 'GET' };
            const oauthData = auth.oauth.authorize(requestData, auth.token);
            
            return {
              success: true,
              hasOAuthData: !!oauthData,
              hasSignature: !!oauthData.oauth_signature,
              accountId: auth.credentials.accountId,
              consumerKey: auth.credentials.consumerKey.substring(0, 8) + '...',
              tokenId: auth.credentials.tokenId.substring(0, 8) + '...'
            };
          }
        },
        {
          name: 'URL Format Test',
          test: async () => {
            const urlAccountId = auth.credentials.accountId.toLowerCase().replace('_', '-');
            const expectedUrl = `https://${urlAccountId}.suitetalk.api.netsuite.com/services/rest/record/v1`;
            
            return {
              success: true,
              originalAccountId: auth.credentials.accountId,
              urlAccountId,
              generatedBaseUrl: auth.baseUrl,
              expectedBaseUrl: expectedUrl,
              urlMatches: auth.baseUrl === expectedUrl
            };
          }
        },
        {
          name: 'Token Format Validation',
          test: async () => {
            const credentials = auth.credentials;
            
            return {
              success: true,
              validation: {
                accountIdFormat: /^\d+(_[A-Z0-9]+)?$/.test(credentials.accountId),
                consumerKeyLength: credentials.consumerKey.length,
                consumerSecretLength: credentials.consumerSecret.length,
                tokenIdLength: credentials.tokenId.length,
                tokenSecretLength: credentials.tokenSecret.length,
                allCredentialsPresent: !!(credentials.accountId && credentials.consumerKey && 
                                        credentials.consumerSecret && credentials.tokenId && 
                                        credentials.tokenSecret)
              }
            };
          }
        }
      ];
      
      const results = {};
      
      for (const permTest of permissionTests) {
        try {
          results[permTest.name] = await permTest.test();
        } catch (error) {
          results[permTest.name] = {
            success: false,
            error: error.message
          };
        }
      }
      
      return {
        diagnosisResults: results,
        overallDiagnosis: Object.values(results).every(r => r.success) ? 
          'Authentication setup appears correct - likely a NetSuite permission issue' :
          'Found issues with authentication setup'
      };
    }, 'diagnosis');
  }

    // =============================================================================
    // SERVICE CREATION TESTS
    // =============================================================================
    if (test === 'all' || test === 'services') {
      await runTest('NetSuite Service Factory Functions', async () => {
        const netsuiteExists = !!db.netsuite;
        const functions = {};
        
        if (netsuiteExists) {
          functions.createNetSuiteAuth = typeof db.netsuite.createNetSuiteAuth;
          functions.createBOMService = typeof db.netsuite.createBOMService;
          functions.createWorkOrderService = typeof db.netsuite.createWorkOrderService;
          functions.mapNetSuiteComponents = typeof db.netsuite.mapNetSuiteComponents;
        }
        
        return {
          netsuiteExists,
          functions,
          allFunctionsAvailable: Object.values(functions).every(f => f === 'function')
        };
      }, 'services');

      await runTest('Create NetSuite Auth Service', async () => {
        try {
          // Try with environment variables first
          const auth = await db.netsuite.createNetSuiteAuth(null);
          
          return {
            created: true,
            hasCredentials: !!auth.credentials,
            credentialFields: auth.credentials ? {
              accountId: !!auth.credentials.accountId,
              consumerKey: !!auth.credentials.consumerKey,
              consumerSecret: !!auth.credentials.consumerSecret,
              tokenId: !!auth.credentials.tokenId,
              tokenSecret: !!auth.credentials.tokenSecret
            } : null,
            baseUrl: auth.baseUrl
          };
        } catch (error) {
          return {
            created: false,
            error: error.message
          };
        }
      }, 'services');

      await runTest('Create NetSuite Auth Service with User', async () => {
        try {
          const user = await getUserFromRequest(request);
          const auth = await db.netsuite.createNetSuiteAuth(user);
          
          return {
            created: true,
            userAuth: true,
            hasCredentials: !!auth.credentials,
            baseUrl: auth.baseUrl
          };
        } catch (error) {
          return {
            created: false,
            userAuth: false,
            error: error.message,
            suggestion: 'Try configuring NetSuite credentials for the user'
          };
        }
      }, 'services');
    }

    // =============================================================================
    // CONNECTION TESTS
    // =============================================================================
    if (test === 'all' || test === 'connection') {
      await runTest('NetSuite API Connection Test', async () => {
        try {
          const auth = await db.netsuite.createNetSuiteAuth(null);
          const testResult = await auth.testConnection();
          
          return {
            connectionTest: testResult,
            success: testResult.success
          };
        } catch (error) {
          return {
            connectionTest: { success: false, message: error.message },
            success: false,
            error: error.message
          };
        }
      }, 'connection');

      await runTest('NetSuite API Raw Request Test', async () => {
        try {
          const auth = await db.netsuite.createNetSuiteAuth(null);
          
          // Try a simple API call - just list assembly items with limit 1
          const response = await auth.makeRequest('/assemblyItem?limit=1');
          
          return {
            success: true,
            responseType: typeof response,
            hasItems: !!response.items || Array.isArray(response),
            itemCount: response.items?.length || (Array.isArray(response) ? response.length : 0),
            sampleResponse: response
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            errorDetails: error.stack ? error.stack.split('\n').slice(0, 3) : null
          };
        }
      }, 'connection');
    }

    // =============================================================================
    // BOM SERVICE TESTS
    // =============================================================================
    if (test === 'all' || test === 'bom') {
      await runTest('Create BOM Service', async () => {
        try {
          const bomService = await db.netsuite.createBOMService(null);
          
          return {
            created: true,
            hasSearchMethod: typeof bomService.searchAssemblyItems === 'function',
            hasGetBOMMethod: typeof bomService.getAssemblyBOM === 'function',
            auth: !!bomService.auth
          };
        } catch (error) {
          return {
            created: false,
            error: error.message
          };
        }
      }, 'bom');

      await runTest('Search Assembly Items', async () => {
        try {
          const bomService = await db.netsuite.createBOMService(null);
          const results = await bomService.searchAssemblyItems('solution');
          
          return {
            success: true,
            resultCount: results?.length || 0,
            isArray: Array.isArray(results),
            sampleItem: results?.[0] ? {
              id: results[0].id,
              itemid: results[0].itemid,
              displayName: results[0].displayName
            } : null
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }, 'bom');

      await runTest('Get Assembly BOM (Test ID: 2787)', async () => {
        try {
          const bomService = await db.netsuite.createBOMService(null);
          const bomData = await bomService.getAssemblyBOM('2787');
          
          return {
            success: true,
            hasBomId: !!bomData.bomId,
            hasRevisionId: !!bomData.revisionId,
            componentCount: bomData.components?.length || 0,
            normalizedCount: bomData.normalizedComponents?.length || 0,
            recipeCount: bomData.recipe?.length || 0,
            sampleComponent: bomData.components?.[0] || null
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            suggestion: 'Assembly ID 2787 might not exist or be accessible'
          };
        }
      }, 'bom');
    }

    // =============================================================================
    // MAPPING TESTS
    // =============================================================================
    if (test === 'all' || test === 'mapping') {
      await runTest('Component Mapping Service', async () => {
        const sampleComponents = [
          {
            ingredient: 'Water',
            itemId: '123',
            quantity: 1000,
            units: '35' // Liters
          },
          {
            ingredient: 'Sodium Chloride',
            itemId: '456',
            quantity: 50,
            units: '33' // Grams
          }
        ];
        
        const mappingResults = await db.netsuite.mapNetSuiteComponents(sampleComponents);
        
        return {
          componentCount: sampleComponents.length,
          resultCount: mappingResults.length,
          mappingWorking: Array.isArray(mappingResults),
          results: mappingResults.map(result => ({
            ingredient: result.netsuiteComponent.ingredient,
            matchCount: result.matches?.length || 0,
            bestMatchConfidence: result.bestMatch?.confidence || 0,
            mapped: !!result.bestMatch
          }))
        };
      }, 'mapping');
    }

    // =============================================================================
    // COMPREHENSIVE TEST
    // =============================================================================
    if (test === 'comprehensive') {
      await runTest('Full NetSuite Workflow Test', async () => {
        // 1. Create services
        const auth = await db.netsuite.createNetSuiteAuth(null);
        const bomService = await db.netsuite.createBOMService(null);
        
        // 2. Test connection
        const connectionTest = await auth.testConnection();
        if (!connectionTest.success) {
          throw new Error(`Connection failed: ${connectionTest.message}`);
        }
        
        // 3. Search for assembly items
        const searchResults = await bomService.searchAssemblyItems('solution');
        if (!searchResults || searchResults.length === 0) {
          throw new Error('No assembly items found');
        }
        
        // 4. Get BOM for first item
        const firstItem = searchResults[0];
        const bomData = await bomService.getAssemblyBOM(firstItem.id || firstItem.itemid);
        
        // 5. Map components
        const mappingResults = await db.netsuite.mapNetSuiteComponents(bomData.components || []);
        
        return {
          workflow: 'complete',
          steps: {
            authCreated: true,
            bomServiceCreated: true,
            connectionTested: connectionTest.success,
            assemblyItemsFound: searchResults.length,
            bomRetrieved: !!bomData.bomId,
            componentsMapped: mappingResults.length
          },
          summary: {
            assemblyItemId: firstItem.id || firstItem.itemid,
            componentCount: bomData.components?.length || 0,
            mappedComponents: mappingResults.filter(r => r.bestMatch).length
          }
        };
      }, 'comprehensive');
    }

  } catch (error) {
    console.error('NetSuite test suite error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 });
  }

  // Calculate success rate
  const successRate = results.summary.total > 0 ? 
    Math.round((results.summary.passed / results.summary.total) * 100) : 0;

  return NextResponse.json({
    success: results.summary.failed === 0,
    successRate: `${successRate}%`,
    results,
    message: `${results.summary.passed}/${results.summary.total} tests passed`,
    suggestions: results.summary.failed > 0 ? [
      'Check NetSuite environment variables in .env.local',
      'Verify NetSuite tokens are still active',
      'Ensure user has NetSuite credentials configured',
      'Check NetSuite account ID format (should be like "1234567_SB1" for sandbox)'
    ] : []
  });
}