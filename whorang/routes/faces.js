const express = require('express');
const path = require('path');
const fs = require('fs');
const upload = require('../middleware/upload');

function createFacesRouter(dependencies) {
  const { databaseManager, configManager, broadcast } = dependencies;
  const router = express.Router();

  // Instantiate controllers with dependencies
  const personController = new dependencies.PersonController(databaseManager);
  const faceConfigController = new dependencies.FaceConfigController(databaseManager, configManager);
  const faceProcessingService = require('../services/faceProcessing');
  const faceDetectionController = new dependencies.FaceDetectionController(databaseManager, faceProcessingService);
  const visitorLabelingController = new dependencies.VisitorLabelingController(databaseManager, broadcast);
  const ollamaController = new dependencies.OllamaController(configManager, databaseManager);

  // Person management routes
  router.get('/persons', personController.getPersons.bind(personController));
  router.get('/persons/:id', personController.getPerson.bind(personController));
  router.get('/persons/:id/avatar', personController.getPersonAvatar.bind(personController));
  router.post('/persons', personController.createPerson.bind(personController));
  router.put('/persons/:id', personController.updatePerson.bind(personController));
  router.delete('/persons/:id', personController.deletePerson.bind(personController));

  // Face recognition configuration routes
  router.get('/config', faceConfigController.getConfig.bind(faceConfigController));
  router.put('/config', faceConfigController.updateConfig.bind(faceConfigController));
  router.get('/config/debug', faceConfigController.getDebugInfo.bind(faceConfigController));

  // Ollama routes
  router.get('/ollama/models', ollamaController.getAvailableModels.bind(ollamaController));
  router.post('/ollama/test', ollamaController.testConnection.bind(ollamaController));

  // Visitor labeling routes
  router.post('/label', visitorLabelingController.labelVisitorEvent.bind(visitorLabelingController));
  router.get('/events', visitorLabelingController.getEventsWithPersons.bind(visitorLabelingController));

  // Face detection and training routes
  router.post('/detect', upload.single('image'), faceDetectionController.detectFaces.bind(faceDetectionController));
  router.post('/train/:personId', upload.array('images', 10), faceDetectionController.trainPerson.bind(faceDetectionController));
  router.get('/processing-status', faceDetectionController.getProcessingStatus.bind(faceDetectionController));

  // Face image serving endpoints
  router.get('/:faceId/image', async (req, res) => {
    try {
      const { faceId } = req.params;
      const { size } = req.query; // thumbnail or full
      
      const db = databaseManager.getDatabase();
      const stmt = db.prepare('SELECT face_crop_path, thumbnail_path FROM detected_faces WHERE id = ?');
      const face = stmt.get(faceId);
      
      if (!face) {
        return res.status(404).json({ error: 'Face not found' });
      }
      
      const imagePath = size === 'thumbnail' && face.thumbnail_path 
        ? face.thumbnail_path 
        : face.face_crop_path;
      
      if (!imagePath) {
        return res.status(404).json({ error: 'Face image not found' });
      }
      
      let fullImagePath;
      if (path.isAbsolute(imagePath)) {
        fullImagePath = imagePath;
      } else {
        fullImagePath = path.resolve(imagePath);
      }
      
      if (!fs.existsSync(fullImagePath)) {
        console.error(`Face image not found: ${fullImagePath} (original path: ${imagePath})`);
        return res.status(404).json({ error: 'Image file not found on disk' });
      }
      
      const mimeType = 'image/jpeg';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
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

  // Face gallery endpoint
  router.get('/gallery', async (req, res) => {
    try {
      const db = databaseManager.getDatabase();
      
      const unknownStmt = db.prepare(`
        SELECT df.id, df.face_crop_path, df.thumbnail_path, df.confidence, df.timestamp, e.id as event_id, e.camera
        FROM detected_faces df JOIN events e ON df.event_id = e.id
        WHERE df.person_id IS NULL ORDER BY df.timestamp DESC
      `);
      const unknownFaces = unknownStmt.all();
      
      const knownStmt = db.prepare(`
        SELECT p.id, p.name, p.notes, COUNT(df.id) as face_count, MAX(df.timestamp) as last_seen, MIN(df.timestamp) as first_seen, AVG(df.confidence) as avg_confidence
        FROM persons p JOIN detected_faces df ON p.id = df.person_id
        GROUP BY p.id, p.name, p.notes ORDER BY last_seen DESC
      `);
      const knownPersons = knownStmt.all();
      
      const PUBLIC_URL = configManager.get('system.public_url') || process.env.CORS_ORIGIN || null;
      let baseUrl;
      
      if (PUBLIC_URL) {
        baseUrl = PUBLIC_URL.replace(/\/$/, '');
      } else {
        const host = req.get('host');
        const protocol = req.protocol;
        baseUrl = `${protocol}://${host}`;
      }

      const processedUnknownFaces = unknownFaces.map(face => ({
        id: face.id,
        url: `${baseUrl}/api/faces/${face.id}/image`,
        thumbnail_url: `${baseUrl}/api/faces/${face.id}/image?size=thumbnail`,
        confidence: face.confidence,
        timestamp: face.timestamp,
        event_id: face.event_id,
        camera: face.camera
      }));
      
      const processedKnownPersons = knownPersons.map(person => ({
        id: person.id,
        name: person.name,
        notes: person.notes,
        face_count: person.face_count,
        last_seen: person.last_seen,
        first_seen: person.first_seen,
        avg_confidence: person.avg_confidence || 0,
        avatar_url: `${baseUrl}/api/faces/persons/${person.id}/avatar`
      }));
      
      const totalFaces = processedUnknownFaces.length + processedKnownPersons.reduce((sum, p) => sum + p.face_count, 0);
      const labeledFaces = processedKnownPersons.reduce((sum, p) => sum + p.face_count, 0);
      const progress = totalFaces > 0 ? labeledFaces / totalFaces : 0;

      res.json({
        success: true,
        data: {
          unknown_faces: processedUnknownFaces,
          known_persons: processedKnownPersons,
          summary: {
            total_faces: totalFaces,
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

  // Batch labeling endpoint
  router.post('/batch-label', async (req, res) => {
    try {
      const { face_ids, person_name, create_person = true } = req.body;
      
      if (!face_ids || !Array.isArray(face_ids) || face_ids.length === 0) {
        return res.status(400).json({ error: 'face_ids array is required' });
      }
      
      if (!person_name) {
        return res.status(400).json({ error: 'person_name is required' });
      }
      
      const db = databaseManager.getDatabase();
      let person;
      
      const findPersonStmt = db.prepare('SELECT * FROM persons WHERE name = ?');
      person = findPersonStmt.get(person_name);
      
      if (!person) {
        if (create_person) {
          const createPersonStmt = db.prepare('INSERT INTO persons (name) VALUES (?)');
          const info = createPersonStmt.run(person_name);
          person = { id: info.lastInsertRowid, name: person_name };
        } else {
          return res.status(404).json({ error: 'Person not found and create_person is false' });
        }
      }
      
      const updateFaceStmt = db.prepare(`
        UPDATE detected_faces SET person_id = ?, assigned_manually = 1, assigned_at = CURRENT_TIMESTAMP
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
            results.push({ face_id: faceId, success: false, reason: 'Face already labeled or not found' });
          }
        } catch (updateError) {
          results.push({ face_id: faceId, success: false, reason: updateError.message });
        }
      }
      
      if (labeledCount > 0) {
        broadcast({
          type: 'faces_labeled',
          data: { person_id: person.id, person_name: person.name, labeled_count: labeledCount }
        });
      }
      
      res.json({
        success: true,
        data: { person_id: person.id, person_name: person.name, labeled_count: labeledCount, total_requested: face_ids.length, results: results }
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
      const { person_id, person_name } = req.body;
      
      if (!person_id && !person_name) {
        return res.status(400).json({ error: 'Either person_id or person_name is required' });
      }
      
      const db = databaseManager.getDatabase();
      let person;
      
      if (person_id) {
        const findPersonStmt = db.prepare('SELECT * FROM persons WHERE id = ?');
        person = findPersonStmt.get(person_id);
        if (!person) {
          return res.status(404).json({ error: 'Person not found' });
        }
      } else {
        const findPersonStmt = db.prepare('SELECT * FROM persons WHERE name = ?');
        person = findPersonStmt.get(person_name);
        if (!person) {
          const createPersonStmt = db.prepare('INSERT INTO persons (name) VALUES (?)');
          const info = createPersonStmt.run(person_name);
          person = { id: info.lastInsertRowid, name: person_name };
        }
      }
      
      const updateStmt = db.prepare('UPDATE detected_faces SET person_id = ?, assigned_manually = 1, assigned_at = CURRENT_TIMESTAMP WHERE id = ?');
      const result = updateStmt.run(person.id, faceId);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Face not found or already labeled' });
      }
      
      broadcast({
        type: 'face_labeled',
        data: { face_id: parseInt(faceId), person_id: person.id, person_name: person.name }
      });

      res.json({
        success: true,
        data: { face_id: parseInt(faceId), person_id: person.id, person_name: person.name }
      });
      
    } catch (error) {
      console.error('Error labeling face:', error);
      res.status(500).json({ error: 'Failed to label face' });
    }
  });

  // Unlabel a face (set person_id to NULL)
  router.post('/:faceId/unlabel', async (req, res) => {
    try {
      const { faceId } = req.params;
      const db = databaseManager.getDatabase();
      
      const updateStmt = db.prepare('UPDATE detected_faces SET person_id = NULL, assigned_manually = 0, assigned_at = NULL WHERE id = ?');
      const result = updateStmt.run(faceId);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Face not found or already unlabeled' });
      }
      
      broadcast({ type: 'face_unlabeled', data: { face_id: parseInt(faceId) } });
      
      res.json({ 
        success: true, 
        data: { face_id: parseInt(faceId), unlabeled_at: new Date().toISOString() }
      });
      
    } catch (error) {
      console.error('Error unlabeling face:', error);
      res.status(500).json({ error: 'Failed to unlabel face' });
    }
  });

  // Delete a face record and its image
  router.delete('/:faceId', async (req, res) => {
    try {
      const { faceId } = req.params;
      const db = databaseManager.getDatabase();
      
      const getFaceStmt = db.prepare('SELECT face_crop_path, thumbnail_path FROM detected_faces WHERE id = ?');
      const face = getFaceStmt.get(faceId);
      
      if (!face) {
        return res.status(404).json({ error: 'Face not found' });
      }
      
      const deleteStmt = db.prepare('DELETE FROM detected_faces WHERE id = ?');
      const result = deleteStmt.run(faceId);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Face not found for deletion' });
      }
      
      try {
        if (face.face_crop_path && fs.existsSync(face.face_crop_path)) {
          fs.unlinkSync(face.face_crop_path);
        }
        if (face.thumbnail_path && fs.existsSync(face.thumbnail_path)) {
          fs.unlinkSync(face.thumbnail_path);
        }
      } catch (fileError) {
        console.warn(`Could not delete image files for face ${faceId}:`, fileError.message);
      }
      
      broadcast({ type: 'face_deleted', data: { face_id: parseInt(faceId), deleted_at: new Date().toISOString() } });
      
      res.json({ success: true, data: { face_id: parseInt(faceId), deleted_at: new Date().toISOString() } });
      
    } catch (error) {
      console.error('Error deleting face:', error);
      res.status(500).json({ error: 'Failed to delete face' });
    }
  });

  // Clear all face data endpoint
  router.post('/clear-all', async (req, res) => {
    try {
      const db = databaseManager.getDatabase();
      
      const facesStmt = db.prepare('SELECT face_crop_path, thumbnail_path FROM detected_faces');
      const faces = facesStmt.all();
      
      const faceCountStmt = db.prepare('SELECT COUNT(*) as count FROM detected_faces');
      const personCountStmt = db.prepare('SELECT COUNT(*) as count FROM persons');
      const faceCount = faceCountStmt.get().count;
      const personCount = personCountStmt.get().count;
      
      const deleteFacesStmt = db.prepare('DELETE FROM detected_faces');
      const facesResult = deleteFacesStmt.run();
      
      const deletePersonsStmt = db.prepare('DELETE FROM persons');
      const personsResult = deletePersonsStmt.run();
      
      let deletedFiles = 0;
      let failedFiles = 0;
      
      for (const face of faces) {
        try {
          if (face.face_crop_path && fs.existsSync(face.face_crop_path)) {
            fs.unlinkSync(face.face_crop_path);
            deletedFiles++;
          }
          if (face.thumbnail_path && fs.existsSync(face.thumbnail_path)) {
            fs.unlinkSync(face.thumbnail_path);
            deletedFiles++;
          }
        } catch (fileError) {
          console.warn('Could not delete face image file:', fileError.message);
          failedFiles++;
        }
      }
      
      try {
        const uploadsDir = configManager.get('system.uploads_dir') || './uploads';
        const facesDir = path.join(uploadsDir, 'faces');
        const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
        
        if (fs.existsSync(facesDir)) {
          const faceSubdirs = fs.readdirSync(facesDir);
          for (const subdir of faceSubdirs) {
            const subdirPath = path.join(facesDir, subdir);
            if (fs.statSync(subdirPath).isDirectory()) { try { fs.rmdirSync(subdirPath); } catch (err) {} }
          }
        }
        
        if (fs.existsSync(thumbnailsDir)) {
          const thumbSubdirs = fs.readdirSync(thumbnailsDir);
          for (const subdir of thumbSubdirs) {
            const subdirPath = path.join(thumbnailsDir, subdir);
            if (fs.statSync(subdirPath).isDirectory()) { try { fs.rmdirSync(subdirPath); } catch (err) {} }
          }
        }
      } catch (cleanupError) {
        console.warn('Could not clean up directories:', cleanupError.message);
      }
      
      broadcast({
        type: 'face_data_cleared',
        data: { deleted_faces: facesResult.changes, deleted_persons: personsResult.changes, deleted_files: deletedFiles, failed_files: failedFiles, timestamp: new Date().toISOString() }
      });
      
      res.json({
        success: true,
        message: 'All face data cleared successfully',
        data: { deleted_faces: facesResult.changes, deleted_persons: personsResult.changes, deleted_files: deletedFiles, failed_files: failedFiles, original_counts: { faces: faceCount, persons: personCount }, cleared_at: new Date().toISOString() }
      });
      
    } catch (error) {
      console.error('Error clearing all face data:', error);
      res.status(500).json({ error: 'Failed to clear face data' });
    }
  });

  return router;
}

module.exports = createFacesRouter;
