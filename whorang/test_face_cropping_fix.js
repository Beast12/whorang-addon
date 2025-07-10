#!/usr/bin/env node

/**
 * Test script to validate the face cropping fixes
 * Tests with actual coordinates from the database
 */

const path = require('path');
const fs = require('fs').promises;

// Import the fixed face cropping service
const faceCroppingService = require('./services/faceCroppingServiceSharp');

async function testFaceCroppingFix() {
  console.log('🔧 Testing Face Cropping Fix');
  console.log('============================\n');

  try {
    // Test coordinates from the database (actual Ollama AI coordinates)
    const testCoordinates = [
      { x: 0.45, y: 0.23, width: 0.67, height: 0.58 }, // From face ID 10
      { x: 0.48, y: 0.23, width: 0.67, height: 0.59 }  // From face ID 9
    ];

    // Mock image metadata (typical doorbell camera resolution)
    const mockMetadata = {
      width: 1920,
      height: 1080
    };

    console.log('📊 Testing coordinate normalization...\n');

    for (let i = 0; i < testCoordinates.length; i++) {
      const coords = testCoordinates[i];
      console.log(`Test ${i + 1}: Original coordinates from database`);
      console.log(`  Input: x=${coords.x}, y=${coords.y}, w=${coords.width}, h=${coords.height}`);
      
      // Test the coordinate normalization
      const normalizedCoords = faceCroppingService.normalizeCoordinates(coords, mockMetadata.width, mockMetadata.height);
      
      console.log(`  Normalized to pixels:`);
      console.log(`    x=${Math.round(normalizedCoords.x)}, y=${Math.round(normalizedCoords.y)}`);
      console.log(`    w=${Math.round(normalizedCoords.width)}, h=${Math.round(normalizedCoords.height)}`);
      
      // Calculate the crop area
      const cropArea = normalizedCoords.width * normalizedCoords.height;
      const imageArea = mockMetadata.width * mockMetadata.height;
      const cropPercentage = (cropArea / imageArea) * 100;
      
      console.log(`  Crop area: ${Math.round(cropArea)} pixels (${cropPercentage.toFixed(1)}% of image)`);
      
      // Validate the results
      if (normalizedCoords.width < 50 || normalizedCoords.height < 50) {
        console.log(`  ❌ ISSUE: Crop too small - likely coordinate misinterpretation`);
      } else if (normalizedCoords.width > mockMetadata.width * 0.9) {
        console.log(`  ❌ ISSUE: Crop too large - likely coordinate misinterpretation`);
      } else {
        console.log(`  ✅ GOOD: Crop size looks reasonable for a face`);
      }
      
      console.log('');
    }

    // Test directory validation
    console.log('📁 Testing directory creation and validation...\n');
    
    try {
      await faceCroppingService.ensureDirectories();
      console.log('✅ Directory creation and validation successful');
    } catch (error) {
      console.log('❌ Directory creation failed:', error.message);
    }

    // Check if directories exist
    const uploadsDir = path.join(__dirname, 'uploads');
    const facesDir = path.join(uploadsDir, 'faces');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

    console.log('\n📂 Directory status:');
    
    try {
      const uploadsStats = await fs.stat(uploadsDir);
      console.log(`  uploads/: ✅ exists (${uploadsStats.isDirectory() ? 'directory' : 'not directory'})`);
    } catch (error) {
      console.log(`  uploads/: ❌ missing`);
    }

    try {
      const facesStats = await fs.stat(facesDir);
      console.log(`  faces/: ✅ exists (${facesStats.isDirectory() ? 'directory' : 'not directory'})`);
    } catch (error) {
      console.log(`  faces/: ❌ missing`);
    }

    try {
      const thumbnailsStats = await fs.stat(thumbnailsDir);
      console.log(`  thumbnails/: ✅ exists (${thumbnailsStats.isDirectory() ? 'directory' : 'not directory'})`);
    } catch (error) {
      console.log(`  thumbnails/: ❌ missing`);
    }

    console.log('\n🎯 Summary of Fixes Applied:');
    console.log('=============================');
    console.log('✅ Fixed coordinate format detection (normalized vs percentage)');
    console.log('✅ Added proper coordinate conversion logic');
    console.log('✅ Enhanced directory creation with validation');
    console.log('✅ Added file creation validation');
    console.log('✅ Added comprehensive error handling');
    console.log('✅ Added detailed debug logging');

    console.log('\n📋 Next Steps:');
    console.log('==============');
    console.log('1. Trigger a new doorbell event to test the complete pipeline');
    console.log('2. Check the logs for coordinate conversion details');
    console.log('3. Verify that face crop files are actually created');
    console.log('4. Check that thumbnails appear correctly in the UI');

    console.log('\n🔍 To monitor the fix in action:');
    console.log('================================');
    console.log('Watch the logs for these key messages:');
    console.log('  - "Sharp: Detected normalized coordinates (0.0-1.0)"');
    console.log('  - "Sharp: Coordinate conversion: (...) -> (...)"');
    console.log('  - "Sharp: File validation successful: ..."');
    console.log('  - "Sharp: Face crop X extracted: ..."');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFaceCroppingFix().catch(console.error);
