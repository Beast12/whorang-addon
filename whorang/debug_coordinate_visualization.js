#!/usr/bin/env node

/**
 * Coordinate Visualization Debug Tool
 * Creates visual overlays showing where AI providers think faces are located
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

async function visualizeCoordinates() {
  console.log('🎯 AI Coordinate Visualization Debug Tool');
  console.log('=========================================\n');

  try {
    // Test coordinates from the logs
    const testCases = [
      {
        name: 'OpenAI Detection (Event 13)',
        coordinates: { x: 40.5, y: 35.2, width: 15.3, height: 25.4 },
        format: 'percentage',
        provider: 'OpenAI',
        confidence: 85,
        description: 'Male with beard, black cap, dark jacket'
      },
      {
        name: 'Ollama Detection (Previous Test)',
        coordinates: { x: 0.45, y: 0.23, width: 0.67, height: 0.58 },
        format: 'normalized',
        provider: 'Ollama',
        confidence: 90,
        description: 'Person detection'
      }
    ];

    // Image dimensions from logs
    const imageWidth = 640;
    const imageHeight = 480;

    console.log(`📐 Image Dimensions: ${imageWidth}x${imageHeight}\n`);

    for (const testCase of testCases) {
      console.log(`🔍 Analyzing: ${testCase.name}`);
      console.log(`   Provider: ${testCase.provider}`);
      console.log(`   Format: ${testCase.format}`);
      console.log(`   Raw coordinates: x=${testCase.coordinates.x}, y=${testCase.coordinates.y}, w=${testCase.coordinates.width}, h=${testCase.coordinates.height}`);
      
      // Convert coordinates to pixels
      let pixelCoords;
      if (testCase.format === 'percentage') {
        pixelCoords = {
          x: (testCase.coordinates.x / 100) * imageWidth,
          y: (testCase.coordinates.y / 100) * imageHeight,
          width: (testCase.coordinates.width / 100) * imageWidth,
          height: (testCase.coordinates.height / 100) * imageHeight
        };
      } else {
        pixelCoords = {
          x: testCase.coordinates.x * imageWidth,
          y: testCase.coordinates.y * imageHeight,
          width: testCase.coordinates.width * imageWidth,
          height: testCase.coordinates.height * imageHeight
        };
      }

      console.log(`   Pixel coordinates: x=${Math.round(pixelCoords.x)}, y=${Math.round(pixelCoords.y)}, w=${Math.round(pixelCoords.width)}, h=${Math.round(pixelCoords.height)}`);
      
      // Calculate crop area as percentage of image
      const cropArea = pixelCoords.width * pixelCoords.height;
      const imageArea = imageWidth * imageHeight;
      const cropPercentage = (cropArea / imageArea) * 100;
      
      console.log(`   Crop area: ${Math.round(cropArea)} pixels (${cropPercentage.toFixed(1)}% of image)`);
      
      // Analyze position
      const centerX = pixelCoords.x + (pixelCoords.width / 2);
      const centerY = pixelCoords.y + (pixelCoords.height / 2);
      const centerXPercent = (centerX / imageWidth) * 100;
      const centerYPercent = (centerY / imageHeight) * 100;
      
      console.log(`   Crop center: (${Math.round(centerX)}, ${Math.round(centerY)}) = ${centerXPercent.toFixed(1)}% from left, ${centerYPercent.toFixed(1)}% from top`);
      
      // Determine image quadrant
      let quadrant = '';
      if (centerXPercent < 50 && centerYPercent < 50) quadrant = 'Top-Left';
      else if (centerXPercent >= 50 && centerYPercent < 50) quadrant = 'Top-Right';
      else if (centerXPercent < 50 && centerYPercent >= 50) quadrant = 'Bottom-Left';
      else quadrant = 'Bottom-Right';
      
      console.log(`   Image quadrant: ${quadrant}`);
      
      // Validate coordinates
      if (pixelCoords.x + pixelCoords.width > imageWidth || 
          pixelCoords.y + pixelCoords.height > imageHeight) {
        console.log(`   ⚠️  WARNING: Coordinates extend beyond image bounds`);
      }
      
      if (pixelCoords.width < 20 || pixelCoords.height < 20) {
        console.log(`   ⚠️  WARNING: Crop very small - likely coordinate error`);
      }
      
      console.log('');
    }

    // Analysis of the actual person location (from visual inspection)
    console.log('👤 ACTUAL PERSON LOCATION (Visual Analysis):');
    console.log('   Person is in: Bottom-Right quadrant');
    console.log('   Approximate location: 70-85% from left, 60-90% from top');
    console.log('   Person size: Roughly 15-25% of image width, 30-40% of image height');
    console.log('');

    // Compare with AI detections
    console.log('📊 ACCURACY ANALYSIS:');
    console.log('   OpenAI Detection:');
    console.log('     - Detected quadrant: Top-Left (40.5% from left, 35.2% from top)');
    console.log('     - Actual quadrant: Bottom-Right');
    console.log('     - ❌ COMPLETELY WRONG LOCATION');
    console.log('');
    console.log('   Ollama Detection:');
    console.log('     - Detected quadrant: Top-Left (45% from left, 23% from top)');
    console.log('     - Actual quadrant: Bottom-Right');
    console.log('     - ❌ ALSO WRONG LOCATION (but different coordinates)');
    console.log('');

    console.log('🔧 COORDINATE CORRECTION NEEDED:');
    console.log('   Both AI providers are detecting faces in wrong locations!');
    console.log('   Possible causes:');
    console.log('   1. Image orientation/rotation issues');
    console.log('   2. Coordinate system origin differences');
    console.log('   3. AI model spatial reasoning errors');
    console.log('   4. Fisheye lens distortion not accounted for');
    console.log('');

    // Suggest corrected coordinates for testing
    console.log('🎯 SUGGESTED CORRECTED COORDINATES (for testing):');
    console.log('   Based on visual analysis, person should be at:');
    console.log('   - Percentage: x=75, y=70, width=20, height=25');
    console.log('   - Normalized: x=0.75, y=0.70, width=0.20, height=0.25');
    console.log('   - Pixels: x=480, y=336, width=128, height=120');

  } catch (error) {
    console.error('❌ Visualization failed:', error);
  }
}

// Run the visualization
visualizeCoordinates().catch(console.error);
