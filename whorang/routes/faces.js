const express = require('express');
const path = require('path');
const fs = require('fs');

function createFacesRouter(dependencies) {
  const router = express.Router();
  const { 
    databaseManager, 
    configReader, 
    upload, 
    broadcast, 
    faceProcessingService 
  } = dependencies;

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
      
      const fullImagePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(imagePath);
      
      if (!fs.existsSync(fullImagePath)) {
        console.error(`Face image not found: ${fullImagePath} (original path: ${imagePath})`);
        return res.status(404).json({ error: 'Image file not found on disk' });
      }
      
      res.setHeader('Content-Type', 'image/jpeg');
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
      const config = configReader.getAll();

      const unknownFaces = db.prepare(`
        SELECT df.id, df.confidence, df.timestamp, v.location, v.weather
        FROM detected_faces df
        LEFT JOIN visitor_events v ON df.visitor_event_id = v.id
        WHERE df.person_id IS NULL ORDER BY df.timestamp DESC
      `).all();
      
      const knownPersons = db.prepare(`
        SELECT p.id, p.name, p.notes, COUNT(df.id) as face_count, MAX(df.timestamp) as last_seen,
               MIN(df.timestamp) as first_seen, AVG(df.confidence) as avg_confidence
        FROM persons p LEFT JOIN detected_faces df ON p.id = df.person_id
        GROUP BY p.id ORDER BY p.name ASC
      `).all();
      
      const baseUrl = (config.public_url || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      
      const processedUnknownFaces = unknownFaces.map(face => ({
        ...face,
        image_url: `${baseUrl}/api/faces/${face.id}/image`,
        thumbnail_url: `${baseUrl}/api/faces/${face.id}/image?size=thumbnail`
      }));
      
      const processedKnownPersons = knownPersons.map(person => ({
        ...person,
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
          stats: {
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
      const findPersonStmt = db.prepare('SELECT * FROM persons WHERE name = ?');
      let person = findPersonStmt.get(person_name);
      
      if (!person && create_person) {
        const createPersonStmt = db.prepare('INSERT INTO persons (name) VALUES (?)');
        const result = createPersonStmt.run(person_name);
        person = { id: result.lastInsertRowid, name: person_name };
      } else if (!person) {
        return res.status(404).json({ error: `Person '${person_name}' not found and create_person is false` });
      }
      
      const updateFaceStmt = db.prepare('UPDATE detected_faces SET person_id = ?, assigned_manually = 1, assigned_at = CURRENT_TIMESTAMP WHERE id = ? AND person_id IS NULL');
      
      let labeledCount = 0;
      const results = face_ids.map(faceId => {
        try {
          const result = updateFaceStmt.run(person.id, faceId);
          if (result.changes > 0) {
            labeledCount++;
            return { face_id: faceId, success: true };
          }
          return { face_id: faceId, success: false, reason: 'Face not found or already labeled' };
        } catch (updateError) {
          return { face_id: faceId, success: false, reason: updateError.message };
        }
      });
      
      broadcast({ type: 'faces_labeled', data: { person_id: person.id, person_name: person.name, labeled_count: labeledCount, face_ids } });
      
      res.json({ success: true, data: { person_id: person.id, person_name: person.name, labeled_count: labeledCount, total_requested: face_ids.length, results } });
      
    } catch (error) {
      console.error('Error batch labeling faces:', error);
      res.status(500).json({ error: 'Failed to batch label faces' });
    }
  });

  // Clear all face data endpoint
  router.post('/clear-all', async (req, res) => {
    try {
      const db = databaseManager.getDatabase();
      const config = configReader.getAll();

      const faces = db.prepare('SELECT face_crop_path, thumbnail_path FROM detected_faces').all();
      const faceCount = db.prepare('SELECT COUNT(*) as count FROM detected_faces').get().count;
      const personCount = db.prepare('SELECT COUNT(*) as count FROM persons').get().count;
      
      const facesResult = db.prepare('DELETE FROM detected_faces').run();
      const personsResult = db.prepare('DELETE FROM persons').run();
      
      let deletedFiles = 0, failedFiles = 0;
      for (const face of faces) {
        [face.face_crop_path, face.thumbnail_path].forEach(p => {
          if (p && fs.existsSync(p)) {
            try { fs.unlinkSync(p); deletedFiles++; } catch { failedFiles++; }
          }
        });
      }
      
      // Cleanup directories (optional)
      const uploadsDir = config.uploads_dir || './uploads';
      [path.join(uploadsDir, 'faces'), path.join(uploadsDir, 'thumbnails')].forEach(dir => {
        if (!fs.existsSync(dir)) return;
        fs.readdirSync(dir).forEach(subdir => {
          const subdirPath = path.join(dir, subdir);
          if (fs.statSync(subdirPath).isDirectory()) {
            try { fs.rmdirSync(subdirPath); } catch {}
          }
        });
      });

      broadcast({ type: 'face_data_cleared', data: { deleted_faces: facesResult.changes, deleted_persons: personsResult.changes, deleted_files: deletedFiles, timestamp: new Date().toISOString() } });
      
      res.json({ success: true, message: 'All face data cleared', data: { deleted_faces: facesResult.changes, deleted_persons: personsResult.changes, deleted_files: deletedFiles, failed_files: failedFiles, original_counts: { faces: faceCount, persons: personCount } } });
      
    } catch (error) {
      console.error('Error clearing all face data:', error);
      res.status(500).json({ error: 'Failed to clear face data' });
    }
  });

  // Placeholder for training route - delegates to faceProcessingService
  router.post('/train/:personId', upload.array('images', 10), async (req, res) => {
    try {
      const { personId } = req.params;
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No images provided for training.' });
      }
      // Delegate to the service
      const result = await faceProcessingService.trainPerson(personId, files);
      res.json({ success: true, message: 'Training process started.', data: result });
    } catch (error) {
      console.error('Error starting training:', error);
      res.status(500).json({ error: 'Failed to start training.' });
    }
  });

  return router;
}

module.exports = createFacesRouter;
