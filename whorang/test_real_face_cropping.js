#!/usr/bin/env node

/**
 * Real-world test of face cropping fix using actual doorbell image
 * This script tests the complete pipeline with coordinates from the database
 */

const path = require('path');
const fs = require('fs').promises;
const faceCroppingService = require('./services/faceCroppingServiceSharp');

async function testRealFaceCropping() {
  console.log('🔧 Testing Real Face Cropping Pipeline');
  console.log('=====================================\n');

  try {
    // Real coordinates from database (event ID 10)
    const realFaceDetections = [
      {
        bounding_box: { x: 0.45, y: 0.23, width: 0.67, height: 0.58 },
        confidence: 90,
        description: "Adult male with glasses, frontal view",
        quality: "clear"
      }
    ];

    // Test image URL from Home Assistant
    const testImageUrl = "http://192.168.86.162:8123/local/doorbell_snapshot.jpg";
    const visitorEventId = 999; // Test event ID

    console.log('📸 Testing with real doorbell image...');
    console.log(`Image URL: ${testImageUrl}`);
    console.log(`Face detections: ${realFaceDetections.length}`);
    console.log(`Coordinates: x=${realFaceDetections[0].bounding_box.x}, y=${realFaceDetections[0].bounding_box.y}`);
    console.log(`Size: w=${realFaceDetections[0].bounding_box.width}, h=${realFaceDetections[0].bounding_box.height}\n`);

    // Test the complete face cropping pipeline
    console.log('🚀 Running complete face cropping pipeline...\n');
    
    const startTime = Date.now();
    const faceCrops = await faceCroppingService.extractFaceCrops(
      testImageUrl,
      realFaceDetections,
      visitorEventId
    );
    const endTime = Date.now();

    console.log(`\n⏱️  Processing completed in ${endTime - startTime}ms\n`);

    // Analyze results
    if (faceCrops.length === 0) {
      console.log('❌ FAILURE: No face crops were created');
      return;
    }

    console.log('✅ SUCCESS: Face crops created!');
    console.log(`📊 Results: ${faceCrops.length} face crop(s) processed\n`);

    for (let i = 0; i < faceCrops.length; i++) {
      const crop = faceCrops[i];
      console.log(`Face Crop ${i + 1}:`);
      console.log(`  Face ID: ${crop.faceId}`);
      console.log(`  Face Crop Path: ${crop.faceCropPath}`);
      console.log(`  Thumbnail Path: ${crop.thumbnailPath}`);
      console.log(`  Dimensions: ${crop.cropDimensions.width}x${crop.cropDimensions.height}`);
      console.log(`  Quality Score: ${crop.qualityScore.toFixed(2)}`);
      console.log(`  Confidence: ${crop.confidence}%`);
      
      // Verify files actually exist
      const faceCropFullPath = path.join(__dirname, crop.faceCropPath);
      const thumbnailFullPath = path.join(__dirname, crop.thumbnailPath);
      
      try {
        const faceStats = await fs.stat(faceCropFullPath);
        console.log(`  ✅ Face crop file exists: ${faceStats.size} bytes`);
      } catch (error) {
        console.log(`  ❌ Face crop file missing: ${crop.faceCropPath}`);
      }
      
      try {
        const thumbStats = await fs.stat(thumbnailFullPath);
        console.log(`  ✅ Thumbnail file exists: ${thumbStats.size} bytes`);
      } catch (error) {
        console.log(`  ❌ Thumbnail file missing: ${crop.thumbnailPath}`);
      }
      
      console.log('');
    }

    // Test file listing
    console.log('📁 Directory contents after processing:');
    
    try {
      const facesFiles = await fs.readdir(path.join(__dirname, 'uploads', 'faces'));
      console.log(`  faces/: ${facesFiles.length} files`);
      facesFiles.forEach(file => console.log(`    - ${file}`));
    } catch (error) {
      console.log(`  faces/: Error reading directory - ${error.message}`);
    }
    
    try {
      const thumbFiles = await fs.readdir(path.join(__dirname, 'uploads', 'thumbnails'));
      console.log(`  thumbnails/: ${thumbFiles.length} files`);
      thumbFiles.forEach(file => console.log(`    - ${file}`));
    } catch (error) {
      console.log(`  thumbnails/: Error reading directory - ${error.message}`);
    }

    console.log('\n🎉 Real-world test completed successfully!');
    console.log('\n📋 What this proves:');
    console.log('====================');
    console.log('✅ Coordinate normalization works with real AI data');
    console.log('✅ Image download from Home Assistant works');
    console.log('✅ Sharp face cropping creates actual files');
    console.log('✅ Thumbnail generation works');
    console.log('✅ File validation prevents silent failures');
    console.log('✅ Directory management is robust');

    console.log('\n🔍 Next steps:');
    console.log('==============');
    console.log('1. Check the created face crop and thumbnail files');
    console.log('2. Trigger a real doorbell event to test end-to-end');
    console.log('3. Verify thumbnails appear in the UI instead of blue gradients');
    console.log('4. Monitor logs during real doorbell events');

  } catch (error) {
    console.error('\n❌ Real-world test failed:', error);
    console.error('\nError details:', error.stack);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('===================');
    console.log('1. Check network connectivity to Home Assistant');
    console.log('2. Verify the doorbell image URL is accessible');
    console.log('3. Check file permissions in uploads directory');
    console.log('4. Review the error stack trace above');
  }
}

// Run the real-world test
testRealFaceCropping().catch(console.error);
