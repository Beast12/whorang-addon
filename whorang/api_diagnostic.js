const http = require('http');

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runDiagnostics() {
  console.log('=== WhoRang API Diagnostics ===');
  console.log('Connecting to WhoRang backend at localhost:3001...\n');

  try {
    // Check if backend is running
    console.log('🔍 Checking backend status...');
    try {
      const statusResponse = await makeRequest('/api/status');
      console.log(`✅ Backend is running (HTTP ${statusResponse.status})`);
      if (statusResponse.data) {
        console.log('   Status data:', JSON.stringify(statusResponse.data, null, 2));
      }
    } catch (error) {
      console.log('❌ Backend status check failed:', error.message);
    }

    // Check face recognition config
    console.log('\n🔍 Checking face recognition configuration...');
    try {
      const configResponse = await makeRequest('/api/config/face-recognition');
      if (configResponse.status === 200) {
        console.log('✅ Face recognition config found:');
        const config = configResponse.data;
        console.log(`   Provider: ${config.ai_provider || 'N/A'}`);
        console.log(`   Enabled: ${config.enabled || 'N/A'}`);
        console.log(`   OpenAI Model: ${config.openai_model || 'N/A'}`);
        console.log(`   Ollama Model: ${config.ollama_model || 'N/A'}`);
        console.log(`   Ollama URL: ${config.ollama_url || 'N/A'}`);
      } else {
        console.log(`❌ Config request failed (HTTP ${configResponse.status})`);
      }
    } catch (error) {
      console.log('❌ Config check failed:', error.message);
    }

    // Check recent detected faces
    console.log('\n🔍 Checking recent detected faces...');
    try {
      const facesResponse = await makeRequest('/api/detected-faces/unassigned');
      if (facesResponse.status === 200) {
        console.log('✅ Unassigned faces response received:');
        const faces = facesResponse.data;
        
        if (Array.isArray(faces) && faces.length > 0) {
          console.log(`   Found ${faces.length} unassigned faces:`);
          faces.slice(0, 5).forEach((face, index) => {
            console.log(`   Face ${face.id}:`);
            console.log(`     Event ID: ${face.visitor_event_id}`);
            console.log(`     Confidence: ${face.confidence}%`);
            console.log(`     Quality Score: ${face.quality_score}`);
            console.log(`     Created: ${face.created_at}`);
            
            // Check bounding box if available
            if (face.bounding_box) {
              try {
                const bbox = typeof face.bounding_box === 'string' ? 
                  JSON.parse(face.bounding_box) : face.bounding_box;
                console.log(`     Bounding Box: x=${bbox.x}%, y=${bbox.y}%, w=${bbox.width}%, h=${bbox.height}%`);
                
                // Check if this is a default bounding box
                if (bbox.x === 25 && bbox.y === 25 && bbox.width === 50 && bbox.height === 50) {
                  console.log(`     ⚠️  WARNING: Using default bounding box!`);
                }
              } catch (e) {
                console.log(`     Bounding Box: ${face.bounding_box} (parse error)`);
              }
            }
            
            // Show face image URLs if available
            if (face.face_crop_path) {
              console.log(`     Face Crop: http://localhost:3001${face.face_crop_path}`);
            }
            if (face.thumbnail_path) {
              console.log(`     Thumbnail: http://localhost:3001${face.thumbnail_path}`);
            }
            console.log('');
          });
        } else {
          console.log('   No unassigned faces found');
          console.log('   Response data:', faces);
        }
      } else {
        console.log(`❌ Faces request failed (HTTP ${facesResponse.status})`);
        console.log('   Response:', facesResponse.data);
      }
    } catch (error) {
      console.log('❌ Faces check failed:', error.message);
    }

    // Check face detection statistics
    console.log('\n🔍 Checking face detection statistics...');
    try {
      const statsResponse = await makeRequest('/api/detected-faces/stats');
      if (statsResponse.status === 200) {
        console.log('✅ Face detection stats:');
        const stats = statsResponse.data;
        console.log('   Stats:', JSON.stringify(stats, null, 2));
      } else {
        console.log(`❌ Stats request failed (HTTP ${statsResponse.status})`);
      }
    } catch (error) {
      console.log('❌ Stats check failed:', error.message);
    }

    // Check recent doorbell events
    console.log('🔍 Checking recent doorbell events...');
    try {
      const eventsResponse = await makeRequest('/api/events/recent?limit=3');
      if (eventsResponse.status === 200) {
        console.log('✅ Recent events found:');
        const events = eventsResponse.data;
        
        if (Array.isArray(events) && events.length > 0) {
          events.forEach((event, index) => {
            console.log(`   Event ${event.id}:`);
            console.log(`     Image: ${event.image_url || 'N/A'}`);
            console.log(`     Faces detected: ${event.faces_detected || 0}`);
            console.log(`     Faces processed: ${event.faces_processed || 0}`);
            console.log(`     Created: ${event.created_at}`);
            console.log('');
          });
        } else {
          console.log('   No recent events found');
        }
      } else {
        console.log(`❌ Events request failed (HTTP ${eventsResponse.status})`);
      }
    } catch (error) {
      console.log('❌ Events check failed:', error.message);
    }

    // Check available API endpoints
    console.log('🔍 Testing common API endpoints...');
    const endpoints = [
      '/api/faces/persons',
      '/api/stats/faces',
      '/api/config',
      '/api/detected-faces'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await makeRequest(endpoint);
        console.log(`   ${endpoint}: HTTP ${response.status}`);
      } catch (error) {
        console.log(`   ${endpoint}: ERROR - ${error.message}`);
      }
    }

    console.log('\n=== API Diagnostics Complete ===');

  } catch (error) {
    console.error('❌ Diagnostics failed:', error);
  }
}

runDiagnostics();
