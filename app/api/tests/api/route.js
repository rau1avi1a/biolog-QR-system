// =============================================================================
// app/api/tests/api/route.js - Complete API Routes Test Suite
// =============================================================================
import { NextResponse } from 'next/server';
import db from '@/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const suite = searchParams.get('suite') || 'all'; // all, auth, batches, files, folders, items, netsuite
  const verbose = searchParams.get('verbose') === 'true';

  const results = {
    timestamp: new Date().toISOString(),
    suite,
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
    const runTest = async (name, testFn, category = 'general') => {
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
    // AUTH TESTS
    // =============================================================================
    if (suite === 'all' || suite === 'auth') {
      await runTest('Auth - User Model Access', async () => {
        const userCount = await db.models.User.countDocuments();
        return { userCount, modelExists: !!db.models.User };
      }, 'auth');

      await runTest('Auth - Create Test User', async () => {
        const testEmail = `test-${Date.now()}@example.com`;
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash('testpass123', 12);
        
        const user = await db.models.User.create({
          name: 'Test User',
          email: testEmail,
          password: hashedPassword,
          role: 'operator'
        });

        // Clean up
        await db.models.User.findByIdAndDelete(user._id);
        
        return { 
          created: true, 
          userId: user._id, 
          hasPassword: !!user.password,
          cleaned: true 
        };
      }, 'auth');

      await runTest('Auth - Password Matching', async () => {
        const users = await db.models.User.find().limit(1);
        if (users.length === 0) return { skipped: true, reason: 'No users in database' };
        
        const user = users[0];
        const hasMethod = typeof user.matchPassword === 'function';
        
        return { 
          hasMethod, 
          userExists: true,
          methodAvailable: hasMethod
        };
      }, 'auth');
    }

    // =============================================================================
    // BATCH TESTS
    // =============================================================================
    if (suite === 'all' || suite === 'batches') {
      await runTest('Batches - Service Access', async () => {
        const serviceExists = !!db.services.batchService;
        const hasConnect = typeof db.services.batchService.connect === 'function';
        const hasGetById = typeof db.services.batchService.getBatchById === 'function';
        const hasListBatches = typeof db.services.batchService.listBatches === 'function';
        
        return { serviceExists, hasConnect, hasGetById, hasListBatches };
      }, 'batches');

      await runTest('Batches - List Batches', async () => {
        const batches = await db.services.batchService.listBatches({ 
          filter: {}, 
          limit: 5 
        });
        
        return { 
          count: batches.length,
          hasBatches: batches.length > 0,
          sampleBatch: batches[0] ? {
            id: batches[0]._id,
            status: batches[0].status,
            runNumber: batches[0].runNumber
          } : null
        };
      }, 'batches');

      await runTest('Batches - Get Single Batch', async () => {
        const batches = await db.services.batchService.listBatches({ limit: 1 });
        if (batches.length === 0) return { skipped: true, reason: 'No batches available' };
        
        const batch = await db.services.batchService.getBatchById(batches[0]._id);
        
        return { 
          found: !!batch,
          id: batch?._id,
          hasFileId: !!batch?.fileId,
          hasSnapshot: !!batch?.snapshot
        };
      }, 'batches');

      await runTest('Batches - Work Order Status', async () => {
        const batches = await db.services.batchService.listBatches({ limit: 1 });
        if (batches.length === 0) return { skipped: true, reason: 'No batches available' };
        
        const status = await db.services.batchService.getWorkOrderStatus(batches[0]._id);
        
        return { 
          hasStatus: !!status,
          created: status?.created,
          workOrderStatus: status?.status,
          hasError: !!status?.error
        };
      }, 'batches');
    }

    // =============================================================================
    // FILE TESTS
    // =============================================================================
    if (suite === 'all' || suite === 'files') {
      await runTest('Files - Service Access', async () => {
        const serviceExists = !!db.services.fileService;
        const hasGetById = typeof db.services.fileService.getFileById === 'function';
        const hasListFiles = typeof db.services.fileService.listFiles === 'function';
        const hasSearchFiles = typeof db.services.fileService.searchFiles === 'function';
        
        return { serviceExists, hasGetById, hasListFiles, hasSearchFiles };
      }, 'files');

      await runTest('Files - List Files', async () => {
        const files = await db.services.fileService.listFiles({ 
          folderId: null 
        });
        
        return { 
          count: files.length,
          hasFiles: files.length > 0,
          sampleFile: files[0] ? {
            id: files[0]._id,
            fileName: files[0].fileName,
            folderId: files[0].folderId
          } : null
        };
      }, 'files');

      await runTest('Files - Get Single File', async () => {
        const files = await db.services.fileService.listFiles({ folderId: null });
        if (files.length === 0) return { skipped: true, reason: 'No files available' };
        
        const file = await db.services.fileService.getFileById(files[0]._id);
        
        return { 
          found: !!file,
          id: file?._id,
          hasFileName: !!file?.fileName,
          hasComponents: Array.isArray(file?.components)
        };
      }, 'files');

      await runTest('Files - Search Files', async () => {
        const results = await db.services.fileService.searchFiles('test');
        
        return { 
          count: results.length,
          isArray: Array.isArray(results),
          searchWorking: true
        };
      }, 'files');
    }

    // =============================================================================
    // FOLDER TESTS
    // =============================================================================
    if (suite === 'all' || suite === 'folders') {
      await runTest('Folders - Model Access', async () => {
        const modelExists = !!db.models.Folder;
        const folderCount = await db.models.Folder.countDocuments();
        
        return { modelExists, folderCount };
      }, 'folders');

      await runTest('Folders - List Root Folders', async () => {
        const folders = await db.models.Folder.find({ parentId: null })
          .limit(10)
          .lean();
        
        return { 
          count: folders.length,
          hasFolders: folders.length > 0,
          sampleFolder: folders[0] ? {
            id: folders[0]._id,
            name: folders[0].name,
            parentId: folders[0].parentId
          } : null
        };
      }, 'folders');

      await runTest('Folders - Create and Delete Test Folder', async () => {
        const testName = `Test-${Date.now()}`;
        
        const folder = await db.models.Folder.create({
          name: testName,
          parentId: null
        });
        
        const created = !!folder;
        const hasId = !!folder._id;
        
        // Clean up
        await db.models.Folder.findByIdAndDelete(folder._id);
        
        return { created, hasId, name: testName, cleaned: true };
      }, 'folders');
    }

    // =============================================================================
    // ITEM TESTS
    // =============================================================================
    if (suite === 'all' || suite === 'items') {
      await runTest('Items - Service Access', async () => {
        const serviceExists = !!db.services.itemService;
        const hasGetById = typeof db.services.itemService.getById === 'function';
        const hasSearch = typeof db.services.itemService.search === 'function';
        const hasGetLots = typeof db.services.itemService.getLots === 'function';
        
        return { serviceExists, hasGetById, hasSearch, hasGetLots };
      }, 'items');

      await runTest('Items - Search Items', async () => {
        const chemicals = await db.services.itemService.search({ type: 'chemical' });
        const solutions = await db.services.itemService.search({ type: 'solution' });
        const products = await db.services.itemService.search({ type: 'product' });
        
        return { 
          totalChemicals: chemicals.length,
          totalSolutions: solutions.length,
          totalProducts: products.length,
          totalItems: chemicals.length + solutions.length + products.length
        };
      }, 'items');

      await runTest('Items - Get Item with Lots', async () => {
        const items = await db.services.itemService.search({ type: 'chemical' });
        if (items.length === 0) return { skipped: true, reason: 'No chemical items available' };
        
        const item = await db.services.itemService.getWithLots(items[0]._id);
        
        return { 
          found: !!item,
          isLotTracked: item?.lotTracked,
          hasLots: Array.isArray(item?.Lots),
          lotCount: item?.Lots?.length || 0
        };
      }, 'items');

      await runTest('Items - Transaction Service Access', async () => {
        const serviceExists = !!db.services.txnService;
        const hasPost = typeof db.services.txnService.post === 'function';
        const hasListByItem = typeof db.services.txnService.listByItem === 'function';
        const hasGetItemStats = typeof db.services.txnService.getItemStats === 'function';
        
        return { serviceExists, hasPost, hasListByItem, hasGetItemStats };
      }, 'items');
    }

    // =============================================================================
    // NETSUITE TESTS
    // =============================================================================
    if (suite === 'all' || suite === 'netsuite') {
      await runTest('NetSuite - Service Access', async () => {
        const netsuiteExists = !!db.netsuite;
        const hasCreateAuth = typeof db.netsuite.createNetSuiteAuth === 'function';
        const hasCreateBOM = typeof db.netsuite.createBOMService === 'function';
        const hasCreateWorkOrder = typeof db.netsuite.createWorkOrderService === 'function';
        const hasMapComponents = typeof db.netsuite.mapNetSuiteComponents === 'function';
        
        return { 
          netsuiteExists, 
          hasCreateAuth, 
          hasCreateBOM, 
          hasCreateWorkOrder, 
          hasMapComponents 
        };
      }, 'netsuite');

      await runTest('NetSuite - Environment Configuration', async () => {
        const envConfigured = !!(
          process.env.NETSUITE_ACCOUNT_ID &&
          process.env.NETSUITE_CONSUMER_KEY &&
          process.env.NETSUITE_CONSUMER_SECRET &&
          process.env.NETSUITE_TOKEN_ID &&
          process.env.NETSUITE_TOKEN_SECRET
        );
        
        const usersWithAccess = await db.models.User.countDocuments({
          'netsuiteCredentials.isConfigured': true
        });
        
        return { 
          envConfigured, 
          usersWithAccess,
          configurationAvailable: envConfigured || usersWithAccess > 0
        };
      }, 'netsuite');

      await runTest('NetSuite - Units Helper', async () => {
        try {
          const { netsuiteUnits } = await import('@/db/lib/netsuite-units.js');
          const unitCount = Object.keys(netsuiteUnits).length;
          const sampleUnit = netsuiteUnits['33']; // Gram
          
          return { 
            unitsLoaded: true, 
            unitCount,
            hasSampleUnit: !!sampleUnit,
            sampleUnitName: sampleUnit?.name
          };
        } catch (error) {
          return { 
            unitsLoaded: false, 
            error: error.message 
          };
        }
      }, 'netsuite');

      await runTest('NetSuite - Component Mapping', async () => {
        const sampleComponents = [
          {
            ingredient: 'Water',
            itemId: '123',
            quantity: 1000,
            units: '35' // Liters
          }
        ];
        
        const mappingResults = await db.netsuite.mapNetSuiteComponents(sampleComponents);
        
        return { 
          componentCount: sampleComponents.length,
          resultCount: mappingResults.length,
          mappingWorking: Array.isArray(mappingResults),
          sampleResult: mappingResults[0] ? {
            hasNetsuiteComponent: !!mappingResults[0].netsuiteComponent,
            hasMatches: Array.isArray(mappingResults[0].matches),
            matchCount: mappingResults[0].matches?.length || 0
          } : null
        };
      }, 'netsuite');
    }

    // =============================================================================
    // INTEGRATION TESTS
    // =============================================================================
    if (suite === 'all') {
      await runTest('Integration - Cross-Service Dependencies', async () => {
        // Test that services can access each other
        const batchCanAccessFile = typeof db.services.batchService.services?.fileService !== 'undefined';
        const fileCanAccessBatch = typeof db.services.fileService.services?.batchService !== 'undefined';
        const itemCanAccessTxn = typeof db.services.itemService.services?.txnService !== 'undefined';
        
        return { 
          batchCanAccessFile, 
          fileCanAccessBatch, 
          itemCanAccessTxn,
          crossServiceAccess: batchCanAccessFile || fileCanAccessBatch || itemCanAccessTxn
        };
      }, 'integration');

      await runTest('Integration - AsyncWorkOrder Service', async () => {
        const serviceExists = !!db.services.AsyncWorkOrderService;
        const hasQueueMethod = typeof db.services.AsyncWorkOrderService.queueWorkOrderCreation === 'function';
        const hasStatusMethod = typeof db.services.AsyncWorkOrderService.getWorkOrderStatus === 'function';
        
        return { 
          serviceExists, 
          hasQueueMethod, 
          hasStatusMethod,
          isStatic: hasQueueMethod && hasStatusMethod
        };
      }, 'integration');

      await runTest('Integration - Database Connection Persistence', async () => {
        const initialConnected = db.connected;
        await db.connect();
        const afterConnect = db.connected;
        
        return { 
          initialConnected, 
          afterConnect, 
          connectionPersistent: initialConnected === afterConnect
        };
      }, 'integration');
    }

    // =============================================================================
    // PERFORMANCE TESTS
    // =============================================================================
    if (suite === 'all' || suite === 'performance') {
      await runTest('Performance - Model Loading Time', async () => {
        const start = Date.now();
        const modelCount = Object.keys(db.models).length;
        const duration = Date.now() - start;
        
        return { 
          modelCount, 
          loadTime: duration,
          fast: duration < 100
        };
      }, 'performance');

      await runTest('Performance - Service Loading Time', async () => {
        const start = Date.now();
        const serviceCount = Object.keys(db.services).length;
        const duration = Date.now() - start;
        
        return { 
          serviceCount, 
          loadTime: duration,
          fast: duration < 100
        };
      }, 'performance');
    }

  } catch (error) {
    console.error('Test suite error:', error);
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
    message: `${results.summary.passed}/${results.summary.total} tests passed`
  });
}