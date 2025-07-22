const express = require('express');
const router = express.Router();
const DetectedFacesController = require('../controllers/detectedFacesController');

// Get all unassigned faces (for manual labeling)
router.get('/unassigned', DetectedFacesController.getUnassignedFaces);

// Get faces for a specific person
router.get('/person/:personId', DetectedFacesController.getPersonFaces);

// Assign a face to a person (manual labeling)
router.post('/:faceId/assign', DetectedFacesController.assignFaceToPerson);

// Unassign a face from a person
router.post('/:faceId/unassign', DetectedFacesController.unassignFace);

// Bulk assign multiple faces to a person
router.post('/bulk-assign', DetectedFacesController.bulkAssignFaces);

// Get face similarity suggestions for a specific face
router.get('/:faceId/similarities', DetectedFacesController.getFaceSimilarities);

// Delete a detected face
router.delete('/:faceId', DetectedFacesController.deleteFace);

// Get recent detections (for dashboard)
router.get('/recent', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const db = require('../config/database').getDatabase();
  
  try {
    // Get recent doorbell events with face detection data
    const stmt = db.prepare(`
      SELECT 
        de.id,
        de.ai_title,
        de.ai_message,
        de.timestamp,
        de.location,
        p.name as person_name,
        df.confidence
      FROM doorbell_events de
      LEFT JOIN detected_faces df ON de.id = df.visitor_event_id
      LEFT JOIN persons p ON df.person_id = p.id
      ORDER BY de.timestamp DESC
      LIMIT ?
    `);
    
    const detections = stmt.all(limit);
    
    // Format the response
    const formattedDetections = detections.map(detection => ({
      id: detection.id,
      person_name: detection.person_name || 'Unknown Person',
      ai_title: detection.ai_title,
      ai_message: detection.ai_message,
      timestamp: detection.timestamp,
      created_at: detection.timestamp,
      location: detection.location,
      confidence: detection.confidence || 0
    }));
    
    res.json(formattedDetections);
  } catch (err) {
    console.error('Error getting recent detections:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get face detection statistics
router.get('/stats', DetectedFacesController.getFaceStats);

module.exports = router;
