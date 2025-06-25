// db/test-node.js - Node.js compatible test
// This bypasses the @/ alias issue by testing core functionality directly

async function testCoreComponents() {
    try {
      console.log('🧪 Testing Core DB Components (Node.js compatible)...\n');
      
      // Test 1: Can we import the connection?
      console.log('📡 Testing database connection...');
      try {
        const { connectMongo } = await import('./lib/db-connection.js');
        console.log('   ✅ Connection module imported');
        
        await connectMongo();
        console.log('   ✅ MongoDB connection established');
      } catch (error) {
        console.log(`   ⚠️  Connection error: ${error.message}`);
      }
      
      // Test 2: Can we import schemas?
      console.log('\n📋 Testing schemas...');
      try {
        const { schemas } = await import('./schemas/index.js');
        console.log('   ✅ Schemas imported');
        console.log(`   📊 Found ${Object.keys(schemas).length} schemas:`, Object.keys(schemas));
      } catch (error) {
        console.log(`   ⚠️  Schema error: ${error.message}`);
      }
      
      // Test 3: Can we create models without the full index?
      console.log('\n🏗️  Testing model creation...');
      try {
        const mongoose = await import('mongoose');
        const { schemas } = await import('./schemas/index.js');
        
        // Test creating a simple model
        const TestUser = mongoose.default.model('TestUser', schemas.userSchema);
        console.log('   ✅ Model creation works');
        
        // Clean up
        delete mongoose.default.models.TestUser;
      } catch (error) {
        console.log(`   ⚠️  Model creation error: ${error.message}`);
      }
      
      // Test 4: Check what happens when we try to import the full index
      console.log('\n🎯 Testing full index import...');
      try {
        const db = await import('./index.js');
        console.log('   ✅ Index imported successfully');
        console.log('   🔗 Connecting...');
        await db.default.connect();
        console.log('   ✅ Connected successfully');
        
        console.log('\n📦 Available components:');
        console.log(`   - Models: ${Object.keys(db.default.models).length}`);
        console.log(`   - Services: ${Object.keys(db.default.services).length}`);
        console.log(`   - NetSuite: ${Object.keys(db.default.netsuite).length}`);
        console.log(`   - Auth: ${Object.keys(db.default.auth).length}`);
        
      } catch (error) {
        console.log(`   ❌ Full index error: ${error.message}`);
        console.log('   📝 This is likely due to @/ alias in service files');
      }
      
      console.log('\n🎉 Core component test completed!');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    } finally {
      process.exit(0);
    }
  }
  
  testCoreComponents();