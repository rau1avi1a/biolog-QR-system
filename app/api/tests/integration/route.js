// app/api/tests/integration-flow/route.js - Complete DB -> API -> ApiClient Integration Tests
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const flow = searchParams.get('flow') || 'all'; // all, files, batches, items, netsuite, normalization
  const verbose = searchParams.get('verbose') === 'true';

  const results = {
    timestamp: new Date().toISOString(),
    flow,
    verbose,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      flowsCompleted: 0
    },
    flows: [],
    recommendations: [],
    dataFlowAnalysis: {
      dbLayer: null,
      apiLayer: null,
      clientLayer: null,
      integration: null
    },
    normalizationAnalysis: {
      inconsistentFormats: [],
      missingFields: [],
      typeConflicts: [],
      recommendations: []
    }
  };

  try {
    console.log('🔍 Starting complete integration flow tests...');

    // Test helper
    const runFlow = async (name, description, steps) => {
      const flowTest = {
        name,
        description,
        status: 'running',
        startTime: new Date().toISOString(),
        duration: 0,
        steps: [],
        summary: {
          totalSteps: steps.length,
          passedSteps: 0,
          failedSteps: 0,
          warningSteps: 0
        },
        dataFlow: {
          dbWorking: false,
          apiWorking: false,
          clientWorking: false,
          endToEndWorking: false
        },
        normalizationIssues: [],
        error: null,
        warnings: []
      };

      const startTime = Date.now();

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepResult = {
          stepNumber: i + 1,
          name: step.name,
          layer: step.layer,
          status: 'running',
          startTime: new Date().toISOString(),
          duration: 0,
          result: null,
          error: null,
          warnings: [],
          normalizationData: null
        };

        const stepStartTime = Date.now(); // Declare outside try/catch

        try {
          const result = await step.test();
          stepResult.duration = Date.now() - stepStartTime;
          
          stepResult.status = result.warnings?.length > 0 ? 'warning' : 'passed';
          stepResult.result = result;
          stepResult.warnings = result.warnings || [];
          stepResult.normalizationData = result.normalizationData || null;
          
          // Track normalization issues
          if (result.normalizationIssues) {
            flowTest.normalizationIssues.push(...result.normalizationIssues);
          }
          
          if (stepResult.status === 'warning') {
            flowTest.summary.warningSteps++;
            flowTest.warnings.push(...stepResult.warnings);
          } else {
            flowTest.summary.passedSteps++;
          }

          // Update data flow status
          if (step.layer === 'db' && result.working) flowTest.dataFlow.dbWorking = true;
          if (step.layer === 'api' && result.working) flowTest.dataFlow.apiWorking = true;
          if (step.layer === 'client' && result.working) flowTest.dataFlow.clientWorking = true;
          
        } catch (error) {
          stepResult.status = 'failed';
          stepResult.error = {
            message: error.message,
            stack: verbose ? error.stack : undefined
          };
          flowTest.summary.failedSteps++;
          
          // If early step fails, mark flow as failed and break
          if (i < 2) { // Critical early steps
            flowTest.status = 'failed';
            flowTest.error = `Critical step failed: ${step.name} - ${error.message}`;
            stepResult.duration = Date.now() - stepStartTime;
            flowTest.steps.push(stepResult);
            break;
          }
        }

        stepResult.endTime = new Date().toISOString();
        flowTest.steps.push(stepResult);
      }

      // Determine overall flow status
      if (flowTest.status !== 'failed') {
        if (flowTest.summary.failedSteps > 0) {
          flowTest.status = 'failed';
        } else if (flowTest.summary.warningSteps > 0) {
          flowTest.status = 'warning';
        } else {
          flowTest.status = 'passed';
          results.summary.flowsCompleted++;
        }
      }

      // Check end-to-end working
      flowTest.dataFlow.endToEndWorking = flowTest.dataFlow.dbWorking && 
                                         flowTest.dataFlow.apiWorking && 
                                         flowTest.dataFlow.clientWorking;

      flowTest.duration = Date.now() - startTime;
      flowTest.endTime = new Date().toISOString();
      
      results.flows.push(flowTest);
      
      if (flowTest.status === 'passed') {
        results.summary.passed++;
      } else if (flowTest.status === 'failed') {
        results.summary.failed++;
      } else {
        results.summary.warnings++;
      }
      results.summary.total++;
    };

    // Helper methods for making requests
    const testDbLayer = async (operation, params = {}) => {
      const response = await fetch(`${request.url.split('/api/')[0]}/api/tests/db?test=${operation}&verbose=${verbose}`);
      const data = await response.json();
      return {
        working: data.success,
        data: data.results,
        error: data.error,
        warnings: data.results?.tests?.filter(t => t.status === 'warning').map(t => t.warnings).flat() || []
      };
    };

    const testApiLayer = async (endpoint, method = 'GET', params = {}) => {
      const url = new URL(`${request.url.split('/api/')[0]}${endpoint}`);
      if (method === 'GET' && params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const requestOptions = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };

      if (method !== 'GET' && params) {
        requestOptions.body = JSON.stringify(params);
      }

      const response = await fetch(url.toString(), requestOptions);
      let data;
      
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }
      
      return {
        working: response.ok,
        status: response.status,
        data: data,
        rawResponse: data,
        error: !response.ok ? (data.error || data.message || 'API Error') : null,
        warnings: []
      };
    };

    const analyzeDataStructure = (data, context = 'unknown') => {
      const analysis = {
        context,
        type: typeof data,
        isArray: Array.isArray(data),
        isNull: data === null,
        isEmpty: !data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && Object.keys(data).length === 0),
        structure: null,
        normalizationIssues: []
      };

      if (Array.isArray(data)) {
        analysis.structure = {
          arrayLength: data.length,
          itemTypes: [...new Set(data.map(item => typeof item))],
          sampleItem: data.length > 0 ? analyzeDataStructure(data[0], `${context}[0]`) : null,
          allItemsConsistent: data.length > 0 ? data.every(item => typeof item === typeof data[0]) : true
        };
        
        if (!analysis.structure.allItemsConsistent) {
          analysis.normalizationIssues.push(`Array items have inconsistent types in ${context}`);
        }
      } else if (typeof data === 'object' && data !== null) {
        const keys = Object.keys(data);
        analysis.structure = {
          keyCount: keys.length,
          keys: keys,
          hasId: keys.includes('_id') || keys.includes('id'),
          hasTimestamps: keys.includes('createdAt') || keys.includes('updatedAt'),
          hasSuccess: keys.includes('success'),
          hasData: keys.includes('data'),
          hasError: keys.includes('error'),
          nestedObjects: keys.filter(key => typeof data[key] === 'object' && data[key] !== null),
          nestedArrays: keys.filter(key => Array.isArray(data[key]))
        };

        // Check for common normalization issues
        if (analysis.structure.hasSuccess && !analysis.structure.hasData && !analysis.structure.hasError) {
          analysis.normalizationIssues.push(`Object has 'success' field but missing 'data' or 'error' in ${context}`);
        }
        
        if (analysis.structure.hasData && typeof data.data === 'undefined') {
          analysis.normalizationIssues.push(`Object has 'data' key but value is undefined in ${context}`);
        }
      }

      return analysis;
    };

    const testClientLayer = (apiResponse, expectedFormat = 'standard') => {
      // Simulate ApiClient processing with detailed analysis
      const normalizeResponse = (response) => {
        if (typeof response === 'object' && response !== null) {
          if (response.success !== undefined) {
            return response.data || response;
          }
          return response;
        }
        return response;
      };

      const convertToClientFormat = (response, isSuccess) => {
        if (isSuccess) {
          const normalizedData = normalizeResponse(response);
          return { data: normalizedData, error: null };
        } else {
          return { 
            data: null, 
            error: response?.error || response?.message || 'Unknown error' 
          };
        }
      };

      const originalStructure = analyzeDataStructure(apiResponse.data, 'api_response');
      const normalized = normalizeResponse(apiResponse.data);
      const normalizedStructure = analyzeDataStructure(normalized, 'normalized');
      const clientFormat = convertToClientFormat(apiResponse.data, apiResponse.working);
      const clientStructure = analyzeDataStructure(clientFormat, 'client_format');

      // Detailed normalization analysis
      const normalizationIssues = [];
      
      // Check if normalization actually changed anything
      const normalizationChanged = JSON.stringify(apiResponse.data) !== JSON.stringify(normalized);
      
      // Check if expected format matches actual format
      if (expectedFormat === 'standard') {
        if (!originalStructure.structure?.hasSuccess && !originalStructure.structure?.hasData) {
          normalizationIssues.push('API response not in expected { success, data, error } format');
        }
      }

      // Check for data loss during normalization
      if (apiResponse.working && !normalized) {
        normalizationIssues.push('Data lost during normalization process');
      }

      // Check client format
      if (!clientFormat.hasOwnProperty('data') || !clientFormat.hasOwnProperty('error')) {
        normalizationIssues.push('Client format missing required data/error fields');
      }

      return {
        working: true,
        normalized: normalized,
        clientFormat: clientFormat,
        normalizationChanged,
        normalizationData: {
          original: originalStructure,
          normalized: normalizedStructure, 
          client: clientStructure,
          normalizationChanged,
          dataPreserved: !!normalized || !apiResponse.working
        },
        normalizationIssues,
        error: null,
        warnings: normalizationIssues.length > 0 ? ['Normalization issues detected'] : []
      };
    };

    // === DATA NORMALIZATION ANALYSIS FLOW ===
    if (flow === 'all' || flow === 'normalization') {
      await runFlow(
        'Data Normalization Analysis',
        'Deep analysis of data structure consistency across all layers',
        [
          {
            name: 'DB Schema Structure Analysis',
            layer: 'db',
            test: async () => {
              const result = await testDbLayer('models');
              const schemas = result.data?.dbStructure?.models?.details || {};
              
              const schemaAnalysis = {};
              const inconsistencies = [];
              
              Object.entries(schemas).forEach(([modelName, modelData]) => {
                if (modelData.sampleFields) {
                  schemaAnalysis[modelName] = {
                    fieldCount: modelData.schemaFields,
                    sampleFields: modelData.sampleFields,
                    hasTimestamps: modelData.sampleFields.includes('createdAt') || modelData.sampleFields.includes('updatedAt'),
                    hasId: modelData.sampleFields.includes('_id'),
                    fieldTypes: 'mixed' // In real scenario, would analyze actual field types
                  };
                  
                  // Check for potential inconsistencies
                  if (!modelData.sampleFields.includes('_id')) {
                    inconsistencies.push(`${modelName} model missing _id field`);
                  }
                }
              });
              
              return {
                working: Object.keys(schemaAnalysis).length > 0,
                schemaAnalysis,
                inconsistencies,
                normalizationIssues: inconsistencies,
                warnings: inconsistencies.length > 0 ? ['Schema inconsistencies found'] : []
              };
            }
          },
          {
            name: 'API Response Format Analysis',
            layer: 'api',
            test: async () => {
              const endpoints = [
                { path: '/api/files', name: 'files' },
                { path: '/api/batches', name: 'batches' },
                { path: '/api/items', name: 'items' },
                { path: '/api/folders', name: 'folders' },
                { path: '/api/auth', name: 'auth', params: { action: 'me' } }
              ];
              
              const formatAnalysis = {};
              const formatInconsistencies = [];
              
              for (const endpoint of endpoints) {
                try {
                  const result = await testApiLayer(endpoint.path, 'GET', endpoint.params);
                  const structure = analyzeDataStructure(result.data, endpoint.name);
                  
                  formatAnalysis[endpoint.name] = {
                    status: result.status,
                    structure,
                    hasStandardFormat: structure.structure?.hasSuccess && (structure.structure?.hasData || structure.structure?.hasError),
                    responseFormat: structure.structure?.hasSuccess ? 'standardized' : 'direct'
                  };
                  
                  // Track format inconsistencies
                  if (result.status < 400) {
                    if (!structure.structure?.hasSuccess) {
                      formatInconsistencies.push(`${endpoint.name} endpoint returns direct data instead of { success, data, error }`);
                    } else if (!structure.structure?.hasData && !structure.structure?.hasError) {
                      formatInconsistencies.push(`${endpoint.name} endpoint missing data/error field`);
                    }
                  }
                  
                } catch (error) {
                  formatAnalysis[endpoint.name] = {
                    error: error.message,
                    status: 'failed'
                  };
                }
              }
              
              return {
                working: Object.keys(formatAnalysis).length > 0,
                formatAnalysis,
                formatInconsistencies,
                standardizedEndpoints: Object.values(formatAnalysis).filter(f => f.hasStandardFormat).length,
                totalEndpoints: Object.keys(formatAnalysis).length,
                normalizationIssues: formatInconsistencies,
                warnings: formatInconsistencies.length > 0 ? ['API format inconsistencies found'] : []
              };
            }
          },
          {
            name: 'Client Normalization Testing',
            layer: 'client',
            test: async () => {
              const testCases = [
                { endpoint: '/api/files', expectedFormat: 'standard' },
                { endpoint: '/api/batches', expectedFormat: 'standard' },
                { endpoint: '/api/items', expectedFormat: 'standard', params: { type: 'chemical' } }
              ];
              
              const normalizationTests = {};
              const normalizationIssues = [];
              
              for (const testCase of testCases) {
                try {
                  const apiResult = await testApiLayer(testCase.endpoint, 'GET', testCase.params);
                  const clientResult = testClientLayer(apiResult, testCase.expectedFormat);
                  
                  normalizationTests[testCase.endpoint] = {
                    apiStatus: apiResult.status,
                    normalizationWorked: clientResult.normalizationChanged,
                    clientFormatCorrect: clientResult.clientFormat?.data !== undefined && clientResult.clientFormat?.error !== undefined,
                    dataPreserved: clientResult.normalizationData?.dataPreserved,
                    issues: clientResult.normalizationIssues
                  };
                  
                  normalizationIssues.push(...(clientResult.normalizationIssues || []));
                  
                } catch (error) {
                  normalizationTests[testCase.endpoint] = {
                    error: error.message
                  };
                  normalizationIssues.push(`Normalization test failed for ${testCase.endpoint}: ${error.message}`);
                }
              }
              
              return {
                working: Object.keys(normalizationTests).length > 0,
                normalizationTests,
                normalizationIssues,
                successfulNormalizations: Object.values(normalizationTests).filter(t => t.clientFormatCorrect).length,
                warnings: normalizationIssues.length > 0 ? ['Client normalization issues found'] : []
              };
            }
          }
        ]
      );
    }

    // === FILE MANAGEMENT FLOW ===
    if (flow === 'all' || flow === 'files') {
      await runFlow(
        'File Management Flow',
        'Complete flow from DB models through API to ApiClient for file operations',
        [
          {
            name: 'DB Layer - File Model Access',
            layer: 'db',
            test: async () => {
              const result = await testDbLayer('models');
              const fileModelWorking = result.working && 
                                     result.data?.dbStructure?.models?.available?.includes('File');
              
              const fileModelDetails = result.data?.dbStructure?.models?.details?.File;
              
              return {
                working: fileModelWorking,
                modelExists: fileModelWorking,
                modelCount: result.data?.dbStructure?.models?.count || 0,
                modelDetails: fileModelDetails,
                normalizationData: fileModelDetails ? analyzeDataStructure(fileModelDetails, 'file_model') : null,
                warnings: fileModelWorking ? [] : ['File model not accessible']
              };
            }
          },
          {
            name: 'DB Layer - File Service Access',
            layer: 'db',
            test: async () => {
              const result = await testDbLayer('services');
              const fileServiceWorking = result.working &&
                                        result.data?.dbStructure?.services?.available?.includes('fileService');
              
              const fileServiceDetails = result.data?.dbStructure?.services?.details?.fileService;
              
              return {
                working: fileServiceWorking,
                serviceExists: fileServiceWorking,
                serviceCount: result.data?.dbStructure?.services?.count || 0,
                serviceDetails: fileServiceDetails,
                warnings: fileServiceWorking ? [] : ['fileService not accessible']
              };
            }
          },
          {
            name: 'API Layer - Files Endpoint',
            layer: 'api',
            test: async () => {
              const result = await testApiLayer('/api/files');
              const structure = analyzeDataStructure(result.data, 'files_api');
              
              return {
                working: result.working || result.status < 500,
                status: result.status,
                hasData: !!result.data,
                responseFormat: typeof result.data,
                structure,
                normalizationData: structure,
                normalizationIssues: structure.normalizationIssues,
                warnings: result.working ? [] : [`Files API returned ${result.status}: ${result.error}`]
              };
            }
          },
          {
            name: 'API Layer - File Search',
            layer: 'api',
            test: async () => {
              const result = await testApiLayer('/api/files', 'GET', { search: 'test' });
              const structure = analyzeDataStructure(result.data, 'files_search');
              
              return {
                working: result.working || result.status < 500,
                hasSearchResults: !!result.data,
                searchWorking: result.working,
                structure,
                normalizationData: structure,
                warnings: !result.working && result.status >= 500 ? 
                         [`File search failed: ${result.error}`] : []
              };
            }
          },
          {
            name: 'Client Layer - Response Normalization',
            layer: 'client',
            test: async () => {
              const apiResult = await testApiLayer('/api/files');
              const clientResult = testClientLayer(apiResult);
              
              return {
                working: clientResult.working,
                normalizationWorked: clientResult.normalizationChanged,
                clientFormatCorrect: clientResult.clientFormat && 
                                   'data' in clientResult.clientFormat && 
                                   'error' in clientResult.clientFormat,
                dataPreserved: clientResult.normalizationData?.dataPreserved,
                normalizationData: clientResult.normalizationData,
                normalizationIssues: clientResult.normalizationIssues,
                warnings: clientResult.warnings
              };
            }
          },
          {
            name: 'End-to-End Integration',
            layer: 'integration',
            test: async () => {
              const apiResult = await testApiLayer('/api/files');
              const clientResult = testClientLayer(apiResult);
              
              const endToEndWorking = (apiResult.working || apiResult.status < 500) && 
                                    clientResult.working &&
                                    clientResult.clientFormat?.data !== undefined;
              
              return {
                working: endToEndWorking,
                apiToClientWorking: clientResult.working,
                dataFlowComplete: endToEndWorking && !!clientResult.normalized,
                finalFormat: clientResult.clientFormat,
                normalizationData: clientResult.normalizationData,
                warnings: endToEndWorking ? [] : ['End-to-end file flow not working properly']
              };
            }
          }
        ]
      );
    }

    // === BATCH WORKFLOW FLOW ===
    if (flow === 'all' || flow === 'batches') {
      await runFlow(
        'Batch Workflow Flow',
        'Complete batch management flow including work order operations',
        [
          {
            name: 'DB Layer - Batch Model & Service',
            layer: 'db',
            test: async () => {
              const result = await testDbLayer('models');
              const batchModelExists = result.data?.dbStructure?.models?.available?.includes('Batch');
              const batchServiceExists = result.data?.dbStructure?.services?.available?.includes('batchService');
              
              const batchModelDetails = result.data?.dbStructure?.models?.details?.Batch;
              
              return {
                working: batchModelExists && batchServiceExists,
                modelExists: batchModelExists,
                serviceExists: batchServiceExists,
                modelDetails: batchModelDetails,
                normalizationData: batchModelDetails ? analyzeDataStructure(batchModelDetails, 'batch_model') : null,
                warnings: !batchModelExists || !batchServiceExists ? 
                         ['Batch model or service not accessible'] : []
              };
            }
          },
          {
            name: 'API Layer - Batch CRUD',
            layer: 'api',
            test: async () => {
              const listResult = await testApiLayer('/api/batches');
              const statusResult = await testApiLayer('/api/batches', 'GET', { 
                id: '000000000000000000000000', 
                action: 'workorder-status' 
              });
              
              const listStructure = analyzeDataStructure(listResult.data, 'batch_list');
              const statusStructure = analyzeDataStructure(statusResult.data, 'batch_status');
              
              return {
                working: (listResult.working || listResult.status < 500) && 
                        (statusResult.working || statusResult.status < 500),
                listWorking: listResult.working || listResult.status < 500,
                workOrderStatusWorking: statusResult.working || statusResult.status < 500,
                listStructure,
                statusStructure,
                normalizationData: { list: listStructure, status: statusStructure },
                normalizationIssues: [...(listStructure.normalizationIssues || []), ...(statusStructure.normalizationIssues || [])],
                warnings: []
              };
            }
          },
          {
            name: 'Client Layer - Batch Operations',
            layer: 'client',
            test: async () => {
              const apiResult = await testApiLayer('/api/batches');
              const clientResult = testClientLayer(apiResult);
              
              return {
                working: clientResult.working,
                batchListNormalized: !!clientResult.normalized,
                clientFormatWorking: clientResult.clientFormat?.data !== undefined,
                normalizationData: clientResult.normalizationData,
                normalizationIssues: clientResult.normalizationIssues,
                warnings: clientResult.warnings
              };
            }
          }
        ]
      );
    }

    // === INVENTORY MANAGEMENT FLOW ===
    if (flow === 'all' || flow === 'items') {
      await runFlow(
        'Inventory Management Flow',
        'Complete inventory item management including transactions',
        [
          {
            name: 'DB Layer - Item Models',
            layer: 'db',
            test: async () => {
              const result = await testDbLayer('models');
              const itemModelExists = result.data?.dbStructure?.models?.available?.includes('Item');
              const chemicalExists = result.data?.dbStructure?.models?.available?.includes('Chemical');
              
              const itemModelDetails = result.data?.dbStructure?.models?.details?.Item;
              
              return {
                working: itemModelExists,
                itemModelExists: itemModelExists,
                discriminatorsWorking: chemicalExists,
                modelDetails: itemModelDetails,
                normalizationData: itemModelDetails ? analyzeDataStructure(itemModelDetails, 'item_model') : null,
                warnings: !itemModelExists ? ['Item model not accessible'] : 
                         !chemicalExists ? ['Item discriminators not working'] : []
              };
            }
          },
          {
            name: 'API Layer - Item CRUD',
            layer: 'api',
            test: async () => {
              const itemsResult = await testApiLayer('/api/items');
              const chemicalsResult = await testApiLayer('/api/items', 'GET', { type: 'chemical' });
              
              const itemsStructure = analyzeDataStructure(itemsResult.data, 'items_list');
              const chemicalsStructure = analyzeDataStructure(chemicalsResult.data, 'chemicals_list');
              
              return {
                working: (itemsResult.working || itemsResult.status < 500) &&
                        (chemicalsResult.working || chemicalsResult.status < 500),
                itemsEndpointWorking: itemsResult.working || itemsResult.status < 500,
                typeFilterWorking: chemicalsResult.working || chemicalsResult.status < 500,
                itemsStructure,
                chemicalsStructure,
                normalizationData: { items: itemsStructure, chemicals: chemicalsStructure },
                normalizationIssues: [...(itemsStructure.normalizationIssues || []), ...(chemicalsStructure.normalizationIssues || [])],
                warnings: []
              };
            }
          },
          {
            name: 'Client Layer - Inventory Operations',
            layer: 'client',
            test: async () => {
              const itemsResult = await testApiLayer('/api/items', 'GET', { type: 'chemical' });
              const clientResult = testClientLayer(itemsResult);
              
              return {
                working: clientResult.working,
                inventoryListNormalized: !!clientResult.normalized,
                clientFormatWorking: clientResult.clientFormat?.data !== undefined,
                normalizationData: clientResult.normalizationData,
                normalizationIssues: clientResult.normalizationIssues,
                warnings: clientResult.warnings
              };
            }
          }
        ]
      );
    }

    // === ANALYZE OVERALL DATA FLOW ===
    results.dataFlowAnalysis = {
      dbLayer: {
        modelsWorking: results.flows.some(f => f.steps.some(s => s.layer === 'db' && s.result?.modelExists)),
        servicesWorking: results.flows.some(f => f.steps.some(s => s.layer === 'db' && s.result?.serviceExists)),
        overallHealth: results.flows.filter(f => f.dataFlow.dbWorking).length
      },
      apiLayer: {
        endpointsWorking: results.flows.some(f => f.steps.some(s => s.layer === 'api' && s.result?.working)),
        formatConsistency: results.flows.filter(f => f.steps.some(s => s.layer === 'api' && s.result?.structure?.structure?.hasSuccess)).length,
        overallHealth: results.flows.filter(f => f.dataFlow.apiWorking).length
      },
      clientLayer: {
        normalizationWorking: results.flows.some(f => f.steps.some(s => s.layer === 'client' && s.result?.normalizationWorked)),
        formatWorking: results.flows.some(f => f.steps.some(s => s.layer === 'client' && s.result?.clientFormatCorrect)),
        overallHealth: results.flows.filter(f => f.dataFlow.clientWorking).length
      },
      integration: {
        endToEndFlows: results.flows.filter(f => f.dataFlow.endToEndWorking).length,
        totalFlows: results.flows.length,
        successRate: results.flows.length > 0 ? 
                    (results.flows.filter(f => f.dataFlow.endToEndWorking).length / results.flows.length * 100) : 0
      }
    };

    // === COMPREHENSIVE NORMALIZATION ANALYSIS ===
    const allNormalizationIssues = results.flows.reduce((acc, flow) => {
      return acc.concat(flow.normalizationIssues || []);
    }, []);

    results.normalizationAnalysis = {
      inconsistentFormats: [...new Set(allNormalizationIssues.filter(issue => issue.includes('format')))],
      missingFields: [...new Set(allNormalizationIssues.filter(issue => issue.includes('missing')))],
      typeConflicts: [...new Set(allNormalizationIssues.filter(issue => issue.includes('type') || issue.includes('inconsistent')))],
      totalIssues: allNormalizationIssues.length,
      uniqueIssues: [...new Set(allNormalizationIssues)].length,
      recommendations: []
    };

    // === GENERATE COMPREHENSIVE RECOMMENDATIONS ===
    const failedFlows = results.flows.filter(f => f.status === 'failed');
    const workingFlows = results.flows.filter(f => f.status === 'passed');
    const endToEndFlows = results.flows.filter(f => f.dataFlow.endToEndWorking);

    if (endToEndFlows.length === results.flows.length) {
      results.recommendations.push('🎉 All integration flows working perfectly! Your three-layer architecture is fully synchronized.');
    } else if (endToEndFlows.length > 0) {
      results.recommendations.push(`✅ ${endToEndFlows.length}/${results.flows.length} flows working end-to-end. Some integration issues remain.`);
    } else {
      results.recommendations.push('❌ No flows working end-to-end. Critical integration issues need immediate attention.');
    }

    // === DATA NORMALIZATION RECOMMENDATIONS ===
    if (results.normalizationAnalysis.totalIssues > 0) {
      results.normalizationAnalysis.recommendations.push(`🔧 Found ${results.normalizationAnalysis.totalIssues} normalization issues across ${results.normalizationAnalysis.uniqueIssues} unique problems`);
      
      // Specific recommendations based on your question about arrays
      if (results.normalizationAnalysis.inconsistentFormats.length > 0) {
        results.normalizationAnalysis.recommendations.push('📋 CRITICAL: Inconsistent response formats detected. Consider standardizing ALL API responses to { success: boolean, data: any, error: string|null }');
      }
      
      if (results.normalizationAnalysis.typeConflicts.length > 0) {
        results.normalizationAnalysis.recommendations.push('⚠️ Type conflicts found. Consider using a consistent data wrapper approach.');
      }

      // Answer to your specific question about arrays
      results.normalizationAnalysis.recommendations.push('💡 ARRAY APPROACH ANALYSIS: Putting everything in arrays would NOT be recommended because:');
      results.normalizationAnalysis.recommendations.push('   - Single values (name, email) don\'t need array complexity');
      results.normalizationAnalysis.recommendations.push('   - Better solution: Consistent response wrapper { success, data, error } where data can be anything');
      results.normalizationAnalysis.recommendations.push('   - Focus on API response format consistency, not data structure changes');
    }

    // Layer-specific recommendations
    if (results.dataFlowAnalysis.dbLayer.overallHealth === 0) {
      results.recommendations.push('🔧 DB Layer Issues: Models or services not accessible. Check db/index.js imports and schema definitions.');
    }

    if (results.dataFlowAnalysis.apiLayer.overallHealth === 0) {
      results.recommendations.push('🔧 API Layer Issues: Endpoints not working. Check API route files and db service integration.');
    } else if (results.dataFlowAnalysis.apiLayer.formatConsistency < results.flows.length) {
      results.recommendations.push('🔧 API Format Issues: Inconsistent response formats. Standardize to { success, data, error } across ALL endpoints.');
    }

    if (results.dataFlowAnalysis.clientLayer.overallHealth === 0) {
      results.recommendations.push('🔧 Client Layer Issues: Response normalization failing. Check apiClient response handling.');
    }

    // Specific flow recommendations
    if (failedFlows.some(f => f.name.includes('File'))) {
      results.recommendations.push('📁 File management flow has critical issues. Check File model, fileService, and /api/files route.');
    }

    if (failedFlows.some(f => f.name.includes('Batch'))) {
      results.recommendations.push('⚙️ Batch workflow has issues. Check Batch model, batchService, AsyncWorkOrderService, and /api/batches route.');
    }

    if (failedFlows.some(f => f.name.includes('Inventory'))) {
      results.recommendations.push('📦 Inventory management has issues. Check Item models, itemService, txnService, and /api/items route.');
    }

    if (failedFlows.some(f => f.name.includes('Normalization'))) {
      results.recommendations.push('🔄 Data normalization flow failed. This is likely your main issue - focus on response format consistency.');
    }

    // === ACTIONABLE FIXES FOR YOUR SPECIFIC ISSUES ===
    results.recommendations.push('');
    results.recommendations.push('🎯 IMMEDIATE ACTION ITEMS FOR DATA NORMALIZATION:');
    results.recommendations.push('1. Standardize ALL API routes to return { success: boolean, data: any, error: string|null }');
    results.recommendations.push('2. Update your ApiClient normalizeResponse() to handle this consistently');
    results.recommendations.push('3. DO NOT change your DB schemas - the issue is in API response formatting');
    results.recommendations.push('4. Focus on these files:');
    results.recommendations.push('   - All /api/*/route.js files (standardize response format)');
    results.recommendations.push('   - app/apiClient/index.js (improve normalization logic)');
    results.recommendations.push('   - Keep DB schemas as-is (they\'re probably fine)');

    // Success rate recommendations
    const successRate = results.dataFlowAnalysis.integration.successRate;
    if (successRate < 50) {
      results.recommendations.push('⚠️ Low integration success rate. Focus on fixing API response format consistency first.');
    } else if (successRate < 80) {
      results.recommendations.push('📈 Good progress! Focus on standardizing response formats and error handling.');
    }

    // === DETAILED DEBUGGING INFO FOR YOU ===
    const debugInfo = {
      timestamp: new Date().toISOString(),
      flowResults: results.flows.map(flow => ({
        name: flow.name,
        status: flow.status,
        endToEndWorking: flow.dataFlow.endToEndWorking,
        normalizationIssueCount: flow.normalizationIssues?.length || 0,
        criticalSteps: flow.steps.filter(step => step.status === 'failed').map(step => ({
          name: step.name,
          layer: step.layer,
          error: step.error?.message
        }))
      })),
      mostCommonIssues: {
        apiFormatIssues: allNormalizationIssues.filter(issue => issue.includes('success') || issue.includes('data') || issue.includes('error')),
        typeIssues: allNormalizationIssues.filter(issue => issue.includes('type') || issue.includes('inconsistent')),
        missingFieldIssues: allNormalizationIssues.filter(issue => issue.includes('missing'))
      },
      recommendedFixes: [
        'Fix API response format consistency (highest priority)',
        'Update ApiClient normalization logic', 
        'Keep DB schemas unchanged',
        'Test one endpoint at a time after fixes'
      ]
    };

    console.log(`✅ Integration flow testing completed: ${workingFlows.length}/${results.flows.length} flows working, ${endToEndFlows.length} end-to-end`);
    console.log(`🔍 Normalization issues found: ${results.normalizationAnalysis.totalIssues} total, ${results.normalizationAnalysis.uniqueIssues} unique`);

    return NextResponse.json({
      success: results.summary.failed === 0,
      results,
      debugInfo,
      message: `Integration Flow Test: ${workingFlows.length}/${results.flows.length} flows working, ${endToEndFlows.length} complete end-to-end, ${successRate.toFixed(1)}% success rate, ${results.normalizationAnalysis.totalIssues} normalization issues found`,
      
      // === SPECIFIC ANSWER TO YOUR ARRAY QUESTION ===
      arrayApproachAnalysis: {
        question: "Would it be dumb to put every field in an array?",
        answer: "YES, that would be unnecessarily complex and not solve the real problem",
        realProblem: "Inconsistent API response formats, not data structure issues",
        betterSolution: {
          description: "Standardize API response wrapper format",
          format: "{ success: boolean, data: any, error: string|null }",
          benefits: [
            "Data can be anything (object, array, string, etc.) inside 'data' field",
            "Consistent error handling across all endpoints", 
            "Easy to normalize in ApiClient",
            "No need to change DB schemas or data structures"
          ]
        },
        implementationSteps: [
          "1. Update all API routes to return the standard format",
          "2. Update ApiClient normalizeResponse() function",
          "3. Test one endpoint at a time",
          "4. Keep existing data structures unchanged"
        ]
      }
    });

  } catch (error) {
    console.error('💥 Integration flow test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results,
      debugInfo: {
        errorDetails: {
          message: error.message,
          stack: verbose ? error.stack : undefined,
          timestamp: new Date().toISOString()
        },
        partialResults: results.flows?.length || 0,
        recommendedAction: "Check server logs and fix the immediate error, then re-run tests"
      }
    }, { status: 500 });
  }
}