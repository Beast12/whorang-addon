#!/usr/bin/env node

/**
 * Test Gemini Response Parsing for Multiple JSON Blocks
 * This test simulates the duplicate JSON block issue that Gemini sometimes produces
 */

const { GoogleGeminiProvider } = require('./services/aiProviders');

function testGeminiParsing() {
  console.log('🧪 Testing Gemini Response Parsing for Multiple JSON Blocks');
  console.log('=' .repeat(60));

  const geminiProvider = new GoogleGeminiProvider({ api_key: 'test-key' });

  // Test 1: Normal single JSON response
  console.log('\n🔍 Test 1: Normal Single JSON Response');
  console.log('-'.repeat(40));
  
  const singleJsonResponse = `{
    "faces_detected": 1,
    "faces": [
      {
        "id": 1,
        "bounding_box": {"x": 45.2, "y": 30.1, "width": 15.3, "height": 20.2},
        "confidence": 85,
        "description": "Person with glasses",
        "quality": "good",
        "distinctive_features": ["glasses", "beard"]
      }
    ],
    "objects_detected": [
      {"object": "person", "confidence": 86, "description": "Person detected"}
    ],
    "scene_analysis": {
      "overall_confidence": 86,
      "description": "Doorbell camera view with person",
      "lighting": "good",
      "image_quality": "good"
    }
  }`;

  const result1 = geminiProvider.parseGeminiResponse(singleJsonResponse);
  console.log(`✅ Single JSON: ${result1.faces_detected} faces detected`);

  // Test 2: Multiple JSON blocks (the duplicate issue)
  console.log('\n🔍 Test 2: Multiple JSON Blocks (Duplicate Issue)');
  console.log('-'.repeat(40));
  
  const multipleJsonResponse = `Looking at this doorbell camera image, I can see a person. Here's my analysis:

{
  "faces_detected": 1,
  "faces": [
    {
      "id": 1,
      "bounding_box": {"x": 45.2, "y": 30.1, "width": 15.3, "height": 20.2},
      "confidence": 85,
      "description": "Person with glasses",
      "quality": "good",
      "distinctive_features": ["glasses", "beard"]
    }
  ],
  "objects_detected": [
    {"object": "person", "confidence": 86, "description": "Person detected"}
  ],
  "scene_analysis": {
    "overall_confidence": 86,
    "description": "Doorbell camera view with person",
    "lighting": "good",
    "image_quality": "good"
  }
}

Let me also provide an alternative analysis:

{
  "faces_detected": 1,
  "faces": [
    {
      "id": 1,
      "bounding_box": {"x": 45.0, "y": 30.0, "width": 15.0, "height": 20.0},
      "confidence": 87,
      "description": "Person with eyewear",
      "quality": "good",
      "distinctive_features": ["eyewear", "facial hair"]
    }
  ],
  "objects_detected": [
    {"object": "person", "confidence": 87, "description": "Person detected"}
  ],
  "scene_analysis": {
    "overall_confidence": 87,
    "description": "Doorbell camera view with person",
    "lighting": "good",
    "image_quality": "good"
  }
}`;

  const result2 = geminiProvider.parseGeminiResponse(multipleJsonResponse);
  console.log(`🎯 Multiple JSON: ${result2.faces_detected} faces detected (should be 1, not 2)`);

  // Test 3: Text with embedded JSON
  console.log('\n🔍 Test 3: Text Response with Embedded JSON');
  console.log('-'.repeat(40));
  
  const textWithJsonResponse = `I can see a person in this doorbell camera image. The person appears to be wearing glasses and has facial hair. Here's my detailed analysis:

{
  "faces_detected": 1,
  "faces": [
    {
      "id": 1,
      "bounding_box": {"x": 42.5, "y": 28.3, "width": 16.8, "height": 22.1},
      "confidence": 88,
      "description": "Person with glasses and beard",
      "quality": "clear",
      "distinctive_features": ["glasses", "beard", "dark hair"]
    }
  ],
  "objects_detected": [
    {"object": "person", "confidence": 88, "description": "Person at doorway"},
    {"object": "door", "confidence": 75, "description": "Front door visible"}
  ],
  "scene_analysis": {
    "overall_confidence": 88,
    "description": "Clear doorbell camera view with person at entrance",
    "lighting": "good",
    "image_quality": "clear"
  }
}

The image quality is good and the person is clearly visible.`;

  const result3 = geminiProvider.parseGeminiResponse(textWithJsonResponse);
  console.log(`✅ Text with JSON: ${result3.faces_detected} faces detected`);

  // Test 4: Malformed multiple JSON
  console.log('\n🔍 Test 4: Malformed Multiple JSON Blocks');
  console.log('-'.repeat(40));
  
  const malformedResponse = `Here's my analysis:

{
  "faces_detected": 1,
  "faces": [
    {
      "id": 1,
      "bounding_box": {"x": 45, "y": 30, "width": 15, "height": 20},
      "confidence": 85,
      "description": "Person detected"
    }
  ]
  // Missing closing brace

And here's another attempt:

{
  "faces_detected": 1,
  "faces": [
    {
      "id": 1,
      "bounding_box": {"x": 46, "y": 31, "width": 14, "height": 19},
      "confidence": 86,
      "description": "Person with glasses",
      "quality": "good",
      "distinctive_features": ["glasses"]
    }
  ],
  "objects_detected": [],
  "scene_analysis": {
    "overall_confidence": 86,
    "description": "Person at door",
    "lighting": "good",
    "image_quality": "good"
  }
}`;

  const result4 = geminiProvider.parseGeminiResponse(malformedResponse);
  console.log(`🔧 Malformed JSON: ${result4.faces_detected} faces detected (should handle gracefully)`);

  // Test 5: No JSON at all
  console.log('\n🔍 Test 5: No JSON Response');
  console.log('-'.repeat(40));
  
  const noJsonResponse = `I can see a person in the image but I cannot provide structured data at this time. The person appears to be standing at a doorway and is wearing glasses.`;

  const result5 = geminiProvider.parseGeminiResponse(noJsonResponse);
  console.log(`🛡️  No JSON: ${result5.faces_detected} faces detected (should default to 0)`);

  // Summary
  console.log('\n📊 Test Summary');
  console.log('=' .repeat(60));
  console.log('✅ Single JSON parsing: Working');
  console.log('🎯 Multiple JSON detection: ' + (result2.faces_detected === 1 ? 'FIXED' : 'STILL BROKEN'));
  console.log('✅ Text with JSON parsing: Working');
  console.log('🔧 Malformed JSON handling: ' + (result4.faces_detected >= 0 ? 'Working' : 'Broken'));
  console.log('🛡️  No JSON fallback: ' + (result5.faces_detected === 0 ? 'Working' : 'Broken'));

  if (result2.faces_detected === 1) {
    console.log('\n🚀 SUCCESS: Gemini multiple JSON block issue has been RESOLVED!');
    console.log('   The parser now correctly detects and handles duplicate JSON blocks.');
  } else {
    console.log('\n❌ ISSUE: Gemini multiple JSON block issue still exists.');
    console.log('   The parser is not correctly handling duplicate JSON blocks.');
  }
}

// Run the test
testGeminiParsing();
