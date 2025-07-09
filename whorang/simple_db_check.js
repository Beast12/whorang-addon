const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function checkDatabase() {
  console.log('=== WhoRang Database Check ===');
  
  const dbPath = '/home/koen/Personal/ha-dev/whorang-data/whorang.db';
  
  try {
    // Check face recognition config
    console.log('🔍 Checking face recognition configuration...');
    const configQuery = `SELECT ai_provider, enabled, openai_model, ollama_model, ollama_url FROM face_recognition_config LIMIT 1;`;
    const { stdout: configResult } = await execAsync(`sqlite3 "${dbPath}" "${configQuery}"`);
    
    if (configResult.trim()) {
      const [ai_provider, enabled, openai_model, ollama_model, ollama_url] = configResult.trim().split('|');
      console.log('✅ Face recognition config found:');
      console.log(`   Provider: ${ai_provider}`);
      console.log(`   Enabled: ${enabled}`);
      console.log(`   OpenAI Model: ${openai_model || 'N/A'}`);
      console.log(`   Ollama Model: ${ollama_model || 'N/A'}`);
      console.log(`   Ollama URL: ${ollama_url || 'N/A'}`);
    } else {
      console.log('❌ No face recognition config found');
      return;
    }
    
    // Check recent doorbell events
    console.log('\n🔍 Checking recent doorbell events...');
    const eventsQuery = `SELECT id, image_url, faces_detected, faces_processed, created_at FROM doorbell_events WHERE image_url IS NOT NULL ORDER BY created_at DESC LIMIT 3;`;
    const { stdout: eventsResult } = await execAsync(`sqlite3 "${dbPath}" "${eventsQuery}"`);
    
    if (eventsResult.trim()) {
      console.log('✅ Recent events found:');
      const events = eventsResult.trim().split('\n');
      events.forEach((event, index) => {
        const [id, image_url, faces_detected, faces_processed, created_at] = event.split('|');
        console.log(`   Event ${id}:`);
        console.log(`     Image: ${image_url}`);
        console.log(`     Faces detected: ${faces_detected}`);
        console.log(`     Faces processed: ${faces_processed}`);
        console.log(`     Created: ${created_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No recent events found');
      return;
    }
    
    // Check detected faces with bounding boxes
    console.log('🔍 Checking detected faces and bounding boxes...');
    const facesQuery = `SELECT id, visitor_event_id, bounding_box, confidence, quality_score, person_id FROM detected_faces ORDER BY id DESC LIMIT 5;`;
    const { stdout: facesResult } = await execAsync(`sqlite3 "${dbPath}" "${facesQuery}"`);
    
    if (facesResult.trim()) {
      console.log('✅ Recent detected faces:');
      const faces = facesResult.trim().split('\n');
      faces.forEach((face, index) => {
        const [id, visitor_event_id, bounding_box, confidence, quality_score, person_id] = face.split('|');
        console.log(`   Face ${id}:`);
        console.log(`     Event ID: ${visitor_event_id}`);
        console.log(`     Bounding Box: ${bounding_box}`);
        console.log(`     Confidence: ${confidence}%`);
        console.log(`     Quality Score: ${quality_score}`);
        console.log(`     Person ID: ${person_id || 'Unassigned'}`);
        
        // Check if this is a default bounding box
        if (bounding_box && bounding_box.includes('"x":25') && bounding_box.includes('"y":25') && 
            bounding_box.includes('"width":50') && bounding_box.includes('"height":50')) {
          console.log(`     ⚠️  WARNING: Using default bounding box!`);
        }
        console.log('');
      });
    } else {
      console.log('❌ No detected faces found');
    }
    
    // Count total faces
    console.log('📊 Face statistics:');
    const totalFacesQuery = `SELECT COUNT(*) FROM detected_faces;`;
    const { stdout: totalFaces } = await execAsync(`sqlite3 "${dbPath}" "${totalFacesQuery}"`);
    console.log(`   Total detected faces: ${totalFaces.trim()}`);
    
    const unassignedFacesQuery = `SELECT COUNT(*) FROM detected_faces WHERE person_id IS NULL;`;
    const { stdout: unassignedFaces } = await execAsync(`sqlite3 "${dbPath}" "${unassignedFacesQuery}"`);
    console.log(`   Unassigned faces: ${unassignedFaces.trim()}`);
    
    const assignedFacesQuery = `SELECT COUNT(*) FROM detected_faces WHERE person_id IS NOT NULL;`;
    const { stdout: assignedFaces } = await execAsync(`sqlite3 "${dbPath}" "${assignedFacesQuery}"`);
    console.log(`   Assigned faces: ${assignedFaces.trim()}`);
    
    console.log('\n=== Database Check Complete ===');
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

checkDatabase();
