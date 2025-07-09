const faceCroppingService = require('./services/faceCroppingService');

async function testOptimizedCropping() {
  console.log('=== Testing Optimized Face Cropping ===');
  
  try {
    // Test canvas availability
    console.log('🔍 Testing canvas availability...');
    try {
      const { createCanvas } = require('canvas');
      const testCanvas = createCanvas(100, 100);
      console.log('✅ Canvas module is working!');
    } catch (error) {
      console.log('❌ Canvas module failed:', error.message);
      return;
    }
    
    // Test with a sample face detection result
    const sampleImageUrl = 'http://192.168.86.162:8123/local/doorbell_snapshot.jpg';
    const sampleFaceDetection = {
      bounding_box: { x: 0.45, y: 0.23, width: 0.67, height: 0.58 },
      confidence: 90,
      description: 'A person with a beard wearing a cap'
    };
    
    console.log('\n🎯 Testing face crop extraction with optimized padding...');
    console.log('Sample face coordinates:', sampleFaceDetection.bounding_box);
    
    const faceCrops = await faceCroppingService.extractFaceCrops(
      sampleImageUrl,
      [sampleFaceDetection],
      999 // Test visitor ID
    );
    
    if (faceCrops.length > 0) {
      const crop = faceCrops[0];
      console.log('✅ Optimized face crop created successfully!');
      console.log('   Face crop path:', crop.faceCropPath);
      console.log('   Thumbnail path:', crop.thumbnailPath);
      console.log('   Quality score:', crop.qualityScore);
      console.log('   Bounding box used:', crop.boundingBox);
      
      // Check if the file actually exists
      const fs = require('fs');
      const path = require('path');
      const fullPath = path.join(__dirname, crop.faceCropPath);
      
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        console.log('   File size:', stats.size, 'bytes');
        console.log('   File created:', stats.birthtime);
        console.log('✅ Face crop file exists and has content!');
      } else {
        console.log('❌ Face crop file does not exist at:', fullPath);
      }
    } else {
      console.log('❌ No face crops were created');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.stack);
  }
}

// Run the test
testOptimizedCropping().then(() => {
  console.log('\n=== Optimized Cropping Test Complete ===');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
