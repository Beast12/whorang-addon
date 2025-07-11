#!/usr/bin/env node

/**
 * Test script to verify upload path resolution works correctly
 */

const uploadPaths = require('./utils/uploadPaths');

console.log('🧪 Testing Upload Path Resolution Fix\n');

// Test environment variable
console.log('📋 Environment Configuration:');
console.log(`   UPLOADS_PATH: ${process.env.UPLOADS_PATH || 'not set (using default: uploads)'}`);
console.log(`   Base Upload Path: ${uploadPaths.getBaseUploadPath()}\n`);

// Test path resolution scenarios
console.log('🔍 Testing Path Resolution:');

const testCases = [
  '/data/uploads/faces/test_face.jpg',
  '/uploads/faces/test_face.jpg', 
  './uploads/faces/test_face.jpg',
  'uploads/faces/test_face.jpg'
];

testCases.forEach(testPath => {
  const resolved = uploadPaths.resolveUploadPath(testPath);
  const isUpload = uploadPaths.isUploadPath(testPath);
  console.log(`   Input:    ${testPath}`);
  console.log(`   Resolved: ${resolved}`);
  console.log(`   Is Upload: ${isUpload ? '✅' : '❌'}`);
  console.log('');
});

// Test URL generation
console.log('🔗 Testing URL Generation:');
const testFilename = 'test_face_123.jpg';
console.log(`   Face Image URL: ${uploadPaths.createFaceImageUrl(testFilename)}`);
console.log(`   Thumbnail URL: ${uploadPaths.createThumbnailUrl(testFilename)}`);

console.log('\n✅ Upload path resolution test completed!');
