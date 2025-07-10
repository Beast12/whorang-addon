#!/usr/bin/env node

/**
 * Test script for Ollama Face Cropping Fix
 */

const ollamaFaceCroppingFix = require('./services/ollamaFaceCroppingFix');

function testOllamaFaceCroppingFix() {
  console.log('🧪 Testing Ollama Face Cropping Fix');
  console.log('===================================');

  // Test case 1: Default/fallback bounding boxes (the main issue)
  console.log('\n1. Testing default/fallback bounding box detection:');
  
  const defaultFaces = [
    {
      id: 1,
      bounding_box: { x: 25, y: 25, width: 50, height: 50 }, // Common Ollama fallback
      confidence: 70,
      description: 'Person detected',
      quality: 'unknown'
    },
    {
      id: 2,
      bounding_box: { x: 0, y: 0, width: 100, height: 100 }, // Full image fallback
      confidence: 60,
      description: 'Person detected',
      quality: 'poor'
    }
  ];

  const fixedDefaultFaces = ollamaFaceCroppingFix.fixOllamaFaceCoordinates(defaultFaces);
  
  console.log('Original faces:', defaultFaces.map(f => f.bounding_box));
  console.log('Fixed faces:', fixedDefaultFaces.map(f => f.bounding_box));
  console.log('Coordinate sources:', fixedDefaultFaces.map(f => f.coordinate_source));

  // Test case 2: Loose bounding boxes
  console.log('\n2. Testing loose bounding box tightening:');
  
  const looseFaces = [
    {
      id: 1,
      bounding_box: { x: 10, y: 10, width: 80, height: 70 }, // Too large
      confidence: 85,
      description: 'Clear frontal face',
      quality: 'clear'
    },
    {
      id: 2,
      bounding_box: { x: 20, y: 15, width: 60, height: 65 }, // Moderately loose
      confidence: 45,
      description: 'Blurry profile face',
      quality: 'poor'
    }
  ];

  const fixedLooseFaces = ollamaFaceCroppingFix.fixOllamaFaceCoordinates(looseFaces);
  
  console.log('Original loose faces:', looseFaces.map(f => f.bounding_box));
  console.log('Tightened faces:', fixedLooseFaces.map(f => f.bounding_box));
  console.log('Coordinate sources:', fixedLooseFaces.map(f => f.coordinate_source));

  // Test case 3: Good coordinates (should be minimally changed)
  console.log('\n3. Testing good coordinates (should be preserved):');
  
  const goodFaces = [
    {
      id: 1,
      bounding_box: { x: 35, y: 20, width: 25, height: 35 }, // Reasonable face crop
      confidence: 90,
      description: 'Clear face',
      quality: 'clear'
    },
    {
      id: 2,
      bounding_box: { x: 42, y: 28, width: 18, height: 24 }, // Another good crop
      confidence: 80,
      description: 'Good quality face',
      quality: 'good'
    }
  ];

  const fixedGoodFaces = ollamaFaceCroppingFix.fixOllamaFaceCoordinates(goodFaces);
  
  console.log('Original good faces:', goodFaces.map(f => f.bounding_box));
  console.log('Validated faces:', fixedGoodFaces.map(f => f.bounding_box));
  console.log('Coordinate sources:', fixedGoodFaces.map(f => f.coordinate_source));

  // Test case 4: Mixed scenario (realistic)
  console.log('\n4. Testing mixed scenario (realistic Ollama response):');
  
  const mixedFaces = [
    {
      id: 1,
      bounding_box: { x: 25, y: 25, width: 50, height: 50 }, // Default fallback
      confidence: 70,
      description: 'Person detected',
      quality: 'unknown'
    },
    {
      id: 2,
      bounding_box: { x: 15, y: 10, width: 70, height: 80 }, // Too loose
      confidence: 60,
      description: 'Person in background',
      quality: 'fair'
    },
    {
      id: 3,
      bounding_box: { x: 40, y: 30, width: 20, height: 25 }, // Good coordinates
      confidence: 85,
      description: 'Clear face',
      quality: 'clear'
    }
  ];

  const fixedMixedFaces = ollamaFaceCroppingFix.fixOllamaFaceCoordinates(mixedFaces);
  
  console.log('Original mixed faces:', mixedFaces.map(f => f.bounding_box));
  console.log('Fixed mixed faces:', fixedMixedFaces.map(f => f.bounding_box));
  console.log('Coordinate sources:', fixedMixedFaces.map(f => f.coordinate_source));

  // Get statistics
  console.log('\n5. Statistics:');
  const stats = ollamaFaceCroppingFix.getCroppingStats(mixedFaces, fixedMixedFaces);
  console.log('Cropping statistics:', stats);

  // Test individual detection methods
  console.log('\n6. Testing detection methods:');
  
  const testBoxes = [
    { x: 25, y: 25, width: 50, height: 50 }, // Default
    { x: 10, y: 10, width: 80, height: 70 }, // Loose
    { x: 40, y: 30, width: 20, height: 25 }, // Good
    { x: 30, y: 30, width: 40, height: 40 }, // Suspicious round numbers
  ];

  testBoxes.forEach((bbox, index) => {
    const isDefault = ollamaFaceCroppingFix.isDefaultBoundingBox(bbox);
    const isLoose = ollamaFaceCroppingFix.isLooseBoundingBox(bbox);
    console.log(`Box ${index + 1} ${JSON.stringify(bbox)}: Default=${isDefault}, Loose=${isLoose}`);
  });

  console.log('\n✅ Ollama Face Cropping Fix test completed!');
  console.log('\nExpected improvements:');
  console.log('- Default coordinates (25,25,50,50) → Intelligent fallback positions');
  console.log('- Loose coordinates → Tightened to focus on face');
  console.log('- Good coordinates → Minimal validation changes');
  console.log('- Better face crops with less background noise');
}

// Run the test
if (require.main === module) {
  testOllamaFaceCroppingFix();
}

module.exports = { testOllamaFaceCroppingFix };
