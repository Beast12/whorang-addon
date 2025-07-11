const { createAIProvider } = require('./services/aiProviders');

async function testAIFaceDetection() {
  console.log('=== Testing AI Face Detection ===');
  
  try {
    // Test with your actual doorbell image
    const imageUrl = 'http://192.168.86.162:8123/local/doorbell_snapshot.jpg';
    
    // Test different AI providers to see which one works best
    const providers = [
      {
        name: 'OpenAI GPT-4o',
        type: 'openai',
        config: {
          api_key: process.env.OPENAI_API_KEY || 'test-key',
          openai_model: 'gpt-4o',
          cost_tracking_enabled: false
        }
      },
      {
        name: 'Local Ollama',
        type: 'local',
        config: {
          ollama_url: 'http://192.168.86.163:11434',
          ollama_model: 'llava-phi3:latest',
          cost_tracking_enabled: false
        }
      }
    ];
    
    for (const providerConfig of providers) {
      console.log(`\n🔍 Testing ${providerConfig.name}...`);
      
      try {
        const aiProvider = createAIProvider(providerConfig.type, providerConfig.config);
        
        console.log(`📸 Analyzing image: ${imageUrl}`);
        const startTime = Date.now();
        
        const result = await aiProvider.detectFaces(imageUrl, 999);
        
        const processingTime = Date.now() - startTime;
        console.log(`⏱️  Processing completed in ${processingTime}ms`);
        
        console.log(`\n📊 ${providerConfig.name} Results:`);
        console.log(`   Faces detected: ${result.faces_detected}`);
        console.log(`   Objects detected: ${result.objects_detected?.length || 0}`);
        console.log(`   Overall confidence: ${result.scene_analysis?.overall_confidence || 'N/A'}`);
        
        if (result.faces_detected > 0) {
          console.log('\n👤 Face Details:');
          result.faces.forEach((face, index) => {
            console.log(`   Face ${index + 1}:`);
            console.log(`     ID: ${face.id}`);
            console.log(`     Bounding Box: x=${face.bounding_box.x}, y=${face.bounding_box.y}, w=${face.bounding_box.width}, h=${face.bounding_box.height}`);
            console.log(`     Confidence: ${face.confidence}%`);
            console.log(`     Quality: ${face.quality}`);
            console.log(`     Description: ${face.description}`);
            
            // Check if this is a default/fallback bounding box
            if (face.bounding_box.x === 25 && face.bounding_box.y === 25 && 
                face.bounding_box.width === 50 && face.bounding_box.height === 50) {
              console.log(`     ⚠️  WARNING: Using default bounding box - AI failed to provide coordinates!`);
            } else if (face.bounding_box.x === 40 && face.bounding_box.y === 30 && 
                       face.bounding_box.width === 20 && face.bounding_box.height === 30) {
              console.log(`     ⚠️  WARNING: Using suspicious coordinates - may be AI hallucination!`);
            } else {
              console.log(`     ✅ Custom coordinates provided by AI`);
            }
          });
        } else {
          console.log('   No faces detected by this provider');
        }
        
        if (result.objects_detected && result.objects_detected.length > 0) {
          console.log('\n🎯 Objects Detected:');
          result.objects_detected.slice(0, 5).forEach((obj, index) => {
            console.log(`   ${index + 1}. ${obj.object} (${obj.confidence}% confidence) - ${obj.description}`);
          });
        }
        
        console.log('\n🎬 Scene Analysis:');
        console.log(`   Description: ${result.scene_analysis?.description || 'N/A'}`);
        console.log(`   Lighting: ${result.scene_analysis?.lighting || 'N/A'}`);
        console.log(`   Image Quality: ${result.scene_analysis?.image_quality || 'N/A'}`);
        
      } catch (error) {
        console.error(`❌ ${providerConfig.name} failed:`, error.message);
      }
    }
    
    console.log('\n=== AI Face Detection Test Complete ===');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAIFaceDetection().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
