// app/api/tests/api-layer/route.js - Comprehensive API Layer Tests
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('test') || 'all'; // all, endpoints, responses, data-flow
  const verbose = searchParams.get('verbose') === 'true';
  const mockAuth = searchParams.get('mockAuth') === 'true';

  const results = {
    timestamp: new Date().toISOString(),
    testType,
    verbose,
    mockAuth,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    },
    tests: [],
    apiStructure: null,
    responseFormats: {},
    recommendations: []
  };

  // API endpoint definitions based on your codebase
  const apiEndpoints = {
    '/api/auth': {
      methods: ['GET', 'POST'],
      actions: {
        GET: ['me', 'users'],
        POST: ['login', 'logout', 'register']
      },
      description: 'Authentication and user management'
    },
    '/api/files': {
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      actions: {
        GET: ['download', 'batches', 'stats', 'with-pdf'],
        POST: ['batch-upload']
      },
      description: 'File management and upload'
    },
    '/api/folders': {
      methods: ['GET', 'POST', 'PATCH'],
      actions: {
        GET: ['tree', 'children'],
        POST: ['delete', 'move']
      },
      description: 'Folder hierarchy management'
    },
    '/api/batches': {
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      actions: {
        GET: ['workorder-status'],
        POST: ['workorder-retry']
      },
      description: 'Batch workflow management'
    },
    '/api/items': {
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      actions: {
        GET: ['lots', 'transactions', 'stats', 'with-lots', 'vendors'],
        POST: ['transactions', 'vendor'],
        DELETE: ['lot']
      },
      description: 'Inventory item management'
    },
    '/api/netsuite': {
      methods: ['GET', 'POST', 'PATCH'],
      actions: {
        GET: ['health', 'test', 'search', 'getBOM', 'units', 'workorder', 'setup', 'mapping'],
        POST: ['setup', 'workorder', 'mapping', 'import', 'sync'],
        PATCH: ['workorder']
      },
      description: 'NetSuite integration'
    },
    '/api/upload': {
      methods: ['GET', 'POST'],
      actions: {
        POST: ['product', 'solution']
      },
      description: 'File upload handling'
    }
  };

  try {
    console.log('🔍 Starting API layer tests...');

    // Test helper
    const runTest = async (name, category, testFn) => {
      const test = {
        name,
        category,
        status: 'running',
        startTime: new Date().toISOString(),
        duration: 0,
        error: null,
        result: null,
        warnings: []
      };

      try {
        const startTime = Date.now();
        const result = await testFn();
        const duration = Date.now() - startTime;

        test.status = result.warnings?.length > 0 ? 'warning' : 'passed';
        test.duration = duration;
        test.result = result;
        test.warnings = result.warnings || [];
        
        if (test.status === 'warning') {
          results.summary.warnings++;
        } else {
          results.summary.passed++;
        }
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

    // Helper to make API requests
    const makeRequest = async (endpoint, options = {}) => {
      const { method = 'GET', body, params, headers = {} } = options;
      
      const url = new URL(`${request.url.split('/api/')[0]}${endpoint}`);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const requestOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (body && method !== 'GET') {
        requestOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url.toString(), requestOptions);
      
      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      return {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        endpoint,
        method,
        params
      };
    };

    // === API STRUCTURE ANALYSIS ===
    results.apiStructure = {
      totalEndpoints: Object.keys(apiEndpoints).length,
      endpoints: apiEndpoints,
      methodDistribution: {},
      actionDistribution: {}
    };

    // Calculate method and action distributions
    Object.values(apiEndpoints).forEach(endpoint => {
      endpoint.methods.forEach(method => {
        results.apiStructure.methodDistribution[method] = 
          (results.apiStructure.methodDistribution[method] || 0) + 1;
      });
      
      if (endpoint.actions) {
        Object.values(endpoint.actions).flat().forEach(action => {
          results.apiStructure.actionDistribution[action] = 
            (results.apiStructure.actionDistribution[action] || 0) + 1;
        });
      }
    });

    // === ENDPOINT AVAILABILITY TESTS ===
    if (testType === 'all' || testType === 'endpoints') {
      
      await runTest('Endpoint Availability', 'endpoints', async () => {
        const endpointTests = {};
        const warnings = [];
        
        for (const [endpoint, config] of Object.entries(apiEndpoints)) {
          try {
            // Test GET endpoint (most common)
            const response = await makeRequest(endpoint, { method: 'GET' });
            
            endpointTests[endpoint] = {
              available: response.status !== 404,
              status: response.status,
              responseType: typeof response.data,
              hasErrorHandling: response.status >= 400 && !!response.data,
              supportsGET: config.methods.includes('GET'),
              testedMethod: 'GET'
            };
            
            if (response.status === 500) {
              warnings.push(`Endpoint ${endpoint} returned 500 error`);
            } else if (response.status === 404) {
              warnings.push(`Endpoint ${endpoint} not found`);
            }
            
          } catch (error) {
            endpointTests[endpoint] = {
              available: false,
              error: error.message
            };
            warnings.push(`Endpoint ${endpoint} failed: ${error.message}`);
          }
        }
        
        return {
          totalEndpoints: Object.keys(apiEndpoints).length,
          availableEndpoints: Object.values(endpointTests).filter(e => e.available).length,
          unavailableEndpoints: Object.values(endpointTests).filter(e => !e.available).length,
          endpointTests,
          warnings
        };
      });

      await runTest('Method Support', 'endpoints', async () => {
        const methodTests = {};
        const warnings = [];
        
        // Test different HTTP methods on each endpoint
        for (const [endpoint, config] of Object.entries(apiEndpoints)) {
          methodTests[endpoint] = {};
          
          for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
            try {
              const shouldSupport = config.methods.includes(method);
              const response = await makeRequest(endpoint, { method });
              
              methodTests[endpoint][method] = {
                shouldSupport,
                actualStatus: response.status,
                supported: response.status !== 405, // Method Not Allowed
                responseFormat: typeof response.data,
                hasData: !!response.data
              };
              
              // Check for mismatches
              if (shouldSupport && response.status === 405) {
                warnings.push(`${endpoint} should support ${method} but returns 405`);
              } else if (!shouldSupport && response.status !== 405) {
                warnings.push(`${endpoint} unexpectedly supports ${method}`);
              }
              
            } catch (error) {
              methodTests[endpoint][method] = {
                shouldSupport,
                supported: false,
                error: error.message
              };
              warnings.push(`${endpoint} ${method} failed: ${error.message}`);
            }
          }
        }
        
        return { methodTests, warnings };
      });

      await runTest('Action Parameter Support', 'endpoints', async () => {
        const actionTests = {};
        const warnings = [];
        
        // Test action parameters on GET endpoints
        const actionTestCases = [
          { endpoint: '/api/files', action: 'search', params: { search: 'test' } },
          { endpoint: '/api/batches', action: 'workorder-status', params: { id: '000000000000000000000000', action: 'workorder-status' } },
          { endpoint: '/api/items', action: 'lots', params: { id: '000000000000000000000000', action: 'lots' } },
          { endpoint: '/api/netsuite', action: 'health', params: { action: 'health' } },
          { endpoint: '/api/folders', action: 'tree', params: { id: '000000000000000000000000', action: 'tree' } }
        ];
        
        for (const testCase of actionTestCases) {
          try {
            const response = await makeRequest(testCase.endpoint, {
              method: 'GET',
              params: testCase.params
            });
            
            actionTests[`${testCase.endpoint}?action=${testCase.action}`] = {
              status: response.status,
              hasResponse: !!response.data,
              responseType: typeof response.data,
              isSuccessFormat: response.data?.success !== undefined,
              hasErrorMessage: !!response.data?.error,
              working: response.status < 500
            };
            
            if (response.status >= 500) {
              warnings.push(`Action ${testCase.action} on ${testCase.endpoint} returned server error`);
            }
            
          } catch (error) {
            actionTests[`${testCase.endpoint}?action=${testCase.action}`] = {
              working: false,
              error: error.message
            };
            warnings.push(`Action test failed: ${testCase.endpoint}?action=${testCase.action} - ${error.message}`);
          }
        }
        
        return { actionTests, warnings };
      });
    }

    // === RESPONSE FORMAT TESTS ===
    if (testType === 'all' || testType === 'responses') {
      
      await runTest('Response Format Consistency', 'responses', async () => {
        const formatTests = {};
        const warnings = [];
        
        // Test standard CRUD operations for format consistency
        const formatTestCases = [
          { endpoint: '/api/files', method: 'GET', expectedFormat: 'standardized' },
          { endpoint: '/api/batches', method: 'GET', expectedFormat: 'standardized' },
          { endpoint: '/api/items', method: 'GET', expectedFormat: 'standardized' },
          { endpoint: '/api/folders', method: 'GET', expectedFormat: 'standardized' },
          { endpoint: '/api/auth', method: 'GET', params: { action: 'me' }, expectedFormat: 'standardized' }
        ];
        
        for (const testCase of formatTestCases) {
          try {
            const response = await makeRequest(testCase.endpoint, {
              method: testCase.method,
              params: testCase.params
            });
            
            const data = response.data;
            const hasSuccessField = typeof data === 'object' && data !== null && 'success' in data;
            const hasDataField = typeof data === 'object' && data !== null && 'data' in data;
            const hasErrorField = typeof data === 'object' && data !== null && 'error' in data;
            
            formatTests[testCase.endpoint] = {
              status: response.status,
              hasStandardFormat: hasSuccessField && (hasDataField || hasErrorField),
              hasSuccessField,
              hasDataField,
              hasErrorField,
              responseType: typeof data,
              isObject: typeof data === 'object' && data !== null,
              sampleKeys: typeof data === 'object' && data !== null ? Object.keys(data) : [],
              formatScore: (hasSuccessField ? 1 : 0) + (hasDataField ? 1 : 0) + (hasErrorField ? 0.5 : 0)
            };
            
            // Store format for analysis
            if (!results.responseFormats[testCase.endpoint]) {
              results.responseFormats[testCase.endpoint] = {};
            }
            results.responseFormats[testCase.endpoint][testCase.method] = formatTests[testCase.endpoint];
            
            if (!hasStandardFormat && response.status < 400) {
              warnings.push(`${testCase.endpoint} doesn't follow standard { success, data, error } format`);
            }
            
          } catch (error) {
            formatTests[testCase.endpoint] = {
              working: false,
              error: error.message
            };
            warnings.push(`Format test failed: ${testCase.endpoint} - ${error.message}`);
          }
        }
        
        return { formatTests, warnings };
      });

      await runTest('Error Response Format', 'responses', async () => {
        const errorTests = {};
        const warnings = [];
        
        // Test error responses by making invalid requests
        const errorTestCases = [
          { endpoint: '/api/files', method: 'GET', params: { id: 'invalid-id' }, expectedStatus: 400 },
          { endpoint: '/api/batches', method: 'GET', params: { id: 'nonexistent' }, expectedStatus: 404 },
          { endpoint: '/api/items', method: 'POST', body: { invalid: 'data' }, expectedStatus: 400 },
          { endpoint: '/api/folders', method: 'DELETE', params: { id: 'invalid' }, expectedStatus: 400 }
        ];
        
        for (const testCase of errorTestCases) {
          try {
            const response = await makeRequest(testCase.endpoint, {
              method: testCase.method,
              params: testCase.params,
              body: testCase.body
            });
            
            const data = response.data;
            const isErrorResponse = response.status >= 400;
            const hasErrorMessage = typeof data === 'object' && data !== null && 
                                  (data.error || data.message);
            const hasSuccessField = typeof data === 'object' && data !== null && 'success' in data;
            const successIsFalse = hasSuccessField && data.success === false;
            
            errorTests[`${testCase.endpoint}_${testCase.method}`] = {
              actualStatus: response.status,
              expectedStatus: testCase.expectedStatus,
              isErrorResponse,
              hasErrorMessage,
              hasSuccessField,
              successIsFalse,
              errorFormat: hasSuccessField ? 'standardized' : 'legacy',
              errorContent: hasErrorMessage ? (data.error || data.message) : null
            };
            
            if (isErrorResponse && !hasErrorMessage) {
              warnings.push(`${testCase.endpoint} error response lacks error message`);
            }
            
            if (isErrorResponse && hasSuccessField && data.success !== false) {
              warnings.push(`${testCase.endpoint} error response has success=true`);
            }
            
          } catch (error) {
            errorTests[`${testCase.endpoint}_${testCase.method}`] = {
              testFailed: true,
              error: error.message
            };
            warnings.push(`Error test failed: ${testCase.endpoint} - ${error.message}`);
          }
        }
        
        return { errorTests, warnings };
      });

      await runTest('Data Structure Analysis', 'responses', async () => {
        const dataTests = {};
        const warnings = [];
        
        // Analyze the structure of successful responses
        const dataTestCases = [
          { endpoint: '/api/files', method: 'GET', description: 'File list' },
          { endpoint: '/api/batches', method: 'GET', description: 'Batch list' },
          { endpoint: '/api/items', method: 'GET', params: { type: 'chemical' }, description: 'Chemical list' },
          { endpoint: '/api/auth', method: 'GET', params: { action: 'me' }, description: 'Current user' }
        ];
        
        for (const testCase of dataTestCases) {
          try {
            const response = await makeRequest(testCase.endpoint, {
              method: testCase.method,
              params: testCase.params
            });
            
            if (response.status < 400) {
              const data = response.data;
              
              // Analyze data structure
              let actualData = data;
              if (data && typeof data === 'object' && 'data' in data) {
                actualData = data.data;
              }
              
              dataTests[testCase.endpoint] = {
                description: testCase.description,
                responseType: typeof data,
                dataType: typeof actualData,
                isArray: Array.isArray(actualData),
                isObject: typeof actualData === 'object' && actualData !== null,
                arrayLength: Array.isArray(actualData) ? actualData.length : null,
                objectKeys: typeof actualData === 'object' && actualData !== null && !Array.isArray(actualData) ? 
                           Object.keys(actualData) : [],
                hasMetadata: data && typeof data === 'object' && 
                           (data.count !== undefined || data.total !== undefined || data.pagination !== undefined),
                sampleStructure: this.analyzeSampleStructure(actualData)
              };
              
              if (Array.isArray(actualData) && actualData.length === 0) {
                warnings.push(`${testCase.endpoint} returned empty array - may indicate no data or query issues`);
              }
              
            } else {
              dataTests[testCase.endpoint] = {
                description: testCase.description,
                skipped: true,
                reason: `HTTP ${response.status} error`
              };
            }
            
          } catch (error) {
            dataTests[testCase.endpoint] = {
              description: testCase.description,
              failed: true,
              error: error.message
            };
            warnings.push(`Data structure test failed: ${testCase.endpoint} - ${error.message}`);
          }
        }
        
        return { dataTests, warnings };
      });
    }

    // === DATA FLOW TESTS ===
    if (testType === 'all' || testType === 'data-flow') {
      
      await runTest('API to DB Integration', 'data-flow', async () => {
        const integrationTests = {};
        const warnings = [];
        
        // Test that API endpoints actually connect to DB layer
        const integrationTestCases = [
          {
            name: 'Files API -> DB',
            test: async () => {
              const response = await makeRequest('/api/files', { method: 'GET' });
              return {
                apiWorking: response.status < 500,
                hasData: !!response.data,
                dataFormat: typeof response.data,
                seemsConnected: response.status < 500 && !!response.data
              };
            }
          },
          {
            name: 'Batches API -> DB',
            test: async () => {
              const response = await makeRequest('/api/batches', { method: 'GET' });
              return {
                apiWorking: response.status < 500,
                hasData: !!response.data,
                dataFormat: typeof response.data,
                seemsConnected: response.status < 500 && !!response.data
              };
            }
          },
          {
            name: 'Items API -> DB',
            test: async () => {
              const response = await makeRequest('/api/items', { method: 'GET' });
              return {
                apiWorking: response.status < 500,
                hasData: !!response.data,
                dataFormat: typeof response.data,
                seemsConnected: response.status < 500 && !!response.data
              };
            }
          }
        ];
        
        for (const testCase of integrationTestCases) {
          try {
            const result = await testCase.test();
            integrationTests[testCase.name] = result;
            
            if (!result.seemsConnected) {
              warnings.push(`${testCase.name} may not be properly connected to database`);
            }
            
          } catch (error) {
            integrationTests[testCase.name] = {
              failed: true,
              error: error.message
            };
            warnings.push(`Integration test failed: ${testCase.name} - ${error.message}`);
          }
        }
        
        return { integrationTests, warnings };
      });

      await runTest('Complete CRUD Flow', 'data-flow', async () => {
        const crudTests = {};
        const warnings = [];
        
        // Test complete CRUD operations on a safe endpoint
        try {
          // Test folder CRUD as it's safe and doesn't affect core data
          const testFolderName = `Test-${Date.now()}`;
          
          // CREATE
          const createResponse = await makeRequest('/api/folders', {
            method: 'POST',
            body: { name: testFolderName, parentId: null }
          });
          
          crudTests.create = {
            status: createResponse.status,
            success: createResponse.status < 400,
            hasData: !!createResponse.data,
            createdId: createResponse.data?.data?._id || createResponse.data?._id
          };
          
          if (crudTests.create.success && crudTests.create.createdId) {
            // READ
            const readResponse = await makeRequest('/api/folders', {
              method: 'GET',
              params: { id: crudTests.create.createdId }
            });
            
            crudTests.read = {
              status: readResponse.status,
              success: readResponse.status < 400,
              hasData: !!readResponse.data,
              dataMatches: readResponse.data?.data?.name === testFolderName || 
                          readResponse.data?.name === testFolderName
            };
            
            // UPDATE
            const updateResponse = await makeRequest('/api/folders', {
              method: 'PATCH',
              params: { id: crudTests.create.createdId },
              body: { name: `${testFolderName}-Updated` }
            });
            
            crudTests.update = {
              status: updateResponse.status,
              success: updateResponse.status < 400,
              hasData: !!updateResponse.data
            };
            
            // DELETE (cleanup)
            const deleteResponse = await makeRequest('/api/folders', {
              method: 'POST',
              params: { action: 'delete', id: crudTests.create.createdId }
            });
            
            crudTests.delete = {
              status: deleteResponse.status,
              success: deleteResponse.status < 400,
              hasData: !!deleteResponse.data
            };
            
          } else {
            warnings.push('CREATE operation failed, skipping rest of CRUD test');
            crudTests.read = { skipped: true };
            crudTests.update = { skipped: true };
            crudTests.delete = { skipped: true };
          }
          
        } catch (error) {
          crudTests.error = error.message;
          warnings.push(`CRUD test failed: ${error.message}`);
        }
        
        const completeCrudWorking = crudTests.create?.success && 
                                   crudTests.read?.success && 
                                   crudTests.update?.success && 
                                   crudTests.delete?.success;
        
        return { 
          crudTests, 
          completeCrudWorking,
          warnings 
        };
      });
    }

    // Helper method for analyzing sample structure
    const analyzeSampleStructure = (data) => {
      if (Array.isArray(data)) {
        return {
          type: 'array',
          length: data.length,
          sampleItem: data.length > 0 ? analyzeSampleStructure(data[0]) : null
        };
      } else if (typeof data === 'object' && data !== null) {
        const keys = Object.keys(data);
        return {
          type: 'object',
          keyCount: keys.length,
          keys: keys.slice(0, 10), // First 10 keys
          hasId: keys.includes('_id') || keys.includes('id'),
          hasTimestamps: keys.includes('createdAt') || keys.includes('updatedAt')
        };
      } else {
        return {
          type: typeof data,
          value: data
        };
      }
    };

    // === GENERATE RECOMMENDATIONS ===
    const failedTests = results.tests.filter(t => t.status === 'failed');
    const warningTests = results.tests.filter(t => t.status === 'warning');
    
    if (failedTests.length === 0 && warningTests.length === 0) {
      results.recommendations.push('✅ All API layer tests passed - your API endpoints are working correctly');
    } else {
      if (failedTests.length > 0) {
        results.recommendations.push(`❌ ${failedTests.length} critical API issues found`);
      }
      if (warningTests.length > 0) {
        results.recommendations.push(`⚠️ ${warningTests.length} API warnings found`);
      }
    }
    
    // Specific recommendations based on test results
    const endpointIssues = results.tests.filter(t => t.category === 'endpoints' && t.status === 'failed');
    if (endpointIssues.length > 0) {
      results.recommendations.push('🔧 Endpoint issues detected - check route definitions and imports');
    }
    
    const responseIssues = results.tests.filter(t => t.category === 'responses' && t.status === 'failed');
    if (responseIssues.length > 0) {
      results.recommendations.push('🔧 Response format issues detected - standardize response structure');
    }
    
    const dataFlowIssues = results.tests.filter(t => t.category === 'data-flow' && t.status === 'failed');
    if (dataFlowIssues.length > 0) {
      results.recommendations.push('🔧 Data flow issues detected - API may not be properly connected to DB layer');
    }

    // Format consistency recommendations
    const formatScores = Object.values(results.responseFormats).flat();
    const avgFormatScore = formatScores.length > 0 ? 
      formatScores.reduce((sum, f) => sum + (f.formatScore || 0), 0) / formatScores.length : 0;
    
    if (avgFormatScore < 1.5) {
      results.recommendations.push('📋 Consider standardizing response format to { success, data, error } across all endpoints');
    }

    console.log(`✅ API layer testing completed: ${results.summary.passed}/${results.summary.total} passed`);

    return NextResponse.json({
      success: results.summary.failed === 0,
      results,
      message: `API Layer Test: ${results.summary.passed}/${results.summary.total} passed, ${results.summary.failed} failed, ${results.summary.warnings} warnings`
    });

  } catch (error) {
    console.error('💥 API layer test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 });
  }
}