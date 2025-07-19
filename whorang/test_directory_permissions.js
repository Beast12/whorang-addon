#!/usr/bin/env node

/**
 * Test script to verify directory permissions and upload functionality
 * This script tests the DirectoryManager and upload middleware fixes
 */

const path = require('path');
const fs = require('fs').promises;

async function testDirectoryPermissions() {
  console.log('🧪 Testing Directory Permissions and Upload Functionality');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: DirectoryManager initialization
    console.log('\n1️⃣  Testing DirectoryManager...');
    const directoryManager = require('./utils/directoryManager');
    const status = directoryManager.getStatus();
    
    console.log('   DirectoryManager Status:');
    console.log(`   - Primary path: ${status.primaryBasePath}`);
    console.log(`   - Fallback path: ${status.fallbackBasePath}`);
    console.log(`   - Data writable: ${status.isDataWritable}`);
    console.log(`   - Effective path: ${status.effectiveBasePath}`);
    
    // Test 2: Directory creation
    console.log('\n2️⃣  Testing directory creation...');
    
    const testDirs = ['', 'faces', 'thumbnails', 'temp'];
    for (const dir of testDirs) {
      try {
        const result = await directoryManager.ensureDirectory(dir);
        console.log(`   ✅ ${dir || 'root'}: ${result.path} (fallback: ${result.usedFallback})`);
      } catch (error) {
        console.log(`   ❌ ${dir || 'root'}: ${error.message}`);
      }
    }
    
    // Test 3: Upload paths
    console.log('\n3️⃣  Testing upload paths...');
    const uploadPaths = require('./utils/uploadPaths');
    
    console.log(`   - Base upload path: ${uploadPaths.getBaseUploadPath()}`);
    console.log(`   - Faces upload path: ${uploadPaths.getFacesUploadPath()}`);
    console.log(`   - Thumbnails upload path: ${uploadPaths.getThumbnailsUploadPath()}`);
    console.log(`   - Temp upload path: ${uploadPaths.getTempUploadPath()}`);
    
    // Test 4: Write permissions
    console.log('\n4️⃣  Testing write permissions...');
    
    const testPaths = [
      uploadPaths.getBaseUploadPath(),
      uploadPaths.getFacesUploadPath(),
      uploadPaths.getThumbnailsUploadPath(),
      uploadPaths.getTempUploadPath()
    ];
    
    for (const testPath of testPaths) {
      try {
        const testFile = path.join(testPath, `test_${Date.now()}.txt`);
        await fs.writeFile(testFile, 'test content');
        await fs.unlink(testFile);
        console.log(`   ✅ ${testPath}: Writable`);
      } catch (error) {
        console.log(`   ❌ ${testPath}: Not writable - ${error.message}`);
      }
    }
    
    // Test 5: Upload middleware
    console.log('\n5️⃣  Testing upload middleware...');
    try {
      const uploadMiddleware = require('./middleware/upload');
      if (uploadMiddleware.getStatus) {
        const uploadStatus = uploadMiddleware.getStatus();
        console.log('   Upload Middleware Status:');
        console.log(`   - Upload directory: ${uploadStatus.uploadDir}`);
        console.log(`   - Used fallback: ${uploadStatus.uploadDirStatus?.usedFallback || 'unknown'}`);
      } else {
        console.log('   ⚠️  Upload middleware status not available');
      }
    } catch (error) {
      console.log(`   ❌ Upload middleware error: ${error.message}`);
    }
    
    // Test 6: Face cropping services
    console.log('\n6️⃣  Testing face cropping services...');
    
    const services = [
      { name: 'FaceCroppingService', path: './services/faceCroppingService' },
      { name: 'FaceCroppingServiceLite', path: './services/faceCroppingServiceLite' },
      { name: 'FaceCroppingServiceSharp', path: './services/faceCroppingServiceSharp' }
    ];
    
    for (const service of services) {
      try {
        const serviceInstance = require(service.path);
        console.log(`   ✅ ${service.name}: Loaded successfully`);
      } catch (error) {
        console.log(`   ❌ ${service.name}: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Directory permissions test completed!');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('\n💥 Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testDirectoryPermissions().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testDirectoryPermissions };
