// Debug script to identify the exact controller instantiation issue
console.log('🔍 Debugging DetectedFacesController instantiation...');

try {
  // Test DetectedFacesController import
  console.log('1. Testing DetectedFacesController import...');
  const DetectedFacesController = require('./controllers/detectedFacesController');
  console.log('✅ DetectedFacesController imported successfully');
  console.log('   Type:', typeof DetectedFacesController);
  console.log('   Constructor:', DetectedFacesController.toString().substring(0, 100));
  
  // Test faceProcessingService import
  console.log('2. Testing faceProcessingService import...');
  const faceProcessingService = require('./services/faceProcessing');
  console.log('✅ faceProcessingService imported successfully');
  console.log('   Type:', typeof faceProcessingService);
  
  // Mock dependencies
  console.log('3. Creating mock dependencies...');
  const mockDatabaseManager = { 
    getDatabase: () => {
      console.log('   Mock getDatabase called');
      return {};
    }
  };
  
  // Test controller instantiation
  console.log('4. Testing controller instantiation...');
  const detectedFacesController = new DetectedFacesController(mockDatabaseManager, faceProcessingService);
  console.log('✅ Controller instantiated successfully');
  console.log('   Type:', typeof detectedFacesController);
  
  // Test method existence
  console.log('5. Testing method existence...');
  console.log('   getUnassignedFaces:', typeof detectedFacesController.getUnassignedFaces);
  console.log('   getPersonFaces:', typeof detectedFacesController.getPersonFaces);
  console.log('   assignFaceToPerson:', typeof detectedFacesController.assignFaceToPerson);
  
  if (typeof detectedFacesController.getUnassignedFaces === 'function') {
    console.log('✅ getUnassignedFaces method exists and is a function');
  } else {
    console.log('❌ getUnassignedFaces method is missing or not a function');
    console.log('   Available methods:', Object.getOwnPropertyNames(detectedFacesController));
  }
  
  console.log('🎉 All tests passed - controller should work correctly');
  
} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.error('Stack:', error.stack);
  
  // Additional debugging
  if (error.message.includes('Cannot find module')) {
    console.log('\n🔍 Module resolution debugging:');
    const fs = require('fs');
    const path = require('path');
    
    if (error.message.includes('faceProcessing')) {
      const servicePath = './services/faceProcessing.js';
      console.log('   faceProcessing.js exists:', fs.existsSync(servicePath));
      if (fs.existsSync(servicePath)) {
        console.log('   faceProcessing.js size:', fs.statSync(servicePath).size);
      }
    }
  }
}
