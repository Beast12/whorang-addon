const { createAIProvider } = require('./services/aiProviders');
const Database = require('better-sqlite3');
const path = require('path');

async function debugFaceDetection() {
  console.log('=== WhoRang Face Detection Debug ===');
  
  try {
    // Connect to the correct database location
    const dbPath = '/home/koen/Personal/ha-dev/whorang-data/whorang.db';
    console.log(`Connecting to database: ${dbPath}`);
    
    const db = new Database(dbPath);
    const configStmt = db.prepare('SELECT * FROM face_recognition_config LIMIT 1');
    const config = configStmt.get();
    
    if (!config) {
      console.log('❌ No face recognition config found');
      return;
    }
    
    console.log('✅ Face recognition config found:');
    console.log(`   Provider: ${config.ai_provider}`);
    console.log(`   Enabled: ${config.enabled}`);
    console.log(`   Model: ${config.openai_model || config.ollama_model || 'default'}`);
    
    // Get a recent visitor event with an image
    const eventStmt = db.prepare(`
      SELECT id, image_url, faces_detected, faces_processed 
      FROM doorbell_events 
      WHERE image_url IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    const event = eventStmt.get();
    
    if (!event) {
      console.log('❌ No recent visitor events with images found');
      return;
    }
    
    console.log(`\n✅ Testing with recent event: ${event.id}`);
    console.log(`   Image URL: ${event.image_url}`);
    console.log(`   Faces detected: ${event.faces_detected}`);
    console.log(`   Faces processed: ${event.faces_processed}`);
    
    // Create AI provider
    const aiProvider = createAIProvider(config.ai_provider, {
      api_key: config.api_key,
      ollama_url: config.ollama_url,
      ollama_model: config.ollama_model,
      openai_model: config.openai_model,
      claude_model: config.claude_model,
      cost_tracking_enabled: config.cost_tracking_enabled
    });
    
    console.log('\n🔍 Running face detection...');
    const startTime = Date.now();
    
    // Run face detection
    const results = await aiProvider.detectFaces(event.image_url, event.id);
    
    const processingTime = Date.now() - startTime;
    console.log(`⏱️  Processing completed in ${processingTime}ms`);
    
    console.log('\n📊 Face Detection Results:');
    console.log(`   Faces detected: ${results.faces_detected}`);
    console.log(`   Objects detected: ${results.objects_detected?.length || 0}`);
    console.log(`   Overall confidence: ${results.scene_analysis?.overall_confidence || 'N/A'}`);
    
    if (results.faces_detected > 0) {
      console.log('\n👤 Face Details:');
      results.faces.forEach((face, index) => {
        console.log(`   Face ${index + 1}:`);
        console.log(`     ID: ${face.id}`);
        console.log(`     Bounding Box: x=${face.bounding_box.x}%, y=${face.bounding_box.y}%, w=${face.bounding_box.width}%, h=${face.bounding_box.height}%`);
        console.log(`     Confidence: ${face.confidence}%`);
        console.log(`     Quality: ${face.quality}`);
        console.log(`     Description: ${face.description}`);
        
        // Check if this is a default/fallback bounding box
        if (face.bounding_box.x === 25 && face.bounding_box.y === 25 && 
            face.bounding_box.width === 50 && face.bounding_box.height === 50) {
          console.log(`     ⚠️  WARNING: Using default bounding box - AI didn't provide real coordinates!`);
        }
      });
    }
    
    if (results.objects_detected && results.objects_detected.length > 0) {
      console.log('\n🎯 Objects Detected:');
      results.objects_detected.forEach((obj, index) => {
        console.log(`   ${index + 1}. ${obj.object} (${obj.confidence}% confidence)`);
      });
    }
    
    console.log('\n🎬 Scene Analysis:');
    console.log(`   Description: ${results.scene_analysis?.description || 'N/A'}`);
    console.log(`   Lighting: ${results.scene_analysis?.lighting || 'N/A'}`);
    console.log(`   Image Quality: ${results.scene_analysis?.image_quality || 'N/A'}`);
    
    // Check existing detected faces in database
    const facesStmt = db.prepare(`
      SELECT id, bounding_box, confidence, quality_score, person_id
      FROM detected_faces 
      WHERE visitor_event_id = ?
      ORDER BY id DESC
    `);
    const existingFaces = facesStmt.all(event.id);
    
    if (existingFaces.length > 0) {
      console.log(`\n💾 Existing faces in database for this event:`);
      existingFaces.forEach((face, index) => {
        const boundingBox = JSON.parse(face.bounding_box || '{}');
        console.log(`   Face ${face.id}:`);
        console.log(`     Bounding Box: x=${boundingBox.x}%, y=${boundingBox.y}%, w=${boundingBox.width}%, h=${boundingBox.height}%`);
        console.log(`     Confidence: ${face.confidence}%`);
        console.log(`     Quality Score: ${face.quality_score}`);
        console.log(`     Person ID: ${face.person_id || 'Unassigned'}`);
        
        // Check if this is a default/fallback bounding box
        if (boundingBox.x === 25 && boundingBox.y === 25 && 
            boundingBox.width === 50 && boundingBox.height === 50) {
          console.log(`     ⚠️  WARNING: Stored with default bounding box!`);
        }
      });
    }
    
    console.log('\n=== Debug Complete ===');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug
debugFaceDetection().then(() => {
  console.log('Debug script completed');
  process.exit(0);
}).catch(error => {
  console.error('Debug script failed:', error);
  process.exit(1);
});
