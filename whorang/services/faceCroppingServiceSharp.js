const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const coordinateCorrection = require('./coordinateCorrection');
const uploadPaths = require('../utils/uploadPaths');

class FaceCroppingServiceSharp {
  constructor() {
    this.uploadsDir = uploadPaths.getBaseUploadPath();
    this.facesDir = uploadPaths.getFacesUploadPath();
    this.thumbnailsDir = uploadPaths.getThumbnailsUploadPath();
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      await fs.mkdir(this.facesDir, { recursive: true });
      await fs.mkdir(this.thumbnailsDir, { recursive: true });
      
      // Verify directories were created and are writable
      await this.validateDirectories();
      
      console.log('Sharp face cropping directories ensured and validated');
    } catch (error) {
      console.error('CRITICAL ERROR: Failed to create Sharp face cropping directories:', error);
      throw error; // Re-throw to prevent silent failures
    }
  }

  async validateDirectories() {
    const directories = [
      { path: this.uploadsDir, name: 'uploads' },
      { path: this.facesDir, name: 'faces' },
      { path: this.thumbnailsDir, name: 'thumbnails' }
    ];

    for (const dir of directories) {
      try {
        // Check if directory exists and is accessible
        const stats = await fs.stat(dir.path);
        if (!stats.isDirectory()) {
          throw new Error(`${dir.name} path exists but is not a directory: ${dir.path}`);
        }
        
        // Test write permissions by creating a temporary file
        const testFile = path.join(dir.path, '.write_test');
        try {
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);
        } catch (writeError) {
          // If write test fails, the directory might not exist or have wrong permissions
          console.warn(`Sharp: Write test failed for ${dir.name}, attempting to recreate directory`);
          await fs.mkdir(dir.path, { recursive: true });
          // Try write test again
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);
        }
        
        console.log(`Sharp: Directory validated: ${dir.name} (${dir.path})`);
      } catch (error) {
        console.error(`Sharp: Directory validation failed for ${dir.name}: ${error.message}`);
        throw new Error(`Cannot access or write to ${dir.name} directory: ${dir.path}`);
      }
    }
  }

  /**
   * Extract face crops from a full doorbell image using Sharp for precise cropping
   * @param {string} imageUrl - URL or path to the full image
   * @param {Array} faceDetections - Array of face detection results with bounding boxes
   * @param {number} visitorEventId - ID of the visitor event
   * @param {string} aiProvider - AI provider used for detection (for coordinate correction)
   * @returns {Array} Array of face crop information
   */
  async extractFaceCrops(imageUrl, faceDetections, visitorEventId, aiProvider = 'unknown') {
    try {
      console.log(`Sharp: Extracting ${faceDetections.length} face crops from image: ${imageUrl}`);
      
      // Load the full image and get metadata
      const fullImagePath = await this.resolveImagePath(imageUrl);
      const image = sharp(fullImagePath);
      const metadata = await image.metadata();
      
      console.log(`Sharp: Image metadata - ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
      
      const faceCrops = [];
      
      for (let i = 0; i < faceDetections.length; i++) {
        const face = faceDetections[i];
        const faceId = `${visitorEventId}_face_${i + 1}_${Date.now()}`;
        
        try {
          // Extract face crop using Sharp with AI provider context
          const faceCrop = await this.cropFaceWithSharp(fullImagePath, face.bounding_box, faceId, metadata, aiProvider);
          
          // Generate thumbnail
          const thumbnail = await this.generateThumbnailWithSharp(faceCrop.path, faceId);
          
          faceCrops.push({
            faceId,
            faceCropPath: faceCrop.path,
            thumbnailPath: thumbnail.path,
            boundingBox: face.bounding_box,
            confidence: face.confidence,
            qualityScore: this.calculateFaceQuality(face, metadata.width, metadata.height),
            originalFace: face,
            cropDimensions: faceCrop.dimensions
          });
          
          console.log(`Sharp: Face crop ${i + 1} extracted: ${faceCrop.path} (${faceCrop.dimensions.width}x${faceCrop.dimensions.height})`);
        } catch (error) {
          console.error(`Sharp: Error extracting face crop ${i + 1}:`, error);
        }
      }
      
      return faceCrops;
    } catch (error) {
      console.error('Sharp: Error in extractFaceCrops:', error);
      throw error;
    }
  }

  /**
   * Crop a single face from the full image using Sharp for pixel-perfect precision
   */
  async cropFaceWithSharp(imagePath, boundingBox, faceId, metadata, aiProvider = 'unknown') {
    const { x, y, width, height } = boundingBox;
    
    console.log(`Sharp: Processing bounding box: x=${x}, y=${y}, w=${width}, h=${height}`);
    console.log(`Sharp: Image dimensions: ${metadata.width}x${metadata.height}`);
    
    // ENHANCED: Detect coordinate format and apply AI provider corrections
    const normalizedCoords = this.normalizeCoordinates(boundingBox, metadata.width, metadata.height, aiProvider);
    const cropX = Math.round(normalizedCoords.x);
    const cropY = Math.round(normalizedCoords.y);
    const cropWidth = Math.round(normalizedCoords.width);
    const cropHeight = Math.round(normalizedCoords.height);
    
    console.log(`Sharp: Normalized pixel coordinates: x=${cropX}, y=${cropY}, w=${cropWidth}, h=${cropHeight}`);
    
    // Validate crop boundaries
    const finalX = Math.max(0, Math.min(cropX, metadata.width - 1));
    const finalY = Math.max(0, Math.min(cropY, metadata.height - 1));
    const finalWidth = Math.max(1, Math.min(cropWidth, metadata.width - finalX));
    const finalHeight = Math.max(1, Math.min(cropHeight, metadata.height - finalY));
    
    if (finalX !== cropX || finalY !== cropY || finalWidth !== cropWidth || finalHeight !== cropHeight) {
      console.log(`Sharp: Adjusted crop boundaries: x=${finalX}, y=${finalY}, w=${finalWidth}, h=${finalHeight}`);
    }
    
    // Add minimal padding for context (5% on each side)
    const paddingPercent = 0.05;
    const paddingX = Math.round(finalWidth * paddingPercent);
    const paddingY = Math.round(finalHeight * paddingPercent);
    
    const paddedX = Math.max(0, finalX - paddingX);
    const paddedY = Math.max(0, finalY - paddingY);
    const paddedWidth = Math.min(metadata.width - paddedX, finalWidth + (paddingX * 2));
    const paddedHeight = Math.min(metadata.height - paddedY, finalHeight + (paddingY * 2));
    
    console.log(`Sharp: Final crop with padding: x=${paddedX}, y=${paddedY}, w=${paddedWidth}, h=${paddedHeight}`);
    
    // Create output path
    const filename = `${faceId}.jpg`;
    const filepath = path.join(this.facesDir, filename);
    
    // Perform the precise crop using Sharp
    await sharp(imagePath)
      .extract({ 
        left: paddedX, 
        top: paddedY, 
        width: paddedWidth, 
        height: paddedHeight 
      })
      .jpeg({ quality: 90 })
      .toFile(filepath);
    
    // CRITICAL: Validate that the file was actually created
    await this.validateFileCreation(filepath, filename);
    
    return {
      path: uploadPaths.createFaceImageUrl(filename),
      filename,
      dimensions: { width: paddedWidth, height: paddedHeight }
    };
  }

  /**
   * Validate that a file was actually created and has reasonable content
   */
  async validateFileCreation(filepath, filename) {
    try {
      const stats = await fs.stat(filepath);
      
      if (!stats.isFile()) {
        throw new Error(`Created path is not a file: ${filepath}`);
      }
      
      if (stats.size === 0) {
        throw new Error(`Created file is empty: ${filename}`);
      }
      
      if (stats.size < 100) {
        console.warn(`Sharp: WARNING - Created file very small (${stats.size} bytes): ${filename}`);
      }
      
      console.log(`Sharp: File validation successful: ${filename} (${stats.size} bytes)`);
      
    } catch (error) {
      console.error(`Sharp: CRITICAL - File validation failed for ${filename}:`, error);
      throw new Error(`Face crop file creation failed: ${error.message}`);
    }
  }

  /**
   * Generate a thumbnail from a face crop using Sharp
   */
  async generateThumbnailWithSharp(faceCropPath, faceId) {
    const thumbnailSize = 150; // 150x150 thumbnail
    
    // Create thumbnail filename and path
    const filename = `thumb_${faceId}.jpg`;
    const filepath = path.join(this.thumbnailsDir, filename);
    
    // Get the full path to the face crop
    const fullFaceCropPath = path.join(__dirname, '..', faceCropPath);
    
    // Generate thumbnail with Sharp
    await sharp(fullFaceCropPath)
      .resize(thumbnailSize, thumbnailSize, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toFile(filepath);
    
    // Validate thumbnail creation
    await this.validateFileCreation(filepath, filename);
    
    return {
      path: uploadPaths.createThumbnailUrl(filename),
      filename,
      size: thumbnailSize
    };
  }

  /**
   * FIXED: Normalize coordinates from different formats to pixel coordinates
   * Handles both normalized (0.0-1.0) and percentage (0-100) coordinate formats
   * TRUST AI PROVIDERS - Only handle format conversion, no spatial corrections
   */
  normalizeCoordinates(boundingBox, imageWidth, imageHeight, aiProvider = 'unknown') {
    const { x, y, width, height } = boundingBox;
    
    console.log(`Sharp: Analyzing coordinates: x=${x}, y=${y}, w=${width}, h=${height}`);
    console.log(`Sharp: Image dimensions: ${imageWidth}x${imageHeight}`);
    console.log(`Sharp: AI Provider: ${aiProvider} (format detection only)`);
    
    // ONLY detect coordinate format and convert to pixels - NO spatial corrections
    let pixelCoords;
    const coords = boundingBox; // Use original coordinates directly
    
    // Check if coordinates are normalized (0.0-1.0)
    if (coords.x <= 1.0 && coords.y <= 1.0 && coords.width <= 1.0 && coords.height <= 1.0 && 
        (coords.x > 0 || coords.y > 0 || coords.width > 0 || coords.height > 0)) {
      
      console.log(`Sharp: Detected normalized coordinates (0.0-1.0)`);
      
      // CRITICAL FIX: Check if these are center-based coordinates
      // Many AI models return center coordinates, not top-left
      const centerX = coords.x * imageWidth;
      const centerY = coords.y * imageHeight;
      const faceWidth = coords.width * imageWidth;
      const faceHeight = coords.height * imageHeight;
      
      // Check if treating as center coordinates would make more sense
      const leftFromCenter = centerX - (faceWidth / 2);
      const topFromCenter = centerY - (faceHeight / 2);
      const rightFromCenter = centerX + (faceWidth / 2);
      const bottomFromCenter = centerY + (faceHeight / 2);
      
      // If center-based coordinates fit better within image bounds, use them
      if (leftFromCenter >= 0 && topFromCenter >= 0 && 
          rightFromCenter <= imageWidth && bottomFromCenter <= imageHeight) {
        
        console.log(`Sharp: Coordinates appear to be CENTER-based, converting...`);
        pixelCoords = {
          x: leftFromCenter,
          y: topFromCenter,
          width: faceWidth,
          height: faceHeight
        };
        
      } else {
        // Use as top-left coordinates
        console.log(`Sharp: Using as TOP-LEFT coordinates`);
        pixelCoords = {
          x: centerX,
          y: centerY,
          width: faceWidth,
          height: faceHeight
        };
      }
      
    } else if (coords.x <= 100 && coords.y <= 100 && coords.width <= 100 && coords.height <= 100) {
      // Percentage coordinates (0-100)
      console.log(`Sharp: Detected percentage coordinates (0-100)`);
      pixelCoords = {
        x: (coords.x / 100) * imageWidth,
        y: (coords.y / 100) * imageHeight,
        width: (coords.width / 100) * imageWidth,
        height: (coords.height / 100) * imageHeight
      };
      
    } else {
      // Assume pixel coordinates (though this is unusual for AI providers)
      console.log(`Sharp: Assuming pixel coordinates`);
      pixelCoords = { x: coords.x, y: coords.y, width: coords.width, height: coords.height };
    }
    
    // Step 3: Validate and clamp the resulting coordinates
    pixelCoords.x = Math.max(0, pixelCoords.x);
    pixelCoords.y = Math.max(0, pixelCoords.y);
    pixelCoords.width = Math.min(pixelCoords.width, imageWidth - pixelCoords.x);
    pixelCoords.height = Math.min(pixelCoords.height, imageHeight - pixelCoords.y);
    
    // Step 4: Final validation and reporting
    if (pixelCoords.width < 10 || pixelCoords.height < 10) {
      console.warn(`Sharp: WARNING - Face crop very small: ${pixelCoords.width}x${pixelCoords.height}px`);
      console.warn(`Sharp: Original coordinates: x=${x}, y=${y}, w=${width}, h=${height}`);
      console.warn(`Sharp: This may indicate coordinate format misinterpretation`);
    }
    
    if (pixelCoords.x + pixelCoords.width > imageWidth || 
        pixelCoords.y + pixelCoords.height > imageHeight) {
      console.warn(`Sharp: WARNING - Face crop still extends beyond image bounds after clamping`);
      console.warn(`Sharp: Crop: ${pixelCoords.x + pixelCoords.width}x${pixelCoords.y + pixelCoords.height}, Image: ${imageWidth}x${imageHeight}`);
    } else {
      console.log(`Sharp: ✅ Coordinates are within image bounds`);
    }
    
    console.log(`Sharp: Final coordinates: (${Math.round(pixelCoords.x)},${Math.round(pixelCoords.y)},${Math.round(pixelCoords.width)},${Math.round(pixelCoords.height)})`);
    
    // Return pixel coordinates with metadata (no corrections applied)
    return {
      ...pixelCoords,
      correctionApplied: false,
      appliedCorrections: [],
      originalCoordinates: boundingBox,
      aiProvider: aiProvider
    };
  }

  /**
   * Calculate face quality score based on various factors
   */
  calculateFaceQuality(face, imageWidth, imageHeight) {
    let qualityScore = 0.5; // Base score
    
    const { x, y, width, height } = face.bounding_box;
    
    // Size factor - larger faces are generally better quality
    const faceArea = (width / 100) * (height / 100); // Normalized area
    const sizeScore = Math.min(faceArea * 10, 1); // Normalize to 0-1
    qualityScore += sizeScore * 0.3;
    
    // Confidence factor
    const confidenceScore = face.confidence / 100;
    qualityScore += confidenceScore * 0.4;
    
    // Position factor - faces in center are often better quality
    const centerX = 50; // Center in percentage coordinates
    const centerY = 50;
    const faceX = x + (width / 2);
    const faceY = y + (height / 2);
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(faceX - centerX, 2) + Math.pow(faceY - centerY, 2)
    );
    const maxDistance = Math.sqrt(50 * 50 + 50 * 50); // Max distance from center
    const positionScore = Math.max(0, 1 - (distanceFromCenter / maxDistance));
    qualityScore += positionScore * 0.2;
    
    // Quality indicators from face description
    if (face.quality === 'clear') qualityScore += 0.1;
    if (face.description && face.description.includes('frontal')) qualityScore += 0.1;
    if (face.description && face.description.includes('profile')) qualityScore -= 0.1;
    if (face.description && face.description.includes('blurry')) qualityScore -= 0.2;
    
    return Math.max(0, Math.min(1, qualityScore));
  }

  /**
   * Generate face embedding using AI description
   */
  async generateFaceEmbedding(faceCropPath, faceDescription) {
    try {
      // For now, create a simple embedding based on description
      // In a real implementation, this would use a proper face embedding model
      const features = this.extractFeaturesFromDescription(faceDescription);
      
      // Create a simple numerical representation
      const embedding = this.createEmbeddingVector(features);
      
      return {
        embedding: embedding,
        features: features,
        method: 'description_based'
      };
    } catch (error) {
      console.error('Sharp: Error generating face embedding:', error);
      throw error;
    }
  }

  /**
   * Extract features from AI description
   */
  extractFeaturesFromDescription(description) {
    const features = {
      age_group: 'unknown',
      gender: 'unknown',
      has_glasses: false,
      has_beard: false,
      has_mustache: false,
      hair_color: 'unknown',
      skin_tone: 'unknown'
    };

    if (!description) return features;

    const desc = description.toLowerCase();

    // Age detection
    if (desc.includes('child') || desc.includes('kid')) features.age_group = 'child';
    else if (desc.includes('teen') || desc.includes('young')) features.age_group = 'young';
    else if (desc.includes('adult') || desc.includes('middle')) features.age_group = 'adult';
    else if (desc.includes('elderly') || desc.includes('senior')) features.age_group = 'elderly';

    // Gender detection
    if (desc.includes('male') && !desc.includes('female')) features.gender = 'male';
    else if (desc.includes('female')) features.gender = 'female';

    // Accessories
    features.has_glasses = desc.includes('glasses') || desc.includes('spectacles');
    features.has_beard = desc.includes('beard');
    features.has_mustache = desc.includes('mustache') || desc.includes('moustache');

    // Hair color
    if (desc.includes('blonde') || desc.includes('blond')) features.hair_color = 'blonde';
    else if (desc.includes('brown')) features.hair_color = 'brown';
    else if (desc.includes('black')) features.hair_color = 'black';
    else if (desc.includes('red') || desc.includes('ginger')) features.hair_color = 'red';
    else if (desc.includes('gray') || desc.includes('grey')) features.hair_color = 'gray';

    return features;
  }

  /**
   * Create embedding vector from features
   */
  createEmbeddingVector(features) {
    // Create a simple 32-dimensional vector based on features
    const vector = new Array(32).fill(0);

    // Age group encoding (positions 0-3)
    const ageGroups = ['child', 'young', 'adult', 'elderly'];
    const ageIndex = ageGroups.indexOf(features.age_group);
    if (ageIndex >= 0) vector[ageIndex] = 1;

    // Gender encoding (positions 4-5)
    if (features.gender === 'male') vector[4] = 1;
    else if (features.gender === 'female') vector[5] = 1;

    // Accessories (positions 6-8)
    if (features.has_glasses) vector[6] = 1;
    if (features.has_beard) vector[7] = 1;
    if (features.has_mustache) vector[8] = 1;

    // Hair color (positions 9-13)
    const hairColors = ['blonde', 'brown', 'black', 'red', 'gray'];
    const hairIndex = hairColors.indexOf(features.hair_color);
    if (hairIndex >= 0) vector[9 + hairIndex] = 1;

    // Add some randomness for uniqueness (positions 14-31)
    for (let i = 14; i < 32; i++) {
      vector[i] = Math.random() * 0.1; // Small random values
    }

    return vector;
  }

  /**
   * Calculate similarity between two face embeddings
   */
  calculateEmbeddingSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Resolve image path from URL - supports both local files and remote URLs
   */
  async resolveImagePath(imageUrl) {
    if (imageUrl.startsWith('/uploads/')) {
      return path.join(__dirname, '..', imageUrl);
    } else if (imageUrl.startsWith('http')) {
      // Download remote image and return local path
      return await this.downloadRemoteImage(imageUrl);
    } else {
      return imageUrl;
    }
  }

  /**
   * Download remote image and save to temporary location
   */
  async downloadRemoteImage(url) {
    const http = require('http');
    const https = require('https');
    const { URL } = require('url');
    
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      // Create temporary filename
      const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      const tempPath = path.join(this.uploadsDir, tempFilename);
      
      const request = client.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Doorbell-Face-Cropping-Sharp/1.0'
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }
        
        const fileStream = require('fs').createWriteStream(tempPath);
        
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`Sharp: Downloaded remote image to: ${tempPath}`);
          resolve(tempPath);
        });
        
        fileStream.on('error', (error) => {
          // Clean up partial file
          require('fs').unlink(tempPath, () => {});
          reject(error);
        });
        
        response.on('error', (error) => {
          // Clean up partial file
          require('fs').unlink(tempPath, () => {});
          reject(error);
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Image download timeout'));
      });
    });
  }

  /**
   * Clean up old face crops and thumbnails
   */
  async cleanupOldFiles(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const directories = [this.facesDir, this.thumbnailsDir];

      for (const dir of directories) {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            console.log(`Sharp: Cleaned up old file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Sharp: Error cleaning up old files:', error);
    }
  }
}

// Create singleton instance
const faceCroppingServiceSharp = new FaceCroppingServiceSharp();

module.exports = faceCroppingServiceSharp;
