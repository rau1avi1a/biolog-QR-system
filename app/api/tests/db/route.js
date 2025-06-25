// app/api/tests/db/route.js - Updated to show names
import db from '@/db/index.js';

export async function GET() {
  try {
    await db.connect();
    
    const results = {
      success: true,
      connected: db.connected,
      timestamp: new Date().toISOString(),
      
      // Show all model names
      models: {
        count: Object.keys(db.models).length,
        available: Object.keys(db.models).sort()
      },
      
      // Show all service names
      services: {
        count: Object.keys(db.services).length,
        available: Object.keys(db.services).sort()
      },
      
      // Show all NetSuite function names
      netsuite: {
        count: Object.keys(db.netsuite).length,
        available: Object.keys(db.netsuite).sort()
      },
      
      // Show all auth function names
      auth: {
        count: Object.keys(db.auth).length,
        available: Object.keys(db.auth).sort()
      }
    };
    
    // Test some critical service methods exist
    results.serviceMethodCheck = {
      batchService: {
        available: !!db.services.batchService,
        methods: db.services.batchService ? Object.getOwnPropertyNames(Object.getPrototypeOf(db.services.batchService)).filter(name => name !== 'constructor').sort() : []
      },
      itemService: {
        available: !!db.services.itemService,
        methods: db.services.itemService ? Object.getOwnPropertyNames(Object.getPrototypeOf(db.services.itemService)).filter(name => name !== 'constructor').sort() : []
      },
      AsyncWorkOrderService: {
        available: !!db.services.AsyncWorkOrderService,
        staticMethods: db.services.AsyncWorkOrderService ? Object.getOwnPropertyNames(db.services.AsyncWorkOrderService).filter(name => typeof db.services.AsyncWorkOrderService[name] === 'function').sort() : []
      }
    };
    
    // Test database access (if possible)
    try {
      const counts = {
        users: await db.models.User.countDocuments(),
        items: await db.models.Item.countDocuments(),
        batches: await db.models.Batch.countDocuments(),
        files: await db.models.File.countDocuments()
      };
      results.databaseCounts = counts;
    } catch (error) {
      results.databaseError = error.message;
    }
    
    return Response.json(results, { 
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}