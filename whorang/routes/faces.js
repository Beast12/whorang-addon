
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const upload = require('../middleware/upload');
const PersonController = require('../controllers/personController');
const FaceConfigController = require('../controllers/faceConfigController');
const FaceDetectionController = require('../controllers/faceDetectionController');
const VisitorLabelingController = require('../controllers/visitorLabelingController');
const OllamaController = require('../controllers/ollamaController');
const { getDatabase } = require('../config/database');

// Person management routes
router.get('/persons', PersonController.getPersons);
router.get('/persons/:id', PersonController.getPerson);
router.get('/persons/:id/avatar', PersonController.getPersonAvatar);
router.post('/persons', PersonController.createPerson);
router.put('/persons/:id', PersonController.updatePerson);
router.delete('/persons/:id', PersonController.deletePerson);

// Face recognition configuration routes
router.get('/config', FaceConfigController.getConfig);
router.put('/config', FaceConfigController.updateConfig);
router.get('/config/debug', FaceConfigController.getDebugInfo);

// Ollama routes
router.get('/ollama/models', OllamaController.getAvailableModels);
router.post('/ollama/test', OllamaController.testConnection);

// Visitor labeling routes
router.post('/label', VisitorLabelingController.labelVisitorEvent);
router.get('/events', VisitorLabelingController.getEventsWithPersons);

// Face detection and training routes
router.post('/detect', upload.single('image'), FaceDetectionController.detectFaces);
router.post('/train/:personId', upload.array('images', 10), FaceDetectionController.trainPerson);
router.get('/processing-status', FaceDetectionController.getProcessingStatus);

// Face image serving endpoints
router.get('/:faceId/image', async (req, res) => {
  try {
    const { faceId } = req.params;
    const { size } = req.query; // thumbnail or full
    
    const db = getDatabase();
    const stmt = db.prepare('SELECT face_crop_path, thumbnail_path FROM detected_faces WHERE id = ?');
    const face = stmt.get(faceId);
    
    if (!face) {
      return res.status(404).json({ error: 'Face not found' });
    }
    
    // Choose image path based on size parameter
    const imagePath = size === 'thumbnail' && face.thumbnail_path 
      ? face.thumbnail_path 
      : face.face_crop_path;
    
    if (!imagePath) {
      return res.status(404).json({ error: 'Face image not found' });
    }
    
    // Handle both absolute and relative paths
    let fullImagePath;
    if (path.isAbsolute(imagePath)) {
      // If it's an absolute path starting with /, treat it as relative to working directory
      fullImagePath = path.join(process.cwd(), imagePath.substring(1));
    } else {
      // If it's already relative, resolve from working directory
      fullImagePath = path.resolve(imagePath);
    }
    
    if (!fs.existsSync(fullImagePath)) {
      console.error(`Face image not found: ${fullImagePath} (original path: ${imagePath})`);
      return res.status(404).json({ error: 'Image file not found on disk' });
    }
    
    // Set appropriate headers
    const mimeType = 'image/jpeg';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross-origin requests
    
    // Stream the image
    const imageStream = fs.createReadStream(fullImagePath);
    imageStream.on('error', (error) => {
      console.error('Error streaming image:', error);
      res.status(500).json({ error: 'Failed to stream image' });
    });
    
    imageStream.pipe(res);
    
  } catch (error) {
    console.error('Error serving face image:', error);
    res.status(500).json({ error: 'Failed to serve face image' });
  }
});

// Face gallery endpoint - get all faces with image URLs
router.get('/gallery', async (req, res) => {
  try {
    const db = getDatabase();
    
    // Get unknown faces (not assigned to any person)
    const unknownStmt = db.prepare(`
      SELECT 
        df.id,
        df.face_crop_path,
        df.thumbnail_path,
        df.confidence,
        df.quality_score,
        df.created_at,
        df.bounding_box,
        de.ai_title,
        de.ai_message,
        de.timestamp as detection_time,
        de.image_url as original_image_url
      FROM detected_faces df
      LEFT JOIN doorbell_events de ON df.visitor_event_id = de.id
      WHERE df.person_id IS NULL
      ORDER BY df.created_at DESC
      LIMIT 50
    `);
    
    const unknownFaces = unknownStmt.all();
    
    // Get known persons with their face counts
    const knownStmt = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.face_count,
        p.last_seen,
        p.first_seen,
        p.avg_confidence,
        COUNT(df.id) as actual_face_count
      FROM persons p
      LEFT JOIN detected_faces df ON p.id = df.person_id
      GROUP BY p.id, p.name, p.face_count, p.last_seen, p.first_seen, p.avg_confidence
      ORDER BY p.last_seen DESC
    `);
    
    const knownPersons = knownStmt.all();
    
    // Add image URLs to unknown faces
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const processedUnknownFaces = unknownFaces.map(face => ({
      id: face.id,
      image_url: `${baseUrl}/api/faces/${face.id}/image`,
      thumbnail_url: `${baseUrl}/api/faces/${face.id}/image?size=thumbnail`,
      quality_score: face.quality_score || 0,
      confidence: face.confidence || 0,
      detection_date: face.created_at,
      detection_time: face.detection_time,
      description: face.ai_title || face.ai_message || 'Unknown person',
      bounding_box: face.bounding_box ? JSON.parse(face.bounding_box) : null,
      original_image_url: face.original_image_url
    }));
    
    // Add avatar URLs to known persons
    const processedKnownPersons = knownPersons.map(person => ({
      id: person.id,
      name: person.name,
      face_count: person.actual_face_count || person.face_count || 0,
      last_seen: person.last_seen,
      first_seen: person.first_seen,
      avg_confidence: person.avg_confidence || 0,
      avatar_url: `${baseUrl}/api/faces/persons/${person.id}/avatar`
    }));
    
    // Calculate progress
    const totalFaces = processedUnknownFaces.length + processedKnownPersons.reduce((sum, p) => sum + p.face_count, 0);
    const labeledFaces = processedKnownPersons.reduce((sum, p) => sum + p.face_count, 0);
    const progress = totalFaces > 0 ? (labeledFaces / totalFaces) * 100 : 100;
    
    res.json({
      success: true,
      data: {
        unknown_faces: processedUnknownFaces,
        known_persons: processedKnownPersons,
        statistics: {
          total_unknown: processedUnknownFaces.length,
          total_known_persons: processedKnownPersons.length,
          total_labeled_faces: labeledFaces,
          labeling_progress: Math.round(progress * 100) / 100
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting face gallery:', error);
    res.status(500).json({ error: 'Failed to get face gallery' });
  }
});

// Face suggestions endpoint - get similar faces for labeling suggestions
router.get('/:faceId/suggestions', async (req, res) => {
  try {
    const { faceId } = req.params;
    const db = getDatabase();
    
    // Get the target face
    const faceStmt = db.prepare('SELECT * FROM detected_faces WHERE id = ?');
    const targetFace = faceStmt.get(faceId);
    
    if (!targetFace) {
      return res.status(404).json({ error: 'Face not found' });
    }
    
    // Get recent persons as suggestions (simple implementation)
    // In a more advanced version, this would use face similarity matching
    const suggestionsStmt = db.prepare(`
      SELECT DISTINCT p.name, p.id, COUNT(df.id) as face_count, MAX(df.created_at) as last_seen
      FROM persons p
      JOIN detected_faces df ON p.id = df.person_id
      GROUP BY p.id, p.name
      ORDER BY last_seen DESC
      LIMIT 5
    `);
    
    const suggestions = suggestionsStmt.all();
    
    res.json({
      success: true,
      data: suggestions.map(person => ({
        name: person.name,
        person_id: person.id,
        confidence: 0.8, // Placeholder - would be calculated from similarity
        face_count: person.face_count,
        last_seen: person.last_seen
      }))
    });
    
  } catch (error) {
    console.error('Error getting face suggestions:', error);
    res.status(500).json({ error: 'Failed to get face suggestions' });
  }
});

// Batch labeling endpoint
router.post('/batch-label', async (req, res) => {
  try {
    const { face_ids, person_name, create_person = true } = req.body;
    
    if (!face_ids || !Array.isArray(face_ids) || face_ids.length === 0) {
      return res.status(400).json({ error: 'face_ids array is required' });
    }
    
    if (!person_name || person_name.trim() === '') {
      return res.status(400).json({ error: 'person_name is required' });
    }
    
    const db = getDatabase();
    
    // Find or create person
    let personStmt = db.prepare('SELECT * FROM persons WHERE name = ?');
    let person = personStmt.get(person_name.trim());
    
    if (!person && create_person) {
      const insertPersonStmt = db.prepare('INSERT INTO persons (name) VALUES (?)');
      const result = insertPersonStmt.run(person_name.trim());
      person = { id: result.lastInsertRowid, name: person_name.trim() };
    } else if (!person) {
      return res.status(404).json({ error: 'Person not found and create_person is false' });
    }
    
    // Update faces with person_id
    const updateFaceStmt = db.prepare(`
      UPDATE detected_faces 
      SET person_id = ?, assigned_manually = 1, assigned_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND person_id IS NULL
    `);
    
    let labeledCount = 0;
    const results = [];
    
    for (const faceId of face_ids) {
      try {
        const result = updateFaceStmt.run(person.id, faceId);
        if (result.changes > 0) {
          labeledCount++;
          results.push({ face_id: faceId, success: true });
        } else {
          results.push({ face_id: faceId, success: false, reason: 'Face not found or already labeled' });
        }
      } catch (error) {
        results.push({ face_id: faceId, success: false, reason: error.message });
      }
    }
    
    // Update person statistics
    if (labeledCount > 0) {
      const updatePersonStmt = db.prepare(`
        UPDATE persons 
        SET 
          face_count = (SELECT COUNT(*) FROM detected_faces WHERE person_id = ?),
          last_seen = (SELECT MAX(created_at) FROM detected_faces WHERE person_id = ?),
          first_seen = COALESCE(first_seen, (SELECT MIN(created_at) FROM detected_faces WHERE person_id = ?)),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updatePersonStmt.run(person.id, person.id, person.id, person.id);
    }
    
    res.json({
      success: true,
      data: {
        person_id: person.id,
        person_name: person.name,
        labeled_count: labeledCount,
        total_requested: face_ids.length,
        results: results
      }
    });
    
  } catch (error) {
    console.error('Error batch labeling faces:', error);
    res.status(500).json({ error: 'Failed to batch label faces' });
  }
});

// Single face labeling endpoint
router.post('/:faceId/label', async (req, res) => {
  try {
    const { faceId } = req.params;
    const { person_name, create_person = true } = req.body;
    
    if (!person_name || person_name.trim() === '') {
      return res.status(400).json({ error: 'person_name is required' });
    }
    
    const db = getDatabase();
    
    // Check if face exists and is not already labeled
    const faceStmt = db.prepare('SELECT * FROM detected_faces WHERE id = ? AND person_id IS NULL');
    const face = faceStmt.get(faceId);
    
    if (!face) {
      return res.status(404).json({ error: 'Face not found or already labeled' });
    }
    
    // Find or create person
    let personStmt = db.prepare('SELECT * FROM persons WHERE name = ?');
    let person = personStmt.get(person_name.trim());
    
    if (!person && create_person) {
      const insertPersonStmt = db.prepare('INSERT INTO persons (name) VALUES (?)');
      const result = insertPersonStmt.run(person_name.trim());
      person = { id: result.lastInsertRowid, name: person_name.trim() };
    } else if (!person) {
      return res.status(404).json({ error: 'Person not found and create_person is false' });
    }
    
    // Label the face
    const updateFaceStmt = db.prepare(`
      UPDATE detected_faces 
      SET person_id = ?, assigned_manually = 1, assigned_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = updateFaceStmt.run(person.id, faceId);
    
    if (result.changes === 0) {
      return res.status(400).json({ error: 'Failed to label face' });
    }
    
    // Update person statistics
    const updatePersonStmt = db.prepare(`
      UPDATE persons 
      SET 
        face_count = (SELECT COUNT(*) FROM detected_faces WHERE person_id = ?),
        last_seen = (SELECT MAX(created_at) FROM detected_faces WHERE person_id = ?),
        first_seen = COALESCE(first_seen, (SELECT MIN(created_at) FROM detected_faces WHERE person_id = ?)),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updatePersonStmt.run(person.id, person.id, person.id, person.id);
    
    res.json({
      success: true,
      data: {
        face_id: parseInt(faceId),
        person_id: person.id,
        person_name: person.name,
        labeled_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error labeling face:', error);
    res.status(500).json({ error: 'Failed to label face' });
  }
});

// Delete face endpoint
router.delete('/:faceId', async (req, res) => {
  try {
    const { faceId } = req.params;
    const db = getDatabase();
    
    // Get face info before deletion
    const faceStmt = db.prepare('SELECT face_crop_path, thumbnail_path FROM detected_faces WHERE id = ?');
    const face = faceStmt.get(faceId);
    
    if (!face) {
      return res.status(404).json({ error: 'Face not found' });
    }
    
    // Delete face from database
    const deleteStmt = db.prepare('DELETE FROM detected_faces WHERE id = ?');
    const result = deleteStmt.run(faceId);
    
    if (result.changes === 0) {
      return res.status(400).json({ error: 'Failed to delete face' });
    }
    
    // Try to delete image files (don't fail if files don't exist)
    try {
      if (face.face_crop_path && fs.existsSync(face.face_crop_path)) {
        fs.unlinkSync(face.face_crop_path);
      }
      if (face.thumbnail_path && fs.existsSync(face.thumbnail_path)) {
        fs.unlinkSync(face.thumbnail_path);
      }
    } catch (fileError) {
      console.warn('Could not delete face image files:', fileError.message);
    }
    
    res.json({
      success: true,
      data: {
        face_id: parseInt(faceId),
        deleted_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error deleting face:', error);
    res.status(500).json({ error: 'Failed to delete face' });
  }
});

module.exports = router;
