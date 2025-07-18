const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const directoryManager = require('../utils/directoryManager');

class FaceCroppingService {
  constructor() {
    this.directoryManager = directoryManager;
    
    // Initialize directory paths using DirectoryManager
    this.initializeDirectories();
  }

  async initializeDirectories() {
    try {
      // Use DirectoryManager for robust directory creation
      const baseResult = await this.directoryManager.ensureDirectory();
      const facesResult = await this.directoryManager.ensureDirectory('faces');
      const thumbnailsResult = await this.directoryManager.ensureDirectory('thumbnails');
      
      this.uploadsDir = baseResult.path;
      this.facesDir = facesResult.path;
      this.thumbnailsDir = thumbnailsResult.path;
      
      console.log('✅ Face cropping service initialized:');
      console.log(`  Uploads: ${this.uploadsDir} (fallback: ${baseResult.usedFallback})`);
      console.log(`  Faces: ${this.facesDir} (fallback: ${facesResult.usedFallback})`);
      console.log(`  Thumbnails: ${this.thumbnailsDir} (fallback: ${thumbnailsResult.usedFallback})`);
    } catch (error) {
      console.error('❌ Error initializing face cropping directories:', error);
      
      // Fallback to relative paths
      this.uploadsDir = path.join(__dirname, '../uploads');
      this.facesDir = path.join(this.uploadsDir, 'faces');
      this.thumbnailsDir = path.join(this.uploadsDir, 'thumbnails');
      
      console.log('⚠️  Using fallback relative paths for face cropping service');
    }
  }

  async ensureDirectories() {
    // Legacy method - now uses DirectoryManager
    try {
      await this.directoryManager.ensureDirectory();
      await this.directoryManager.ensureDirectory('faces');
      await this.directoryManager.ensureDirectory('thumbnails');
      console.log('Face cropping directories ensured via DirectoryManager');
    } catch (error) {
      console.error('Error ensuring face cropping directories:', error);
      throw error;
    }
  }

  /**
   * Extract face crops from a full doorbell image
   * @param {string} imageUrl - URL or path to the full image
   * @param {Array} faceDetections - Array of face detection results with bounding boxes
   * @param {number} visitorEventId - ID of the visitor event
   * @returns {Array} Array of face crop information
   */
  async extractFaceCrops(imageUrl, faceDetections, visitorEventId) {
    try {
      console.log(`Extracting ${faceDetections.length} face crops from image: ${imageUrl}`);
      
      // Load the full image
      const fullImagePath = await this.resolveImagePath(imageUrl);
      const image = await loadImage(fullImagePath);
      
      const faceCrops = [];
      
      for (let i = 0; i < faceDetections.length; i++) {
        const face = faceDetections[i];
        const faceId = `${visitorEventId}_face_${i + 1}_${Date.now()}`;
        
        try {
          // Extract face crop
          const faceCrop = await this.cropFaceFromImage(image, face.bounding_box, faceId);
          
          // Generate thumbnail
          const thumbnail = await this.generateThumbnail(faceCrop.canvas, faceId);
          
          faceCrops.push({
            faceId,
            faceCropPath: faceCrop.path,
            thumbnailPath: thumbnail.path,
            boundingBox: face.bounding_box,
            confidence: face.confidence,
            qualityScore: this.calculateFaceQuality(face, image.width, image.height),
            originalFace: face
          });
          
          console.log(`Face crop ${i + 1} extracted: ${faceCrop.path}`);
        } catch (error) {
          console.error(`Error extracting face crop ${i + 1}:`, error);
        }
      }
      
      return faceCrops;
    } catch (error) {
      console.error('Error in extractFaceCrops:', error);
      throw error;
    }
  }

  /**
   * Crop a single face from the full image
   */
  async cropFaceFromImage(image, boundingBox, faceId) {
    const { x, y, width, height } = boundingBox;
    
    // Auto-detect coordinate format and normalize to 0-1 range
    let normalizedX, normalizedY, normalizedWidth, normalizedHeight;
    
    if (x <= 1.0 && y <= 1.0 && width <= 1.0 && height <= 1.0) {
      // Already normalized coordinates (0.0 - 1.0)
      normalizedX = x;
      normalizedY = y;
      normalizedWidth = width;
      normalizedHeight = height;
      console.log(`Using normalized coordinates: x=${x}, y=${y}, w=${width}, h=${height}`);
    } else {
      // Percentage coordinates (0 - 100), convert to normalized
      normalizedX = x / 100;
      normalizedY = y / 100;
      normalizedWidth = width / 100;
      normalizedHeight = height / 100;
      console.log(`Converting percentage coordinates: x=${x}% -> ${normalizedX}, y=${y}% -> ${normalizedY}, w=${width}% -> ${normalizedWidth}, h=${height}% -> ${normalizedHeight}`);
    }
    
    // Convert normalized coordinates to pixels
    const pixelX = Math.round(normalizedX * image.width);
    const pixelY = Math.round(normalizedY * image.height);
    const pixelWidth = Math.round(normalizedWidth * image.width);
    const pixelHeight = Math.round(normalizedHeight * image.height);
    
    console.log(`Image dimensions: ${image.width}x${image.height}`);
    console.log(`Pixel coordinates: x=${pixelX}, y=${pixelY}, w=${pixelWidth}, h=${pixelHeight}`);
    
    // Optimized padding for tighter face crops (8% on each side)
    // This focuses more on the face while keeping minimal context
    const padding = 0.08;
    
    // For face crops, we want to be more conservative with vertical padding
    // since faces are typically taller than they are wide
    const horizontalPadding = padding;
    const verticalPadding = padding * 0.6; // Less vertical padding to focus on face
    
    const paddedWidth = Math.round(pixelWidth * (1 + horizontalPadding * 2));
    const paddedHeight = Math.round(pixelHeight * (1 + verticalPadding * 2));
    const paddedX = Math.max(0, pixelX - Math.round(pixelWidth * horizontalPadding));
    const paddedY = Math.max(0, pixelY - Math.round(pixelHeight * verticalPadding));
    
    console.log(`Optimized face crop padding: horizontal=${horizontalPadding}, vertical=${verticalPadding}`);
    
    // Ensure we don't go beyond image boundaries
    const finalWidth = Math.min(paddedWidth, image.width - paddedX);
    const finalHeight = Math.min(paddedHeight, image.height - paddedY);
    
    // Create canvas for the face crop
    const canvas = createCanvas(finalWidth, finalHeight);
    const ctx = canvas.getContext('2d');
    
    // Draw the cropped face
    ctx.drawImage(
      image,
      paddedX, paddedY, finalWidth, finalHeight,
      0, 0, finalWidth, finalHeight
    );
    
    // Save the face crop
    const filename = `${faceId}.jpg`;
    const filepath = path.join(this.facesDir, filename);
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
    await fs.writeFile(filepath, buffer);
    
    return {
      canvas,
      path: `/uploads/faces/${filename}`,
      filename,
      dimensions: { width: finalWidth, height: finalHeight }
    };
  }

  /**
   * Generate a thumbnail from a face crop
   */
  async generateThumbnail(faceCanvas, faceId) {
    const thumbnailSize = 150; // 150x150 thumbnail
    
    // Create thumbnail canvas
    const thumbCanvas = createCanvas(thumbnailSize, thumbnailSize);
    const thumbCtx = thumbCanvas.getContext('2d');
    
    // Calculate scaling to maintain aspect ratio
    const scale = Math.min(
      thumbnailSize / faceCanvas.width,
      thumbnailSize / faceCanvas.height
    );
    
    const scaledWidth = faceCanvas.width * scale;
    const scaledHeight = faceCanvas.height * scale;
    const offsetX = (thumbnailSize - scaledWidth) / 2;
    const offsetY = (thumbnailSize - scaledHeight) / 2;
    
    // Fill background with neutral color
    thumbCtx.fillStyle = '#f0f0f0';
    thumbCtx.fillRect(0, 0, thumbnailSize, thumbnailSize);
    
    // Draw scaled face
    thumbCtx.drawImage(
      faceCanvas,
      offsetX, offsetY, scaledWidth, scaledHeight
    );
    
    // Save thumbnail
    const filename = `thumb_${faceId}.jpg`;
    const filepath = path.join(this.thumbnailsDir, filename);
    const buffer = thumbCanvas.toBuffer('image/jpeg', { quality: 0.8 });
    await fs.writeFile(filepath, buffer);
    
    return {
      path: `/uploads/thumbnails/${filename}`,
      filename,
      size: thumbnailSize
    };
  }

  /**
   * Calculate face quality score based on various factors
   */
  calculateFaceQuality(face, imageWidth, imageHeight) {
    let qualityScore = 0.5; // Base score
    
    const { x, y, width, height } = face.bounding_box;
    
    // Normalize coordinates to 0-1 range for consistent calculations
    let normalizedX, normalizedY, normalizedWidth, normalizedHeight;
    
    if (x <= 1.0 && y <= 1.0 && width <= 1.0 && height <= 1.0) {
      // Already normalized coordinates (0.0 - 1.0)
      normalizedX = x;
      normalizedY = y;
      normalizedWidth = width;
      normalizedHeight = height;
    } else {
      // Percentage coordinates (0 - 100), convert to normalized
      normalizedX = x / 100;
      normalizedY = y / 100;
      normalizedWidth = width / 100;
      normalizedHeight = height / 100;
    }
    
    // Size factor - larger faces are generally better quality
    const faceArea = normalizedWidth * normalizedHeight;
    const sizeScore = Math.min(faceArea * 10, 1); // Normalize to 0-1
    qualityScore += sizeScore * 0.3;
    
    // Confidence factor
    const confidenceScore = face.confidence / 100;
    qualityScore += confidenceScore * 0.4;
    
    // Position factor - faces in center are often better quality
    const centerX = 0.5; // Center in normalized coordinates
    const centerY = 0.5;
    const faceX = normalizedX + (normalizedWidth / 2);
    const faceY = normalizedY + (normalizedHeight / 2);
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(faceX - centerX, 2) + Math.pow(faceY - centerY, 2)
    );
    const positionScore = Math.max(0, 1 - (distanceFromCenter / 0.5)); // Max distance is 0.5 in normalized coords
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
      console.error('Error generating face embedding:', error);
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
          'User-Agent': 'Doorbell-Face-Cropping/1.0'
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
          console.log(`Downloaded remote image to: ${tempPath}`);
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
            console.log(`Cleaned up old file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }
}

// Create singleton instance
const faceCroppingService = new FaceCroppingService();

module.exports = faceCroppingService;
