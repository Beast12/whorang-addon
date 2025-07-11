#!/usr/bin/env node

/**
 * Test script to test the controller logic directly
 */

async function testControllerLogic() {
  console.log('🔍 Testing Controller Logic');
  console.log('===========================');
  
  try {
    // Import the LocalOllamaProvider
    const { LocalOllamaProvider } = require('./services/aiProviders');
    
    console.log('\n1. Testing LocalOllamaProvider.getAvailableModels with cache disabled...');
    
    // Test with cache disabled to avoid database issues
    const models = await LocalOllamaProvider.getAvailableModels('http://192.168.86.163:11434', false);
    
    console.log(`✅ Found ${models.length} models from LocalOllamaProvider:`);
    
    models.forEach((model, index) => {
      console.log(`${index + 1}. ${model.label} (${model.value})`);
    });
    
    // Test the specific model we're looking for
    const gemma3Model = models.find(model => model.value.includes('gemma3:1b'));
    if (gemma3Model) {
      console.log(`\n🎉 SUCCESS: Found gemma3:1b model!`);
      console.log(`   Label: ${gemma3Model.label}`);
      console.log(`   Value: ${gemma3Model.value}`);
      console.log(`   Recommended: ${gemma3Model.recommended}`);
    } else {
      console.log(`\n⚠️  WARNING: gemma3:1b not found in models list`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testControllerLogic().catch(console.error);
}

module.exports = { testControllerLogic };
