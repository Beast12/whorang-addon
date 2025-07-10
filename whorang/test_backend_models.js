#!/usr/bin/env node

/**
 * Test script to verify backend model discovery is working
 */

const http = require('http');

async function testBackendModels() {
  console.log('🔍 Testing Backend Model Discovery');
  console.log('==================================');
  
  try {
    // Test the backend endpoint
    console.log('\n1. Testing backend endpoint: /api/openai/models/local');
    
    const response = await makeRequest('http://localhost:8099/api/openai/models/local');
    
    if (response.error) {
      console.log('❌ Backend request failed:', response.error);
      return;
    }
    
    console.log('✅ Backend response received');
    console.log('Response:', JSON.stringify(response, null, 2));
    
    // Check if gemma3:1b is in the response
    const models = response.data || response.models || response;
    if (Array.isArray(models)) {
      console.log(`\n📋 Found ${models.length} models from backend:`);
      
      models.forEach((model, index) => {
        const modelName = typeof model === 'string' ? model : model.value || model.name;
        const modelLabel = typeof model === 'object' ? model.label : modelName;
        console.log(`${index + 1}. ${modelLabel} (${modelName})`);
      });
      
      // Check for gemma3:1b specifically
      const gemma3Model = models.find(model => {
        const modelName = typeof model === 'string' ? model : model.value || model.name;
        return modelName && modelName.toLowerCase().includes('gemma3:1b');
      });
      
      if (gemma3Model) {
        console.log('\n🎉 SUCCESS: gemma3:1b found in backend response!');
        console.log('Model details:', gemma3Model);
      } else {
        console.log('\n⚠️  WARNING: gemma3:1b not found in backend response');
        
        // Show any gemma models
        const gemmaModels = models.filter(model => {
          const modelName = typeof model === 'string' ? model : model.value || model.name;
          return modelName && modelName.toLowerCase().includes('gemma');
        });
        
        if (gemmaModels.length > 0) {
          console.log('Found these Gemma models:');
          gemmaModels.forEach(model => {
            const modelName = typeof model === 'string' ? model : model.value || model.name;
            console.log(`   - ${modelName}`);
          });
        }
      }
    } else {
      console.log('⚠️  Unexpected response format:', typeof models);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) {
            resolve({ error: `HTTP ${response.statusCode}: ${data}` });
            return;
          }
          
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (parseError) {
          resolve({ error: `Parse error: ${parseError.message}`, raw: data });
        }
      });
    });
    
    request.on('error', (error) => {
      resolve({ error: error.message });
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      resolve({ error: 'Request timeout' });
    });
  });
}

// Run the test
if (require.main === module) {
  testBackendModels().catch(console.error);
}

module.exports = { testBackendModels };
