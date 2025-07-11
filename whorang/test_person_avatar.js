const { initializeDatabase, getDatabase } = require('./config/database');
const PersonController = require('./controllers/personController');
const express = require('express');
const http = require('http');

// Test script to verify person avatar functionality
async function testPersonAvatar() {
  console.log('🧪 Testing Person Avatar Functionality...\n');
  
  try {
    // 1. Initialize database first
    console.log('🔧 Initializing database...');
    initializeDatabase();
    const db = getDatabase();
    
    if (!db) {
      console.log('❌ Failed to initialize database');
      return;
    }
    
    // 2. Check database for persons and their faces
    
    console.log('📊 Checking database for persons...');
    const personsStmt = db.prepare('SELECT * FROM persons ORDER BY id');
    const persons = personsStmt.all();
    
    if (persons.length === 0) {
      console.log('❌ No persons found in database');
      return;
    }
    
    console.log(`✅ Found ${persons.length} persons:`);
    persons.forEach(person => {
      console.log(`   - ${person.name} (ID: ${person.id})`);
    });
    
    // 2. Check faces for each person
    console.log('\n🔍 Checking faces for each person...');
    for (const person of persons) {
      const facesStmt = db.prepare(`
        SELECT id, face_crop_path, thumbnail_path, quality_score
        FROM detected_faces 
        WHERE person_id = ? 
        ORDER BY quality_score DESC, created_at DESC
      `);
      const faces = facesStmt.all(person.id);
      
      console.log(`   ${person.name}: ${faces.length} faces`);
      if (faces.length > 0) {
        const bestFace = faces[0];
        console.log(`     Best face: ID ${bestFace.id}, Quality: ${bestFace.quality_score}, Path: ${bestFace.face_crop_path}`);
        
        // Check if file exists
        const fs = require('fs');
        const path = require('path');
        
        if (bestFace.face_crop_path) {
          let fullPath;
          if (path.isAbsolute(bestFace.face_crop_path)) {
            fullPath = path.join(process.cwd(), bestFace.face_crop_path.substring(1));
          } else {
            fullPath = path.resolve(bestFace.face_crop_path);
          }
          
          if (fs.existsSync(fullPath)) {
            console.log(`     ✅ Image file exists: ${fullPath}`);
          } else {
            console.log(`     ❌ Image file missing: ${fullPath}`);
          }
        }
      }
    }
    
    // 3. Test avatar endpoint directly
    console.log('\n🌐 Testing avatar endpoint...');
    
    // Create a minimal Express app to test the endpoint
    const app = express();
    const facesRouter = require('./routes/faces');
    app.use('/api/faces', facesRouter);
    
    const server = http.createServer(app);
    const port = 3002; // Use different port to avoid conflicts
    
    server.listen(port, () => {
      console.log(`Test server running on port ${port}`);
      
      // Test each person's avatar
      persons.forEach(async (person) => {
        const avatarUrl = `http://localhost:${port}/api/faces/persons/${person.id}/avatar`;
        console.log(`\n🔗 Testing avatar URL: ${avatarUrl}`);
        
        try {
          const response = await fetch(avatarUrl);
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            const contentLength = response.headers.get('content-length');
            console.log(`   ✅ Avatar endpoint works! Content-Type: ${contentType}, Size: ${contentLength} bytes`);
          } else {
            console.log(`   ❌ Avatar endpoint failed: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.log(`   Error: ${errorText}`);
          }
        } catch (error) {
          console.log(`   ❌ Request failed: ${error.message}`);
        }
      });
      
      // Close server after tests
      setTimeout(() => {
        server.close();
        console.log('\n✅ Test completed!');
      }, 2000);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPersonAvatar();
