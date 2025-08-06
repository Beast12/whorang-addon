// Minimal test to verify controller instantiation works
console.log('🧪 Testing controller instantiation without database dependencies...');

// Mock all problematic modules
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  // Mock database and native modules
  if (id === 'better-sqlite3') {
    return function() { return { prepare: () => ({ all: () => [], get: () => null, run: () => null }) }; };
  }
  if (id === 'ws') {
    return class WebSocket {};
  }
  if (id.includes('sharp') || id.includes('canvas')) {
    return { createCanvas: () => ({}), loadImage: () => ({}) };
  }
  if (id.includes('face-api')) {
    return { nets: {}, detectAllFaces: () => [] };
  }
  return originalRequire.apply(this, arguments);
};

try {
  console.log('1. Testing DetectedFacesController import and instantiation...');
  
  // Mock dependencies
  const mockDatabaseManager = { 
    getDatabase: () => ({ 
      prepare: () => ({ all: () => [], get: () => null, run: () => null }) 
    })
  };
  const mockFaceProcessingService = {};
  
  // Test the route factory function
  const createDetectedFacesRouter = require('./routes/detectedFaces');
  console.log('✅ Route factory imported successfully');
  
  const mockDependencies = { databaseManager: mockDatabaseManager };
  
  console.log('2. Testing route factory execution...');
  const router = createDetectedFacesRouter(mockDependencies);
  console.log('✅ Route factory executed successfully');
  console.log('   Router type:', typeof router);
  console.log('   Router stack length:', router.stack ? router.stack.length : 'undefined');
  
  if (router.stack && router.stack.length > 0) {
    console.log('✅ Routes registered successfully');
    router.stack.forEach((layer, i) => {
      console.log(`   Route ${i}: ${layer.route ? layer.route.path : 'middleware'}`);
    });
  }
  
  console.log('3. Testing OpenAI route...');
  const createOpenaiRouter = require('./routes/openai');
  const openaiRouter = createOpenaiRouter(mockDependencies);
  console.log('✅ OpenAI route factory executed successfully');
  
  console.log('🎉 ALL CONTROLLER INSTANTIATION TESTS PASSED!');
  console.log('   The fixes should work in production environment.');
  
} catch (error) {
  console.error('❌ CONTROLLER INSTANTIATION TEST FAILED:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  
  if (error.message.includes('callback function')) {
    console.error('\n🚨 THE SAME ERROR IS STILL PRESENT!');
    console.error('   Controller methods are still undefined');
  }
}
