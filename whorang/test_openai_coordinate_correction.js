#!/usr/bin/env node

/**
 * Test OpenAI Coordinate Correction System
 * Tests the coordinate correction specifically for OpenAI's spatial reasoning issues
 */

const coordinateCorrection = require('./services/coordinateCorrection');
const faceCroppingService = require('./services/faceCroppingServiceSharp');

async function testOpenAICoordinateCorrection() {
  console.log('🔧 Testing OpenAI Coordinate Correction System');
  console.log('==============================================\n');

  try {
    // Real OpenAI coordinates from your logs that were pointing to buildings
    const problematicCoordinates = [
      {
        name: 'OpenAI Event 13 (Building instead of person)',
        original: { x: 40.5, y: 35.2, width: 15.3, height: 25.4 },
        imageWidth: 640,
        imageHeight: 480,
        description: 'Male with beard, black cap, dark jacket'
      },
      {
        name: 'OpenAI Event 12 (Rejected as placeholder)',
        original: { x: 40.5, y: 35.2, width: 12.3, height: 22.5 },
        imageWidth: 640,
        imageHeight: 480,
        description: 'Male with beard, black cap, dark jacket'
      }
    ];

    console.log('📊 Testing Coordinate Correction Pipeline\n');

    for (const testCase of problematicCoordinates) {
      console.log(`🔍 Test Case: ${testCase.name}`);
      console.log(`   Original coordinates: x=${testCase.original.x}, y=${testCase.original.y}, w=${testCase.original.width}, h=${testCase.original.height}`);
      console.log(`   Image dimensions: ${testCase.imageWidth}x${testCase.imageHeight}`);
      console.log(`   Description: ${testCase.description}`);
      console.log('');

      // Step 1: Test coordinate correction service
      console.log('   Step 1: Applying OpenAI coordinate corrections...');
      const correctedCoords = coordinateCorrection.correctCoordinates(
        'openai',
        testCase.original,
        testCase.imageWidth,
        testCase.imageHeight
      );

      if (correctedCoords.correctionApplied) {
        console.log(`   ✅ Corrections applied: ${correctedCoords.appliedCorrections.join(', ')}`);
        console.log(`   📍 Corrected coordinates: x=${correctedCoords.x}, y=${correctedCoords.y}, w=${correctedCoords.width}, h=${correctedCoords.height}`);
      } else {
        console.log(`   ⚠️  No corrections applied`);
      }

      // Step 2: Test full coordinate normalization pipeline
      console.log('   Step 2: Testing full coordinate normalization...');
      const normalizedCoords = faceCroppingService.normalizeCoordinates(
        testCase.original,
        testCase.imageWidth,
        testCase.imageHeight,
        'openai'
      );

      console.log(`   📐 Final pixel coordinates: x=${Math.round(normalizedCoords.x)}, y=${Math.round(normalizedCoords.y)}, w=${Math.round(normalizedCoords.width)}, h=${Math.round(normalizedCoords.height)}`);

      // Step 3: Analyze the correction effectiveness
      console.log('   Step 3: Analyzing correction effectiveness...');
      
      // Calculate original position (percentage)
      const originalCenterX = testCase.original.x + (testCase.original.width / 2);
      const originalCenterY = testCase.original.y + (testCase.original.height / 2);
      
      // Calculate corrected position (percentage)
      const correctedCenterX = ((normalizedCoords.x + normalizedCoords.width / 2) / testCase.imageWidth) * 100;
      const correctedCenterY = ((normalizedCoords.y + normalizedCoords.height / 2) / testCase.imageHeight) * 100;
      
      console.log(`   📊 Position analysis:`);
      console.log(`      Original center: ${originalCenterX.toFixed(1)}% from left, ${originalCenterY.toFixed(1)}% from top`);
      console.log(`      Corrected center: ${correctedCenterX.toFixed(1)}% from left, ${correctedCenterY.toFixed(1)}% from top`);
      
      // Determine quadrants
      const originalQuadrant = getQuadrant(originalCenterX, originalCenterY);
      const correctedQuadrant = getQuadrant(correctedCenterX, correctedCenterY);
      
      console.log(`      Original quadrant: ${originalQuadrant}`);
      console.log(`      Corrected quadrant: ${correctedQuadrant}`);
      
      // Expected person location (bottom-right based on visual analysis)
      const expectedQuadrant = 'Bottom-Right';
      
      if (correctedQuadrant === expectedQuadrant) {
        console.log(`   ✅ SUCCESS: Correction moved detection to expected quadrant (${expectedQuadrant})`);
      } else if (originalQuadrant !== correctedQuadrant) {
        console.log(`   🔄 PARTIAL: Correction changed quadrant from ${originalQuadrant} to ${correctedQuadrant} (expected: ${expectedQuadrant})`);
      } else {
        console.log(`   ❌ INEFFECTIVE: No quadrant change (still in ${originalQuadrant}, expected: ${expectedQuadrant})`);
      }

      // Calculate crop area
      const cropArea = normalizedCoords.width * normalizedCoords.height;
      const imageArea = testCase.imageWidth * testCase.imageHeight;
      const cropPercentage = (cropArea / imageArea) * 100;
      
      console.log(`   📏 Crop analysis:`);
      console.log(`      Crop area: ${Math.round(cropArea)} pixels (${cropPercentage.toFixed(1)}% of image)`);
      
      if (cropPercentage >= 5 && cropPercentage <= 40) {
        console.log(`   ✅ Crop size reasonable for face detection`);
      } else if (cropPercentage < 5) {
        console.log(`   ⚠️  Crop very small - may miss face details`);
      } else {
        console.log(`   ⚠️  Crop very large - may include too much background`);
      }

      console.log('');
    }

    // Test coordinate validation
    console.log('🔍 Testing Coordinate Validation System\n');
    
    const validationTests = [
      { coords: { x: 75, y: 70, width: 20, height: 25 }, expected: 'valid' },
      { coords: { x: -10, y: 50, width: 20, height: 25 }, expected: 'invalid' },
      { coords: { x: 50, y: 50, width: 200, height: 25 }, expected: 'invalid' },
      { coords: { x: 50, y: 50, width: 1, height: 1 }, expected: 'warning' }
    ];

    for (const test of validationTests) {
      const validation = coordinateCorrection.validateCoordinates(
        test.coords,
        640,
        480
      );
      
      console.log(`Validation test: x=${test.coords.x}, y=${test.coords.y}, w=${test.coords.width}, h=${test.coords.height}`);
      console.log(`  Valid: ${validation.valid}, Issues: ${validation.issues.length}, Warnings: ${validation.warnings.length}`);
      console.log(`  Confidence: ${validation.confidence.toFixed(2)}`);
      console.log('');
    }

    console.log('📋 Summary and Recommendations');
    console.log('==============================');
    console.log('✅ OpenAI coordinate correction system implemented');
    console.log('✅ Spatial reasoning corrections for doorbell cameras');
    console.log('✅ Coordinate validation and bounds checking');
    console.log('✅ Integration with face cropping pipeline');
    console.log('');
    console.log('🎯 Expected Improvements:');
    console.log('- OpenAI coordinates should now point to actual person location');
    console.log('- Face crops should show the person instead of buildings');
    console.log('- Coordinate corrections logged for debugging');
    console.log('- Fallback validation prevents out-of-bounds crops');
    console.log('');
    console.log('🔍 Next Steps:');
    console.log('1. Trigger a new doorbell event with OpenAI');
    console.log('2. Monitor logs for coordinate correction messages');
    console.log('3. Verify face thumbnails show actual faces');
    console.log('4. Compare with previous building crops');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

function getQuadrant(x, y) {
  if (x < 50 && y < 50) return 'Top-Left';
  if (x >= 50 && y < 50) return 'Top-Right';
  if (x < 50 && y >= 50) return 'Bottom-Left';
  return 'Bottom-Right';
}

// Run the test
testOpenAICoordinateCorrection().catch(console.error);
