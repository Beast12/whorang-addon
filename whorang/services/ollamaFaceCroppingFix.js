/**
 * Ollama Face Cropping Fix
 * Improves face cropping accuracy for Ollama by implementing intelligent coordinate correction
 */

class OllamaFaceCroppingFix {
  constructor() {
    this.debugMode = true;
  }

  /**
   * Fix Ollama face coordinates to produce tighter, more accurate crops
   * @param {Array} faces - Array of face objects from Ollama
   * @param {Object} imageInfo - Image dimensions and metadata
   * @returns {Array} Fixed face objects with improved coordinates
   */
  fixOllamaFaceCoordinates(faces, imageInfo = {}) {
    if (!faces || !Array.isArray(faces)) {
      return [];
    }

    console.log(`🔧 Ollama Face Cropping Fix: Processing ${faces.length} faces`);

    return faces.map((face, index) => {
      const originalBbox = face.bounding_box;
      
      if (this.debugMode) {
        console.log(`Face ${index + 1} original coordinates:`, originalBbox);
      }

      // Check if this is a default/fallback bounding box
      if (this.isDefaultBoundingBox(originalBbox)) {
        console.warn(`⚠️  Face ${index + 1}: Detected default/fallback coordinates - applying intelligent correction`);
        
        // Apply intelligent fallback coordinates
        const improvedBbox = this.generateIntelligentFallback(face, imageInfo, index);
        
        return {
          ...face,
          bounding_box: improvedBbox,
          coordinate_source: 'intelligent_fallback',
          original_bounding_box: originalBbox
        };
      }

      // Check if coordinates are too loose/wide
      if (this.isLooseBoundingBox(originalBbox)) {
        console.warn(`⚠️  Face ${index + 1}: Detected loose coordinates - applying tightening`);
        
        // Apply coordinate tightening
        const tightenedBbox = this.tightenBoundingBox(originalBbox, face);
        
        return {
          ...face,
          bounding_box: tightenedBbox,
          coordinate_source: 'tightened',
          original_bounding_box: originalBbox
        };
      }

      // Coordinates look reasonable, apply minor validation
      const validatedBbox = this.validateAndCleanCoordinates(originalBbox);
      
      return {
        ...face,
        bounding_box: validatedBbox,
        coordinate_source: 'validated',
        original_bounding_box: originalBbox
      };
    });
  }

  /**
   * Check if bounding box is a known default/fallback value
   */
  isDefaultBoundingBox(bbox) {
    if (!bbox || typeof bbox !== 'object') {
      return true;
    }

    const { x, y, width, height } = bbox;

    // Known problematic default bounding boxes
    const defaultPatterns = [
      { x: 25, y: 25, width: 50, height: 50 },    // Common Ollama fallback
      { x: 0, y: 0, width: 100, height: 100 },    // Full image fallback
      { x: 20, y: 20, width: 60, height: 60 },    // Another common pattern
      { x: 30, y: 30, width: 40, height: 40 },    // Center crop pattern
    ];

    // Check for exact matches
    for (const pattern of defaultPatterns) {
      if (x === pattern.x && y === pattern.y && 
          width === pattern.width && height === pattern.height) {
        return true;
      }
    }

    // Check for suspiciously round numbers (likely placeholders)
    const allRoundNumbers = [x, y, width, height].every(val => val % 5 === 0);
    if (allRoundNumbers && width >= 40 && height >= 40) {
      console.warn(`Suspicious round coordinates detected: ${JSON.stringify(bbox)}`);
      return true;
    }

    return false;
  }

  /**
   * Check if bounding box is too loose/wide
   */
  isLooseBoundingBox(bbox) {
    if (!bbox) return false;

    let { width, height } = bbox;

    // Normalize coordinates if they're in percentage format
    if (width > 1.0 || height > 1.0) {
      width = width / 100;
      height = height / 100;
    }

    // Consider it loose if it's taking up more than 50% of image width/height
    // or if the aspect ratio is very wide/tall (not face-like)
    const aspectRatio = width / height;
    
    // More lenient thresholds - only flag really problematic boxes
    return (
      width > 0.5 || height > 0.5 ||  // Too large (more than 50% of image)
      aspectRatio < 0.3 || aspectRatio > 3.0  // Very wrong aspect ratio for faces
    );
  }

  /**
   * Tighten loose bounding boxes to focus more on the face
   */
  tightenBoundingBox(bbox, faceInfo = {}) {
    const { x, y, width, height } = bbox;

    // Calculate tightening factors based on face confidence and description
    let tighteningFactor = 0.7; // Default: reduce size by 30%

    // Adjust based on confidence
    if (faceInfo.confidence > 80) {
      tighteningFactor = 0.6; // More aggressive tightening for high confidence
    } else if (faceInfo.confidence < 50) {
      tighteningFactor = 0.8; // Less aggressive for low confidence
    }

    // Adjust based on description keywords
    if (faceInfo.description) {
      const desc = faceInfo.description.toLowerCase();
      if (desc.includes('clear') || desc.includes('frontal')) {
        tighteningFactor *= 0.9; // Tighten more for clear faces
      }
      if (desc.includes('profile') || desc.includes('side')) {
        tighteningFactor *= 1.1; // Tighten less for profile views
      }
    }

    // Calculate new dimensions
    const newWidth = width * tighteningFactor;
    const newHeight = height * tighteningFactor;

    // Center the tightened box
    const newX = x + (width - newWidth) / 2;
    const newY = y + (height - newHeight) / 2;

    const tightened = {
      x: Math.max(0, newX),
      y: Math.max(0, newY),
      width: Math.min(newWidth, 100 - newX),
      height: Math.min(newHeight, 100 - newY)
    };

    if (this.debugMode) {
      console.log(`Tightening: ${JSON.stringify(bbox)} -> ${JSON.stringify(tightened)} (factor: ${tighteningFactor})`);
    }

    return tightened;
  }

  /**
   * Generate intelligent fallback coordinates when Ollama provides defaults
   */
  generateIntelligentFallback(faceInfo, imageInfo, faceIndex) {
    // Create more realistic face coordinates based on common face positions
    const facePositions = [
      { x: 35, y: 20, width: 30, height: 40 },  // Upper center
      { x: 20, y: 25, width: 25, height: 35 },  // Left side
      { x: 55, y: 25, width: 25, height: 35 },  // Right side
      { x: 40, y: 35, width: 20, height: 30 },  // Center
      { x: 15, y: 15, width: 35, height: 45 },  // Left upper
      { x: 50, y: 15, width: 35, height: 45 },  // Right upper
    ];

    // Use face index to select different positions for multiple faces
    const basePosition = facePositions[faceIndex % facePositions.length];

    // Add some randomization to avoid identical crops
    const randomOffset = (Math.random() - 0.5) * 10; // ±5% random offset

    const fallback = {
      x: Math.max(0, Math.min(95, basePosition.x + randomOffset)),
      y: Math.max(0, Math.min(95, basePosition.y + randomOffset)),
      width: Math.max(15, Math.min(40, basePosition.width)),
      height: Math.max(20, Math.min(50, basePosition.height))
    };

    // Adjust based on face confidence if available
    if (faceInfo.confidence) {
      if (faceInfo.confidence > 70) {
        // High confidence - make crop smaller and more focused
        fallback.width *= 0.8;
        fallback.height *= 0.8;
        fallback.x += fallback.width * 0.1;
        fallback.y += fallback.height * 0.1;
      }
    }

    if (this.debugMode) {
      console.log(`Generated intelligent fallback for face ${faceIndex + 1}:`, fallback);
    }

    return fallback;
  }

  /**
   * Validate and clean coordinates
   */
  validateAndCleanCoordinates(bbox) {
    if (!bbox) {
      return { x: 0.4, y: 0.3, width: 0.2, height: 0.3 }; // Safe default in normalized format
    }

    let { x, y, width, height } = bbox;

    // Ensure all values are numbers
    x = Number(x) || 0;
    y = Number(y) || 0;
    width = Number(width) || 0.2;
    height = Number(height) || 0.3;

    // Detect coordinate format and normalize
    if (x > 1.0 || y > 1.0 || width > 1.0 || height > 1.0) {
      // Percentage coordinates (0-100), convert to normalized (0-1)
      x = x / 100;
      y = y / 100;
      width = width / 100;
      height = height / 100;
      console.log(`Converted percentage coordinates to normalized: x=${x}, y=${y}, w=${width}, h=${height}`);
    }

    // Ensure minimum reasonable size (in normalized coordinates)
    width = Math.max(width, 0.05); // At least 5% of image
    height = Math.max(height, 0.08); // At least 8% of image

    // Ensure coordinates are within bounds (normalized 0-1)
    x = Math.max(0, Math.min(x, 1.0 - width));
    y = Math.max(0, Math.min(y, 1.0 - height));

    return { x, y, width, height };
  }

  /**
   * Apply enhanced face cropping logic specifically for Ollama
   */
  enhanceFaceCropping(faceCropParams) {
    const { boundingBox, imageWidth, imageHeight, faceInfo } = faceCropParams;

    // Apply Ollama-specific cropping enhancements
    let enhancedBbox = { ...boundingBox };

    // For Ollama, we often need to be more aggressive about cropping
    // since it tends to provide loose coordinates

    // Calculate crop tightening based on image size
    const imageSizeFactor = Math.min(imageWidth, imageHeight) / 1000; // Normalize to typical image size
    const tighteningFactor = Math.max(0.6, Math.min(0.9, imageSizeFactor));

    // Apply tightening
    const centerX = enhancedBbox.x + enhancedBbox.width / 2;
    const centerY = enhancedBbox.y + enhancedBbox.height / 2;

    enhancedBbox.width *= tighteningFactor;
    enhancedBbox.height *= tighteningFactor;
    enhancedBbox.x = centerX - enhancedBbox.width / 2;
    enhancedBbox.y = centerY - enhancedBbox.height / 2;

    // Ensure bounds
    enhancedBbox.x = Math.max(0, enhancedBbox.x);
    enhancedBbox.y = Math.max(0, enhancedBbox.y);

    if (this.debugMode) {
      console.log(`Enhanced Ollama cropping: ${JSON.stringify(boundingBox)} -> ${JSON.stringify(enhancedBbox)}`);
    }

    return enhancedBbox;
  }

  /**
   * Get cropping statistics for debugging
   */
  getCroppingStats(originalFaces, fixedFaces) {
    const stats = {
      totalFaces: originalFaces.length,
      defaultsFixed: 0,
      coordinatesTightened: 0,
      coordinatesValidated: 0,
      averageImprovement: 0
    };

    fixedFaces.forEach(face => {
      switch (face.coordinate_source) {
        case 'intelligent_fallback':
          stats.defaultsFixed++;
          break;
        case 'tightened':
          stats.coordinatesTightened++;
          break;
        case 'validated':
          stats.coordinatesValidated++;
          break;
      }
    });

    return stats;
  }
}

// Create singleton instance
const ollamaFaceCroppingFix = new OllamaFaceCroppingFix();

module.exports = ollamaFaceCroppingFix;
