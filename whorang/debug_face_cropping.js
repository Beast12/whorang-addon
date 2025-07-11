const faceCroppingService = require('./services/faceCroppingService');
const { createAIProvider } = require('./services/aiProviders');

async function debugFaceCropping() {
  console.log('=== Face Cropping Debug ===');
  
  try {
    // Test with the actual doorbell image
    const imageUrl = 'http://192.168.86.162:8123/local/doorbell_snapshot.jpg';
    
    // Test with working Ollama
    console.log('\n🔍 Testing with Ollama AI...');
    const ollamaProvider = createAIProvider('local', {
      ollama_url: 'http://192.168.86.163:11434',
      ollama_model: 'llava-phi3:latest',
      cost_tracking_enabled: false
    });
    
    const ollamaResult = await ollamaProvider.detectFaces(imageUrl, 999);
    console.log('Ollama AI Result:');
    console.log('  Faces detected:', ollamaResult.faces_detected);
    
    if (ollamaResult.faces_detected > 0) {
      const face = ollamaResult.faces[0];
      console.log('  First face bounding box:', face.bounding_box);
      console.log('  First face confidence:', face.confidence);
      console.log('  First face description:', face.description);
      
      // Test the face cropping with this coordinate
      console.log('\n🖼️  Testing face cropping...');
      
      // Download and check image dimensions first
      const tempImagePath = await faceCroppingService.resolveImagePath(imageUrl);
      const { loadImage } = require('canvas');
      const image = await loadImage(tempImagePath);
      
      console.log('Original image dimensions:', image.width, 'x', image.height);
      
      // Manually trace the coordinate conversion
      const { x, y, width, height } = face.bounding_box;
      console.log('Raw coordinates from AI:', { x, y, width, height });
      
      // Check coordinate format detection
      let normalizedX, normalizedY, normalizedWidth, normalizedHeight;
      
      if (x <= 1.0 && y <= 1.0 && width <= 1.0 && height <= 1.0) {
        normalizedX = x;
        normalizedY = y;
        normalizedWidth = width;
        normalizedHeight = height;
        console.log('✅ Detected as normalized coordinates (0.0-1.0)');
      } else {
        normalizedX = x / 100;
        normalizedY = y / 100;
        normalizedWidth = width / 100;
        normalizedHeight = height / 100;
        console.log('✅ Detected as percentage coordinates (0-100), converting...');
      }
      
      console.log('Normalized coordinates:', { 
        x: normalizedX, 
        y: normalizedY, 
        width: normalizedWidth, 
        height: normalizedHeight 
      });
      
      // Convert to pixels
      const pixelX = Math.round(normalizedX * image.width);
      const pixelY = Math.round(normalizedY * image.height);
      const pixelWidth = Math.round(normalizedWidth * image.width);
      const pixelHeight = Math.round(normalizedHeight * image.height);
      
      console.log('Pixel coordinates:', { 
        x: pixelX, 
        y: pixelY, 
        width: pixelWidth, 
        height: pixelHeight 
      });
      
      // Check if coordinates are reasonable
      console.log('Coordinate validation:');
      console.log('  X within bounds:', pixelX >= 0 && pixelX < image.width);
      console.log('  Y within bounds:', pixelY >= 0 && pixelY < image.height);
      console.log('  Width reasonable:', pixelWidth > 0 && pixelWidth <= image.width);
      console.log('  Height reasonable:', pixelHeight > 0 && pixelHeight <= image.height);
      console.log('  Crop region within image:', (pixelX + pixelWidth) <= image.width && (pixelY + pixelHeight) <= image.height);
      
      // Test actual face cropping
      console.log('\n🎯 Attempting face crop extraction...');
      try {
        const faceCrops = await faceCroppingService.extractFaceCrops(
          imageUrl, 
          [face], 
          999
        );
        
        if (faceCrops.length > 0) {
          const crop = faceCrops[0];
          console.log('✅ Face crop created successfully:');
          console.log('  Path:', crop.faceCropPath);
          console.log('  Thumbnail:', crop.thumbnailPath);
          console.log('  Quality score:', crop.qualityScore);
          console.log('  Dimensions:', crop.originalFace);
        } else {
          console.log('❌ No face crops were created');
        }
      } catch (cropError) {
        console.error('❌ Face cropping failed:', cropError.message);
        console.error('Full error:', cropError);
      }
    } else {
      console.log('❌ No faces detected by Ollama');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugFaceCropping().then(() => {
  console.log('\n=== Face Cropping Debug Complete ===');
  process.exit(0);
}).catch(error => {
  console.error('Debug failed:', error);
  process.exit(1);
});
