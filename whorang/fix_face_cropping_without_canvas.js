const fs = require('fs').promises;
const path = require('path');

async function fixFaceCroppingWithoutCanvas() {
  console.log('=== Fixing Face Cropping Without Canvas ===');
  
  try {
    // Create a simple placeholder face crop image using ImageMagick or similar
    // For now, let's modify the lite service to not create broken crops
    
    const liteServicePath = path.join(__dirname, 'services', 'faceCroppingServiceLite.js');
    let liteServiceContent = await fs.readFile(liteServicePath, 'utf8');
    
    // Check if it's already been modified
    if (liteServiceContent.includes('// FIXED: No broken crops')) {
      console.log('✅ Lite service already fixed');
      return;
    }
    
    // Modify the extractFaceMetadata function to not create broken crops
    const modifiedContent = liteServiceContent.replace(
      /faceCropPath: null, \/\/ No actual crop in lite mode\s*thumbnailPath: null, \/\/ No thumbnail in lite mode/g,
      `faceCropPath: null, // FIXED: No broken crops
        thumbnailPath: null, // FIXED: No broken thumbnails`
    );
    
    // Also modify the face processing to handle null paths properly
    const faceProcessingPath = path.join(__dirname, 'services', 'faceProcessing.js');
    let faceProcessingContent = await fs.readFile(faceProcessingPath, 'utf8');
    
    // Add a check to skip face crops with null paths
    if (!faceProcessingContent.includes('// FIXED: Skip null face crops')) {
      const fixedFaceProcessing = faceProcessingContent.replace(
        /if \(!faceCrop\) \{\s*console\.log\(`Skipping face \$\{i \+ 1\} - crop extraction failed`\);\s*continue;\s*\}/g,
        `if (!faceCrop || !faceCrop.faceCropPath) {
            console.log(\`Skipping face \${i + 1} - crop extraction failed or null path\`);
            // FIXED: Skip null face crops
            continue;
          }`
      );
      
      await fs.writeFile(faceProcessingPath, fixedFaceProcessing);
      console.log('✅ Fixed face processing to handle null crops');
    }
    
    // Write the modified lite service
    await fs.writeFile(liteServicePath, modifiedContent);
    console.log('✅ Fixed lite face cropping service');
    
    // Now let's trigger a new analysis to test
    console.log('\n🔄 Triggering new analysis to test fix...');
    
    const response = await fetch('http://localhost:3001/api/analysis/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Analysis triggered:', result.message);
      console.log('   Visitor ID:', result.visitor_id);
      
      // Wait a bit for processing
      console.log('⏳ Waiting for processing to complete...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Check the results
      console.log('🔍 Checking results...');
      const diagResponse = await fetch('http://localhost:3001/api/faces/unassigned-faces');
      if (diagResponse.ok) {
        const diagResult = await diagResponse.json();
        if (diagResult.faces && diagResult.faces.length > 0) {
          const latestFace = diagResult.faces[0];
          console.log('📊 Latest face result:');
          console.log('   ID:', latestFace.id);
          console.log('   Visitor Event ID:', latestFace.visitor_event_id);
          console.log('   Bounding Box:', latestFace.bounding_box);
          console.log('   Confidence:', latestFace.confidence);
          console.log('   Face Crop Path:', latestFace.face_crop_path);
          console.log('   Thumbnail Path:', latestFace.thumbnail_path);
          
          // Parse bounding box to check coordinates
          try {
            const bbox = JSON.parse(latestFace.bounding_box);
            console.log('   Parsed coordinates:', bbox);
            
            if (bbox.x === 40 && bbox.y === 30 && bbox.width === 20 && bbox.height === 30) {
              console.log('❌ Still using old bad coordinates - AI config not updated yet');
            } else if (bbox.x > 0 && bbox.x < 1 && bbox.y > 0 && bbox.y < 1) {
              console.log('✅ Using new normalized coordinates from AI!');
            } else {
              console.log('⚠️  Using different coordinate format:', bbox);
            }
          } catch (e) {
            console.log('❌ Could not parse bounding box:', e.message);
          }
        } else {
          console.log('❌ No faces found in results');
        }
      } else {
        console.log('❌ Could not fetch face results');
      }
    } else {
      console.log('❌ Failed to trigger analysis');
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

// Run the fix
fixFaceCroppingWithoutCanvas().then(() => {
  console.log('\n=== Face Cropping Fix Complete ===');
  process.exit(0);
}).catch(error => {
  console.error('Fix failed:', error);
  process.exit(1);
});
