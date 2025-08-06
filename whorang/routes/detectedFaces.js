const express = require('express');
const { authenticateToken } = require('../middleware/auth');

function createDetectedFacesRouter(dependencies) {
  const router = express.Router();
  const { DetectedFacesController, databaseManager } = dependencies;
  
  // Instantiate controller with dependencies
  const detectedFacesController = new DetectedFacesController(databaseManager);

  // Get all unassigned faces (for manual labeling)
  router.get('/unassigned', authenticateToken, detectedFacesController.getUnassignedFaces.bind(detectedFacesController));

  // Get faces for a specific person
  router.get('/person/:personId', authenticateToken, detectedFacesController.getPersonFaces.bind(detectedFacesController));

  // Assign a face to a person (manual labeling)
  router.post('/:faceId/assign', authenticateToken, detectedFacesController.assignFaceToPerson.bind(detectedFacesController));

  // Unassign a face from a person
  router.delete('/:faceId/assign', authenticateToken, detectedFacesController.unassignFace.bind(detectedFacesController));

  // Bulk assign multiple faces to a person
  router.post('/bulk-assign', authenticateToken, detectedFacesController.bulkAssignFaces.bind(detectedFacesController));

  // Get face similarity suggestions
  router.get('/:faceId/similarities', authenticateToken, detectedFacesController.getFaceSimilarities.bind(detectedFacesController));

  // Delete a detected face
  router.delete('/:faceId', authenticateToken, detectedFacesController.deleteFace.bind(detectedFacesController));

  // Get face detection statistics
  router.get('/stats', authenticateToken, detectedFacesController.getFaceStats.bind(detectedFacesController));

  return router;
}

module.exports = createDetectedFacesRouter;
