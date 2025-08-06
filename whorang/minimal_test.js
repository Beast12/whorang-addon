// Minimal test to identify the exact controller issue
console.log('🔍 Testing DetectedFacesController without database dependencies...');

try {
  // Mock the database module to avoid native module issues
  const Module = require('module');
  const originalRequire = Module.prototype.require;
  
  Module.prototype.require = function(id) {
    if (id === 'better-sqlite3') {
      console.log('   Mocking better-sqlite3');
      return function() { return {}; };
    }
    if (id === 'ws') {
      console.log('   Mocking ws');
      return class WebSocket {};
    }
    return originalRequire.apply(this, arguments);
  };

  // Test DetectedFacesController import and instantiation
  console.log('1. Testing DetectedFacesController import...');
  const DetectedFacesController = require('./controllers/detectedFacesController');
  console.log('✅ Import successful, type:', typeof DetectedFacesController);
  
  // Mock dependencies
  const mockDatabaseManager = { getDatabase: () => ({}) };
  const mockFaceProcessingService = {};
  
  console.log('2. Testing controller instantiation...');
  const controller = new DetectedFacesController(mockDatabaseManager, mockFaceProcessingService);
  console.log('✅ Instantiation successful, type:', typeof controller);
  
  console.log('3. Testing method existence...');
  const methods = [
    'getUnassignedFaces',
    'getPersonFaces', 
    'assignFaceToPerson',
    'unassignFace',
    'bulkAssignFaces',
    'getFaceSimilarities',
    'deleteFace',
    'getFaceStats'
  ];
  
  let allMethodsExist = true;
  methods.forEach(method => {
    const exists = typeof controller[method] === 'function';
    console.log(`   ${method}: ${exists ? '✅' : '❌'} ${typeof controller[method]}`);
    if (!exists) allMethodsExist = false;
  });
  
  if (allMethodsExist) {
    console.log('🎉 All methods exist - controller is properly structured');
  } else {
    console.log('❌ Some methods are missing');
    console.log('Available properties:', Object.getOwnPropertyNames(controller));
  }
  
  // Test route factory function
  console.log('4. Testing route factory function...');
  const createDetectedFacesRouter = require('./routes/detectedFaces');
  console.log('✅ Route factory imported, type:', typeof createDetectedFacesRouter);
  
  const mockDependencies = {
    DetectedFacesController,
    databaseManager: mockDatabaseManager
  };
  
  console.log('5. Testing route factory execution...');
  const router = createDetectedFacesRouter(mockDependencies);
  console.log('✅ Route factory executed successfully, type:', typeof router);
  
  console.log('🎉 ALL TESTS PASSED - The issue must be in production environment');
  
} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.error('Stack:', error.stack);
  
  // Specific debugging for the production error
  if (error.message.includes('callback function')) {
    console.log('\n🔍 This is the exact production error!');
    console.log('The issue is that a route callback is undefined');
    console.log('This means controller instantiation is failing in production');
  }
}
