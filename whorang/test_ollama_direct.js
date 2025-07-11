#!/usr/bin/env node

/**
 * Test script to verify Ollama connection directly
 */

const http = require('http');

async function testOllamaConnection() {
  console.log('🔍 Testing Direct Ollama Connection');
  console.log('===================================');
  
  const ollamaUrl = 'http://192.168.86.163:11434';
  
  try {
    console.log(`\n1. Testing Ollama status at: ${ollamaUrl}`);
    
    const statusResponse = await makeRequest(`${ollamaUrl}`);
    console.log('✅ Ollama status:', statusResponse);
    
    console.log(`\n2. Testing Ollama models endpoint: ${ollamaUrl}/api/tags`);
    
    const modelsResponse = await makeRequest(`${ollamaUrl}/api/tags`);
    
    if (modelsResponse.error) {
      console.log('❌ Models request failed:', modelsResponse.error);
      return;
    }
    
    console.log('✅ Models response received');
    
    const models = modelsResponse.models || [];
    console.log(`\n📋 Found ${models.length} models:`);
    
    models.forEach((model, index) => {
      console.log(`${index + 1}. ${model.name} (${formatSize(model.size)})`);
    });
    
    // Test a specific model
    console.log(`\n3. Testing model generation with llava-phi3:latest`);
    
    const generateResponse = await makeRequest(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llava-phi3:latest',
        prompt: 'Hello, this is a test.',
        stream: false
      })
    });
    
    if (generateResponse.error) {
      console.log('❌ Generation test failed:', generateResponse.error);
    } else {
      console.log('✅ Generation test successful');
      console.log('Response:', generateResponse.response?.substring(0, 100) + '...');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000
    };
    
    const request = http.request(url, requestOptions, (response) => {
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
          
          // Try to parse as JSON, fallback to text
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (parseError) {
            resolve({ text: data });
          }
        } catch (error) {
          resolve({ error: `Parse error: ${error.message}`, raw: data });
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
    
    if (options.body) {
      request.write(options.body);
    }
    
    request.end();
  });
}

function formatSize(bytes) {
  if (!bytes) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Run the test
if (require.main === module) {
  testOllamaConnection().catch(console.error);
}

module.exports = { testOllamaConnection };
