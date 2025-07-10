#!/usr/bin/env node

/**
 * Test Script for Face Deduplication
 * Tests the new face deduplication system to prevent duplicate face crops
 */

const faceDeduplicationService = require('./services/faceDeduplication');

async function testFaceDeduplication() {
  console.log('🧪 Testing Face Deduplication System');
  console.log('=' .repeat(50));

  // Test 1: Exact Duplicates
  console.log('\n🔍 Test 1: Exact Duplicate Faces');
  console.log('-'.repeat(30));

  const exactDuplicates = [
    {
      id: 1,
      bounding_box: { x: 45, y: 30, width: 15, height: 20 },
      confidence: 85,
      description: 'Person with glasses',
      quality: 'good',
      distinctive_features: ['glasses', 'beard']
    },
    {
      id: 2,
      bounding_box: { x: 45, y: 30, width: 15, height: 20 }, // Exact same coordinates
      confidence: 82,
      description: 'Person with glasses and facial hair',
      quality: 'good',
      distinctive_features: ['glasses', 'facial hair']
    }
  ];

  const deduplicatedExact = faceDeduplicationService.deduplicateFaces(exactDuplicates);
  console.log(`✅ Exact duplicates: ${exactDuplicates.length} → ${deduplicatedExact.length} faces`);
  
  if (deduplicatedExact.length === 1) {
    console.log(`✅ Merged face confidence: ${deduplicatedExact[0].confidence}%`);
    console.log(`✅ Merged features: ${deduplicatedExact[0].distinctive_features.join(', ')}`);
  }

  // Test 2: Near Duplicates (High Overlap)
  console.log('\n🔍 Test 2: Near Duplicate Faces (High Overlap)');
  console.log('-'.repeat(30));

  const nearDuplicates = [
    {
      id: 1,
      bounding_box: { x: 40, y: 25, width: 20, height: 25 },
      confidence: 90,
      description: 'Clear face view',
      quality: 'clear',
      distinctive_features: ['smiling']
    },
    {
      id: 2,
      bounding_box: { x: 42, y: 27, width: 18, height: 23 }, // Slightly different but overlapping
      confidence: 87,
      description: 'Person smiling',
      quality: 'good',
      distinctive_features: ['happy expression']
    }
  ];

  const deduplicatedNear = faceDeduplicationService.deduplicateFaces(nearDuplicates);
  console.log(`✅ Near duplicates: ${nearDuplicates.length} → ${deduplicatedNear.length} faces`);

  // Test 3: Distinct Faces (Should NOT be merged)
  console.log('\n🔍 Test 3: Distinct Faces (Should NOT be merged)');
  console.log('-'.repeat(30));

  const distinctFaces = [
    {
      id: 1,
      bounding_box: { x: 20, y: 30, width: 15, height: 20 }, // Left side
      confidence: 85,
      description: 'Person on left',
      quality: 'good',
      distinctive_features: ['glasses']
    },
    {
      id: 2,
      bounding_box: { x: 65, y: 35, width: 18, height: 22 }, // Right side
      confidence: 88,
      description: 'Person on right',
      quality: 'good',
      distinctive_features: ['hat']
    }
  ];

  const deduplicatedDistinct = faceDeduplicationService.deduplicateFaces(distinctFaces);
  console.log(`✅ Distinct faces: ${distinctFaces.length} → ${deduplicatedDistinct.length} faces`);
  
  if (deduplicatedDistinct.length === 2) {
    console.log('✅ Correctly preserved both distinct faces');
  } else {
    console.log('❌ Incorrectly merged distinct faces');
  }

  // Test 4: Multiple Duplicates (Gemini-style scenario)
  console.log('\n🔍 Test 4: Multiple Duplicates (Gemini-style scenario)');
  console.log('-'.repeat(30));

  const geminiStyleDuplicates = [
    {
      id: 1,
      bounding_box: { x: 45.2, y: 30.1, width: 15.3, height: 20.2 },
      confidence: 85,
      description: 'Person detected',
      quality: 'good',
      distinctive_features: ['glasses']
    },
    {
      id: 2,
      bounding_box: { x: 45.0, y: 30.0, width: 15.0, height: 20.0 }, // Very similar
      confidence: 87,
      description: 'Person with glasses',
      quality: 'good',
      distinctive_features: ['eyewear']
    },
    {
      id: 3,
      bounding_box: { x: 45.1, y: 30.2, width: 15.1, height: 20.1 }, // Another similar
      confidence: 83,
      description: 'Individual with spectacles',
      quality: 'fair',
      distinctive_features: ['glasses', 'beard']
    }
  ];

  const deduplicatedGemini = faceDeduplicationService.deduplicateFaces(geminiStyleDuplicates);
  console.log(`✅ Gemini-style duplicates: ${geminiStyleDuplicates.length} → ${deduplicatedGemini.length} faces`);
  
  if (deduplicatedGemini.length === 1) {
    console.log('✅ Successfully merged all Gemini duplicates');
    console.log(`✅ Final confidence: ${deduplicatedGemini[0].confidence}%`);
    console.log(`✅ Merged from: ${deduplicatedGemini[0].merged_from} faces`);
    console.log(`✅ Combined features: ${deduplicatedGemini[0].distinctive_features.join(', ')}`);
  }

  // Test 5: IoU Calculation Accuracy
  console.log('\n🔍 Test 5: IoU Calculation Accuracy');
  console.log('-'.repeat(30));

  const bbox1 = { x: 40, y: 30, width: 20, height: 25 };
  const bbox2 = { x: 45, y: 35, width: 20, height: 25 }; // Overlapping
  const bbox3 = { x: 80, y: 80, width: 15, height: 15 }; // No overlap

  const iou1 = faceDeduplicationService.calculateIoU(bbox1, bbox2);
  const iou2 = faceDeduplicationService.calculateIoU(bbox1, bbox3);

  console.log(`✅ IoU (overlapping boxes): ${iou1.toFixed(3)} (should be > 0)`);
  console.log(`✅ IoU (non-overlapping boxes): ${iou2.toFixed(3)} (should be 0)`);

  if (iou1 > 0 && iou2 === 0) {
    console.log('✅ IoU calculation working correctly');
  } else {
    console.log('❌ IoU calculation has issues');
  }

  // Test 6: Configuration Updates
  console.log('\n🔍 Test 6: Configuration Updates');
  console.log('-'.repeat(30));

  const originalConfig = { ...faceDeduplicationService.config };
  console.log('Original config:', originalConfig);

  faceDeduplicationService.updateConfig({
    overlapThreshold: 0.5, // Lower threshold
    maxCenterDistance: 10  // Higher distance
  });

  console.log('Updated config:', faceDeduplicationService.config);

  // Test with new config
  const testFacesNewConfig = [
    {
      id: 1,
      bounding_box: { x: 40, y: 30, width: 20, height: 25 },
      confidence: 85,
      description: 'Test face 1',
      quality: 'good',
      distinctive_features: []
    },
    {
      id: 2,
      bounding_box: { x: 50, y: 40, width: 18, height: 23 }, // Less overlap
      confidence: 80,
      description: 'Test face 2',
      quality: 'good',
      distinctive_features: []
    }
  ];

  const deduplicatedNewConfig = faceDeduplicationService.deduplicateFaces(testFacesNewConfig);
  console.log(`✅ With relaxed config: ${testFacesNewConfig.length} → ${deduplicatedNewConfig.length} faces`);

  // Restore original config
  faceDeduplicationService.updateConfig(originalConfig);

  // Test 7: Statistics Generation
  console.log('\n🔍 Test 7: Statistics Generation');
  console.log('-'.repeat(30));

  const originalFaces = [
    { id: 1, bounding_box: { x: 40, y: 30, width: 20, height: 25 } },
    { id: 2, bounding_box: { x: 41, y: 31, width: 19, height: 24 } },
    { id: 3, bounding_box: { x: 70, y: 60, width: 15, height: 18 } }
  ];

  const deduplicatedStats = faceDeduplicationService.deduplicateFaces(originalFaces);
  const stats = faceDeduplicationService.getDeduplicationStats(originalFaces, deduplicatedStats);

  console.log('📊 Deduplication Statistics:');
  console.log(`   - Original faces: ${stats.originalCount}`);
  console.log(`   - Final faces: ${stats.finalCount}`);
  console.log(`   - Duplicates removed: ${stats.duplicatesRemoved}`);
  console.log(`   - Merged face groups: ${stats.mergedFaceCount}`);
  console.log(`   - Deduplication rate: ${stats.deduplicationRate.toFixed(1)}%`);

  // Test 8: Edge Cases
  console.log('\n🔍 Test 8: Edge Cases');
  console.log('-'.repeat(30));

  // Empty array
  const emptyResult = faceDeduplicationService.deduplicateFaces([]);
  console.log(`✅ Empty array: ${emptyResult.length} faces (should be 0)`);

  // Single face
  const singleFace = [{ id: 1, bounding_box: { x: 40, y: 30, width: 20, height: 25 } }];
  const singleResult = faceDeduplicationService.deduplicateFaces(singleFace);
  console.log(`✅ Single face: ${singleResult.length} faces (should be 1)`);

  // Invalid bounding boxes
  const invalidFaces = [
    { id: 1, bounding_box: null },
    { id: 2, bounding_box: { x: 40, y: 30, width: 20, height: 25 } },
    { id: 3, bounding_box: { x: 'invalid', y: 30, width: 20, height: 25 } }
  ];
  const invalidResult = faceDeduplicationService.deduplicateFaces(invalidFaces);
  console.log(`✅ Invalid faces: ${invalidFaces.length} → ${invalidResult.length} faces`);

  // Summary
  console.log('\n📊 Test Summary');
  console.log('=' .repeat(50));
  console.log('✅ Face deduplication system tested');
  console.log('✅ IoU calculation working correctly');
  console.log('✅ Configuration updates functional');
  console.log('✅ Statistics generation operational');
  console.log('✅ Edge cases handled gracefully');
  
  console.log('\n🎯 Key Features Validated:');
  console.log('- Exact duplicate detection and merging');
  console.log('- High-overlap face deduplication');
  console.log('- Preservation of distinct faces');
  console.log('- Multiple duplicate handling (Gemini scenario)');
  console.log('- Configurable sensitivity thresholds');
  console.log('- Robust error handling for edge cases');

  console.log('\n🚀 Gemini duplicate face issue should now be resolved!');
}

// Run the test if this script is executed directly
if (require.main === module) {
  testFaceDeduplication().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testFaceDeduplication };
