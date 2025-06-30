// app/api/tests/db-layer/route.js - Comprehensive DB Layer Tests
import { NextResponse } from 'next/server';
import db from '@/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('test') || 'all'; // all, models, services, netsuite, integration
  const verbose = searchParams.get('verbose') === 'true';

  const results = {
    timestamp: new Date().toISOString(),
    testType,
    verbose,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    },
    tests: [],
    dbStructure: null,
    recommendations: []
  };

  try {
    await db.connect();
    console.log('🔗 Database connected for testing');

    // === DB STRUCTURE ANALYSIS ===
    results.dbStructure = {
      connected: db.connected,
      models: {
        count: Object.keys(db.models).length,
        available: Object.keys(db.models).sort(),
        details: {}
      },
      services: {
        count: Object.keys(db.services).length,
        available: Object.keys(db.services).sort(),
        details: {}
      },
      netsuite: {
        count: Object.keys(db.netsuite).length,
        available: Object.keys(db.netsuite).sort(),
        details: {}
      },
      auth: {
        count: Object.keys(db.auth).length,
        available: Object.keys(db.auth).sort()
      }
    };

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

    // === MODEL TESTS ===
    if (testType === 'all' || testType === 'models') {
      
      await runTest('Model Availability', 'models', async () => {
        const modelTests = {};
        const warnings = [];
        
        // Test each model exists and has basic methods
        for (const [name, model] of Object.entries(db.models)) {
          try {
            const methods = {
              find: typeof model.find === 'function',
              findById: typeof model.findById === 'function',
              create: typeof model.create === 'function',
              updateOne: typeof model.updateOne === 'function',
              deleteOne: typeof model.deleteOne === 'function',
              countDocuments: typeof model.countDocuments === 'function'
            };
            
            const schema = model.schema;
            const paths = schema ? Object.keys(schema.paths) : [];
            
            modelTests[name] = {
              available: true,
              modelName: model.modelName,
              methods,
              schemaFields: paths.length,
              sampleFields: paths.slice(0, 10),
              hasDiscriminator: !!model.discriminators,
              discriminators: model.discriminators ? Object.keys(model.discriminators) : []
            };

            // Check for potential issues
            if (!methods.find || !methods.create) {
              warnings.push(`Model ${name} missing basic methods`);
            }
            
          } catch (error) {
            modelTests[name] = {
              available: false,
              error: error.message
            };
            warnings.push(`Model ${name} failed to analyze: ${error.message}`);
          }
        }
        
        // Store detailed model info
        results.dbStructure.models.details = modelTests;
        
        return {
          totalModels: Object.keys(db.models).length,
          workingModels: Object.values(modelTests).filter(m => m.available).length,
          failedModels: Object.values(modelTests).filter(m => !m.available).length,
          modelTests,
          warnings
        };
      });

      await runTest('Model Data Access', 'models', async () => {
        const dataTests = {};
        const warnings = [];
        
        // Test actual database operations on each model
        for (const [name, model] of Object.entries(db.models)) {
          try {
            const count = await model.countDocuments();
            const sample = count > 0 ? await model.findOne().lean() : null;
            
            dataTests[name] = {
              count,
              hasSampleData: !!sample,
              sampleFields: sample ? Object.keys(sample) : [],
              canQuery: true
            };
            
            if (count === 0) {
              warnings.push(`Model ${name} has no data (count: 0)`);
            }
            
          } catch (error) {
            dataTests[name] = {
              count: 0,
              canQuery: false,
              error: error.message
            };
            warnings.push(`Model ${name} query failed: ${error.message}`);
          }
        }
        
        return { dataTests, warnings };
      });

      await runTest('Schema Validation', 'models', async () => {
        const schemaTests = {};
        const warnings = [];
        
        // Test schema structure and required fields
        for (const [name, model] of Object.entries(db.models)) {
          try {
            const schema = model.schema;
            const requiredFields = [];
            const indexedFields = [];
            const virtualFields = [];
            
            if (schema) {
              schema.eachPath((path, schemaType) => {
                if (schemaType.isRequired) requiredFields.push(path);
                if (schemaType._index) indexedFields.push(path);
              });
              
              Object.keys(schema.virtuals).forEach(virtual => {
                if (virtual !== 'id') virtualFields.push(virtual);
              });
            }
            
            schemaTests[name] = {
              hasSchema: !!schema,
              requiredFields,
              indexedFields,
              virtualFields,
              totalPaths: schema ? Object.keys(schema.paths).length : 0,
              hasTimestamps: !!(schema?.options?.timestamps),
              hasDiscriminator: !!schema?.discriminatorMapping
            };
            
            if (!schema) {
              warnings.push(`Model ${name} has no schema`);
            }
            
          } catch (error) {
            schemaTests[name] = {
              hasSchema: false,
              error: error.message
            };
            warnings.push(`Schema analysis failed for ${name}: ${error.message}`);
          }
        }
        
        return { schemaTests, warnings };
      });
    }

    // === SERVICE TESTS ===
    if (testType === 'all' || testType === 'services') {
      
      await runTest('Service Availability', 'services', async () => {
        const serviceTests = {};
        const warnings = [];
        
        for (const [name, service] of Object.entries(db.services)) {
          try {
            const methods = {};
            const properties = {};
            
            // Analyze service structure
            if (typeof service === 'object' && service !== null) {
              // Instance methods
              const proto = Object.getPrototypeOf(service);
              if (proto && proto.constructor !== Object) {
                Object.getOwnPropertyNames(proto).forEach(prop => {
                  if (prop !== 'constructor' && typeof service[prop] === 'function') {
                    methods[prop] = 'instance';
                  }
                });
              }
              
              // Direct properties and methods
              Object.getOwnPropertyNames(service).forEach(prop => {
                if (typeof service[prop] === 'function') {
                  methods[prop] = 'direct';
                } else if (prop !== 'constructor') {
                  properties[prop] = typeof service[prop];
                }
              });
              
              // Static methods (for classes like AsyncWorkOrderService)
              if (typeof service === 'function' || service.constructor !== Object) {
                Object.getOwnPropertyNames(service.constructor || service).forEach(prop => {
                  if (prop !== 'prototype' && prop !== 'name' && prop !== 'length') {
                    if (typeof (service.constructor || service)[prop] === 'function') {
                      methods[prop] = 'static';
                    }
                  }
                });
              }
            }
            
            serviceTests[name] = {
              available: true,
              type: typeof service,
              isClass: typeof service === 'function',
              methodCount: Object.keys(methods).length,
              methods: Object.keys(methods),
              methodTypes: methods,
              properties: Object.keys(properties),
              hasConnect: !!methods.connect,
              hasModel: !!properties.model || !!methods.model
            };
            
            if (Object.keys(methods).length === 0) {
              warnings.push(`Service ${name} has no methods`);
            }
            
          } catch (error) {
            serviceTests[name] = {
              available: false,
              error: error.message
            };
            warnings.push(`Service ${name} analysis failed: ${error.message}`);
          }
        }
        
        // Store detailed service info
        results.dbStructure.services.details = serviceTests;
        
        return {
          totalServices: Object.keys(db.services).length,
          workingServices: Object.values(serviceTests).filter(s => s.available).length,
          serviceTests,
          warnings
        };
      });

      await runTest('Service Functionality', 'services', async () => {
        const functionalTests = {};
        const warnings = [];
        
        // Test specific service operations
        const servicesToTest = [
          { name: 'batchService', method: 'listBatches', args: [{ limit: 1 }] },
          { name: 'fileService', method: 'listFiles', args: [{ folderId: null }] },
          { name: 'itemService', method: 'search', args: [{ type: 'chemical' }] },
          { name: 'txnService', method: 'listByItem', args: ['000000000000000000000000', { limit: 1 }] }
        ];
        
        for (const testCase of servicesToTest) {
          try {
            const service = db.services[testCase.name];
            if (!service) {
              functionalTests[testCase.name] = {
                available: false,
                error: 'Service not found'
              };
              warnings.push(`Service ${testCase.name} not available`);
              continue;
            }
            
            if (!service[testCase.method]) {
              functionalTests[testCase.name] = {
                available: true,
                methodExists: false,
                error: `Method ${testCase.method} not found`
              };
              warnings.push(`Service ${testCase.name} missing method ${testCase.method}`);
              continue;
            }
            
            // Try to call the method
            const result = await service[testCase.method](...testCase.args);
            
            functionalTests[testCase.name] = {
              available: true,
              methodExists: true,
              canExecute: true,
              resultType: typeof result,
              isArray: Array.isArray(result),
              hasData: !!result,
              resultSample: Array.isArray(result) ? { length: result.length } : 
                           typeof result === 'object' ? Object.keys(result) : result
            };
            
          } catch (error) {
            functionalTests[testCase.name] = {
              available: true,
              methodExists: true,
              canExecute: false,
              error: error.message
            };
            
            // Some errors are expected (like trying to find non-existent data)
            if (!error.message.includes('not found') && !error.message.includes('validation')) {
              warnings.push(`Service ${testCase.name}.${testCase.method} failed: ${error.message}`);
            }
          }
        }
        
        return { functionalTests, warnings };
      });
    }

    // === NETSUITE TESTS ===
    if (testType === 'all' || testType === 'netsuite') {
      
      await runTest('NetSuite Service Structure', 'netsuite', async () => {
        const netsuiteTests = {};
        const warnings = [];
        
        for (const [name, nsFunction] of Object.entries(db.netsuite)) {
          try {
            netsuiteTests[name] = {
              available: true,
              type: typeof nsFunction,
              isFunction: typeof nsFunction === 'function',
              isAsync: nsFunction.constructor?.name === 'AsyncFunction',
              length: nsFunction.length // parameter count
            };
            
          } catch (error) {
            netsuiteTests[name] = {
              available: false,
              error: error.message
            };
            warnings.push(`NetSuite function ${name} analysis failed: ${error.message}`);
          }
        }
        
        // Store detailed netsuite info
        results.dbStructure.netsuite.details = netsuiteTests;
        
        return {
          totalFunctions: Object.keys(db.netsuite).length,
          workingFunctions: Object.values(netsuiteTests).filter(f => f.available).length,
          netsuiteTests,
          warnings
        };
      });

      await runTest('NetSuite Environment Check', 'netsuite', async () => {
        const warnings = [];
        
        const envCheck = {
          NETSUITE_ACCOUNT_ID: !!process.env.NETSUITE_ACCOUNT_ID,
          NETSUITE_CONSUMER_KEY: !!process.env.NETSUITE_CONSUMER_KEY,
          NETSUITE_CONSUMER_SECRET: !!process.env.NETSUITE_CONSUMER_SECRET,
          NETSUITE_TOKEN_ID: !!process.env.NETSUITE_TOKEN_ID,
          NETSUITE_TOKEN_SECRET: !!process.env.NETSUITE_TOKEN_SECRET
        };
        
        const envConfigured = Object.values(envCheck).every(Boolean);
        
        const userCheck = await db.models.User.countDocuments({
          'netsuiteCredentials.isConfigured': true
        });
        
        if (!envConfigured && userCheck === 0) {
          warnings.push('No NetSuite credentials found in environment or user accounts');
        }
        
        return {
          environmentVariables: envCheck,
          environmentConfigured: envConfigured,
          usersWithCredentials: userCheck,
          hasAnyCredentials: envConfigured || userCheck > 0,
          warnings
        };
      });
    }

    // === INTEGRATION TESTS ===
    if (testType === 'all' || testType === 'integration') {
      
      await runTest('Cross-Service Communication', 'integration', async () => {
        const integrationTests = {};
        const warnings = [];
        
        // Test service dependencies
        const dependencyTests = [
          {
            name: 'batchService -> fileService',
            test: async () => {
              const hasServicesAccess = !!db.services.batchService.services;
              const hasFileService = hasServicesAccess && !!db.services.batchService.services.fileService;
              return { hasServicesAccess, hasFileService };
            }
          },
          {
            name: 'batchService -> txnService', 
            test: async () => {
              const hasServicesAccess = !!db.services.batchService.services;
              const hasTxnService = hasServicesAccess && !!db.services.batchService.services.txnService;
              return { hasServicesAccess, hasTxnService };
            }
          },
          {
            name: 'batchService -> AsyncWorkOrderService',
            test: async () => {
              const hasServicesAccess = !!db.services.batchService.services;
              const hasAsyncWO = hasServicesAccess && !!db.services.batchService.services.AsyncWorkOrderService;
              return { hasServicesAccess, hasAsyncWO };
            }
          }
        ];
        
        for (const depTest of dependencyTests) {
          try {
            const result = await depTest.test();
            integrationTests[depTest.name] = {
              ...result,
              working: Object.values(result).every(Boolean)
            };
            
            if (!integrationTests[depTest.name].working) {
              warnings.push(`Dependency issue: ${depTest.name}`);
            }
            
          } catch (error) {
            integrationTests[depTest.name] = {
              working: false,
              error: error.message
            };
            warnings.push(`Dependency test failed: ${depTest.name} - ${error.message}`);
          }
        }
        
        return { integrationTests, warnings };
      });

      await runTest('Data Flow Test', 'integration', async () => {
        const warnings = [];
        
        // Test a complete data flow: File -> Batch -> WorkOrder
        try {
          // 1. Get a file
          const files = await db.services.fileService.listFiles({ folderId: null });
          const hasFiles = files && files.length > 0;
          
          // 2. Get batches for that file (if file exists)
          let hasBatches = false;
          let batchWorkOrderStatus = null;
          
          if (hasFiles) {
            const batches = await db.services.batchService.listBatches({ 
              filter: { fileId: files[0]._id },
              limit: 1 
            });
            hasBatches = batches && batches.length > 0;
            
            // 3. Test work order status (if batch exists)
            if (hasBatches) {
              batchWorkOrderStatus = await db.services.batchService.getWorkOrderStatus(batches[0]._id);
            }
          }
          
          if (!hasFiles) warnings.push('No files available for data flow test');
          if (!hasBatches) warnings.push('No batches available for data flow test');
          
          return {
            fileServiceWorking: hasFiles,
            batchServiceWorking: hasBatches,
            workOrderServiceWorking: !!batchWorkOrderStatus,
            dataFlowComplete: hasFiles && hasBatches && !!batchWorkOrderStatus,
            warnings
          };
          
        } catch (error) {
          warnings.push(`Data flow test failed: ${error.message}`);
          return {
            fileServiceWorking: false,
            batchServiceWorking: false,
            workOrderServiceWorking: false,
            dataFlowComplete: false,
            error: error.message,
            warnings
          };
        }
      });
    }

    // === GENERATE RECOMMENDATIONS ===
    const failedTests = results.tests.filter(t => t.status === 'failed');
    const warningTests = results.tests.filter(t => t.status === 'warning');
    
    if (failedTests.length === 0 && warningTests.length === 0) {
      results.recommendations.push('✅ All DB layer tests passed - your database layer is working correctly');
    } else {
      if (failedTests.length > 0) {
        results.recommendations.push(`❌ ${failedTests.length} critical issues found - check failed tests`);
      }
      if (warningTests.length > 0) {
        results.recommendations.push(`⚠️ ${warningTests.length} warnings found - these may cause API issues`);
      }
    }
    
    // Specific recommendations based on test results
    const modelIssues = results.tests.filter(t => t.category === 'models' && t.status === 'failed');
    if (modelIssues.length > 0) {
      results.recommendations.push('🔧 Model issues detected - check schema definitions and database connection');
    }
    
    const serviceIssues = results.tests.filter(t => t.category === 'services' && t.status === 'failed');
    if (serviceIssues.length > 0) {
      results.recommendations.push('🔧 Service issues detected - check service imports and method definitions');
    }
    
    const integrationIssues = results.tests.filter(t => t.category === 'integration' && t.status === 'failed');
    if (integrationIssues.length > 0) {
      results.recommendations.push('🔧 Integration issues detected - services may not be properly connected');
    }

    console.log(`✅ DB layer testing completed: ${results.summary.passed}/${results.summary.total} passed`);

    return NextResponse.json({
      success: results.summary.failed === 0,
      results,
      message: `DB Layer Test: ${results.summary.passed}/${results.summary.total} passed, ${results.summary.failed} failed, ${results.summary.warnings} warnings`
    });

  } catch (error) {
    console.error('💥 DB layer test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 });
  }
}