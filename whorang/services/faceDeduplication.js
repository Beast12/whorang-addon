/**
 * Face Deduplication Service
 * Handles detection and merging of duplicate face detections from AI providers
 */

class FaceDeduplicationService {
  constructor() {
    // Configuration for deduplication sensitivity
    this.config = {
      // Minimum overlap percentage to consider faces as duplicates
      overlapThreshold: 0.7, // 70% overlap
      // Maximum distance between face centers (as percentage of image)
      maxCenterDistance: 5, // 5% of image dimensions
      // Confidence difference threshold for merging
      confidenceDifferenceThreshold: 20 // 20% difference
    };
  }

  /**
   * Remove duplicate faces from a face detection array
   * @param {Array} faces - Array of face detection objects
   * @returns {Array} Deduplicated array of faces
   */
  deduplicateFaces(faces) {
    if (!faces || faces.length <= 1) {
      return faces;
    }

    console.log(`🔍 Deduplicating ${faces.length} detected faces...`);
    
    const deduplicated = [];
    const processed = new Set();

    for (let i = 0; i < faces.length; i++) {
      if (processed.has(i)) {
        continue;
      }

      const currentFace = faces[i];
      const duplicates = [i]; // Start with current face index

      // Find all duplicates of the current face
      for (let j = i + 1; j < faces.length; j++) {
        if (processed.has(j)) {
          continue;
        }

        const otherFace = faces[j];
        
        if (this.areFacesDuplicate(currentFace, otherFace)) {
          duplicates.push(j);
          console.log(`🔄 Found duplicate: Face ${i + 1} and Face ${j + 1}`);
        }
      }

      // Mark all duplicates as processed
      duplicates.forEach(index => processed.add(index));

      // Merge all duplicates into a single face
      const mergedFace = this.mergeDuplicateFaces(duplicates.map(index => faces[index]));
      deduplicated.push(mergedFace);
    }

    const removedCount = faces.length - deduplicated.length;
    if (removedCount > 0) {
      console.log(`✅ Removed ${removedCount} duplicate face(s), ${deduplicated.length} unique faces remain`);
    } else {
      console.log(`✅ No duplicates found, all ${faces.length} faces are unique`);
    }

    return deduplicated;
  }

  /**
   * Check if two faces are duplicates based on overlap and similarity
   * @param {Object} face1 - First face detection object
   * @param {Object} face2 - Second face detection object
   * @returns {boolean} True if faces are considered duplicates
   */
  areFacesDuplicate(face1, face2) {
    const bbox1 = face1.bounding_box;
    const bbox2 = face2.bounding_box;

    if (!bbox1 || !bbox2) {
      return false;
    }

    // Calculate Intersection over Union (IoU)
    const iou = this.calculateIoU(bbox1, bbox2);
    
    // Calculate center distance
    const centerDistance = this.calculateCenterDistance(bbox1, bbox2);
    
    // Calculate size similarity
    const sizeSimilarity = this.calculateSizeSimilarity(bbox1, bbox2);

    console.log(`📊 Comparing faces: IoU=${iou.toFixed(3)}, CenterDist=${centerDistance.toFixed(2)}%, SizeSim=${sizeSimilarity.toFixed(3)}`);

    // Faces are duplicates if:
    // 1. High overlap (IoU > threshold) OR
    // 2. Close centers AND similar sizes
    const highOverlap = iou >= this.config.overlapThreshold;
    const closeAndSimilar = centerDistance <= this.config.maxCenterDistance && sizeSimilarity >= 0.8;

    return highOverlap || closeAndSimilar;
  }

  /**
   * Calculate Intersection over Union (IoU) for two bounding boxes
   * @param {Object} bbox1 - First bounding box {x, y, width, height}
   * @param {Object} bbox2 - Second bounding box {x, y, width, height}
   * @returns {number} IoU value between 0 and 1
   */
  calculateIoU(bbox1, bbox2) {
    // Calculate intersection rectangle
    const x1 = Math.max(bbox1.x, bbox2.x);
    const y1 = Math.max(bbox1.y, bbox2.y);
    const x2 = Math.min(bbox1.x + bbox1.width, bbox2.x + bbox2.width);
    const y2 = Math.min(bbox1.y + bbox1.height, bbox2.y + bbox2.height);

    // Check if there's an intersection
    if (x2 <= x1 || y2 <= y1) {
      return 0; // No intersection
    }

    // Calculate intersection area
    const intersectionArea = (x2 - x1) * (y2 - y1);

    // Calculate union area
    const area1 = bbox1.width * bbox1.height;
    const area2 = bbox2.width * bbox2.height;
    const unionArea = area1 + area2 - intersectionArea;

    // Avoid division by zero
    if (unionArea === 0) {
      return 0;
    }

    return intersectionArea / unionArea;
  }

  /**
   * Calculate distance between face centers as percentage of image
   * @param {Object} bbox1 - First bounding box
   * @param {Object} bbox2 - Second bounding box
   * @returns {number} Distance as percentage
   */
  calculateCenterDistance(bbox1, bbox2) {
    const center1 = {
      x: bbox1.x + bbox1.width / 2,
      y: bbox1.y + bbox1.height / 2
    };

    const center2 = {
      x: bbox2.x + bbox2.width / 2,
      y: bbox2.y + bbox2.height / 2
    };

    const distance = Math.sqrt(
      Math.pow(center1.x - center2.x, 2) + 
      Math.pow(center1.y - center2.y, 2)
    );

    return distance;
  }

  /**
   * Calculate size similarity between two bounding boxes
   * @param {Object} bbox1 - First bounding box
   * @param {Object} bbox2 - Second bounding box
   * @returns {number} Similarity value between 0 and 1
   */
  calculateSizeSimilarity(bbox1, bbox2) {
    const area1 = bbox1.width * bbox1.height;
    const area2 = bbox2.width * bbox2.height;

    if (area1 === 0 || area2 === 0) {
      return 0;
    }

    const minArea = Math.min(area1, area2);
    const maxArea = Math.max(area1, area2);

    return minArea / maxArea;
  }

  /**
   * Merge multiple duplicate faces into a single face
   * @param {Array} duplicateFaces - Array of duplicate face objects
   * @returns {Object} Merged face object
   */
  mergeDuplicateFaces(duplicateFaces) {
    if (duplicateFaces.length === 1) {
      return duplicateFaces[0];
    }

    console.log(`🔄 Merging ${duplicateFaces.length} duplicate faces...`);

    // Find the face with highest confidence
    const bestFace = duplicateFaces.reduce((best, current) => {
      return (current.confidence || 0) > (best.confidence || 0) ? current : best;
    });

    // Calculate average bounding box for better accuracy
    const avgBoundingBox = this.calculateAverageBoundingBox(
      duplicateFaces.map(face => face.bounding_box)
    );

    // Merge distinctive features
    const allFeatures = new Set();
    duplicateFaces.forEach(face => {
      if (face.distinctive_features && Array.isArray(face.distinctive_features)) {
        face.distinctive_features.forEach(feature => allFeatures.add(feature));
      }
    });

    // Create merged face object
    const mergedFace = {
      id: bestFace.id, // Keep the ID of the best face
      bounding_box: avgBoundingBox,
      confidence: Math.max(...duplicateFaces.map(face => face.confidence || 0)),
      description: bestFace.description || 'Person detected',
      quality: this.getBestQuality(duplicateFaces.map(face => face.quality)),
      distinctive_features: Array.from(allFeatures),
      merged_from: duplicateFaces.length, // Track how many faces were merged
      original_faces: duplicateFaces.map(face => ({
        id: face.id,
        confidence: face.confidence,
        bounding_box: face.bounding_box
      }))
    };

    console.log(`✅ Merged face: confidence=${mergedFace.confidence}%, features=${mergedFace.distinctive_features.length}`);

    return mergedFace;
  }

  /**
   * Calculate average bounding box from multiple bounding boxes
   * @param {Array} boundingBoxes - Array of bounding box objects
   * @returns {Object} Average bounding box
   */
  calculateAverageBoundingBox(boundingBoxes) {
    if (boundingBoxes.length === 1) {
      return boundingBoxes[0];
    }

    const validBoxes = boundingBoxes.filter(bbox => 
      bbox && typeof bbox.x === 'number' && typeof bbox.y === 'number' &&
      typeof bbox.width === 'number' && typeof bbox.height === 'number'
    );

    if (validBoxes.length === 0) {
      return { x: 25, y: 25, width: 50, height: 50 }; // Default fallback
    }

    const sum = validBoxes.reduce((acc, bbox) => ({
      x: acc.x + bbox.x,
      y: acc.y + bbox.y,
      width: acc.width + bbox.width,
      height: acc.height + bbox.height
    }), { x: 0, y: 0, width: 0, height: 0 });

    return {
      x: Math.round((sum.x / validBoxes.length) * 100) / 100,
      y: Math.round((sum.y / validBoxes.length) * 100) / 100,
      width: Math.round((sum.width / validBoxes.length) * 100) / 100,
      height: Math.round((sum.height / validBoxes.length) * 100) / 100
    };
  }

  /**
   * Get the best quality from an array of quality values
   * @param {Array} qualities - Array of quality strings
   * @returns {string} Best quality value
   */
  getBestQuality(qualities) {
    const qualityOrder = ['clear', 'good', 'fair', 'poor', 'unknown'];
    
    for (const quality of qualityOrder) {
      if (qualities.includes(quality)) {
        return quality;
      }
    }
    
    return 'unknown';
  }

  /**
   * Update configuration for deduplication sensitivity
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Face deduplication config updated:', this.config);
  }

  /**
   * Get statistics about the deduplication process
   * @param {Array} originalFaces - Original face array
   * @param {Array} deduplicatedFaces - Deduplicated face array
   * @returns {Object} Deduplication statistics
   */
  getDeduplicationStats(originalFaces, deduplicatedFaces) {
    const duplicatesRemoved = originalFaces.length - deduplicatedFaces.length;
    const mergedFaces = deduplicatedFaces.filter(face => face.merged_from > 1);
    
    return {
      originalCount: originalFaces.length,
      finalCount: deduplicatedFaces.length,
      duplicatesRemoved: duplicatesRemoved,
      mergedFaceCount: mergedFaces.length,
      deduplicationRate: originalFaces.length > 0 ? (duplicatesRemoved / originalFaces.length) * 100 : 0
    };
  }
}

// Create singleton instance
const faceDeduplicationService = new FaceDeduplicationService();

module.exports = faceDeduplicationService;
