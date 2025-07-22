#!/usr/bin/env node

/**
 * Configuration Test Script
 * Tests the new configuration system and path validation
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 WhoRang Configuration Test Suite');
console.log('=====================================\n');

// Test 1: Configuration Reader
console.log('1️⃣ Testing Configuration Reader...');
try {
  const configReader = require('./utils/configReader');
  
  console.log('✅ Configuration Reader loaded successfully');
  console.log('📋 Configuration Status:');
  console.log(JSON.stringify(configReader.getStatus(), null, 2));
  
  console.log('\n📋 Current Configuration:');
  const config = configReader.getAll();
  console.log(`  Database path: ${config.database_path}`);
  console.log(`  Uploads path: ${config.uploads_path}`);
  console.log(`  AI provider: ${config.ai_provider}`);
  console.log(`  Log level: ${config.log_level}`);
  console.log(`  Running as HA add-on: ${configReader.isHomeAssistantAddon()}`);
  
} catch (error) {
  console.error('❌ Configuration Reader test failed:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 2: Path Validator
console.log('2️⃣ Testing Path Validator...');
try {
  const pathValidator = require('./utils/pathValidator');
  
  console.log('✅ Path Validator loaded successfully');
  
  // Test database path validation
  console.log('\n📋 Testing Database Path Validation:');
  const dbValidation = pathValidator.validateDatabasePath('/data/whorang.db');
  console.log(`  Path: /data/whorang.db`);
  console.log(`  Valid: ${dbValidation.isValid}`);
  console.log(`  Exists: ${dbValidation.exists}`);
  console.log(`  Writable: ${dbValidation.isWritable}`);
  if (dbValidation.error) {
    console.log(`  Error: ${dbValidation.error}`);
  }
  if (dbValidation.warnings.length > 0) {
    console.log(`  Warnings: ${dbValidation.warnings.join(', ')}`);
  }
  
  // Test uploads path validation
  console.log('\n📋 Testing Uploads Path Validation:');
  const uploadsValidation = pathValidator.validateUploadsPath('/data/uploads');
  console.log(`  Path: /data/uploads`);
  console.log(`  Valid: ${uploadsValidation.isValid}`);
  console.log(`  Exists: ${uploadsValidation.exists}`);
  console.log(`  Writable: ${uploadsValidation.isWritable}`);
  if (uploadsValidation.error) {
    console.log(`  Error: ${uploadsValidation.error}`);
  }
  if (uploadsValidation.warnings.length > 0) {
    console.log(`  Warnings: ${uploadsValidation.warnings.join(', ')}`);
  }
  
} catch (error) {
  console.error('❌ Path Validator test failed:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 3: Directory Manager
console.log('3️⃣ Testing Directory Manager...');
try {
  const directoryManager = require('./utils/directoryManager');
  
  console.log('✅ Directory Manager loaded successfully');
  console.log('📋 Directory Manager Status:');
  console.log(JSON.stringify(directoryManager.getStatus(), null, 2));
  
  // Test directory creation
  console.log('\n📋 Testing Directory Creation:');
  const facesPath = directoryManager.getFacesPath();
  const tempPath = directoryManager.getTempPath();
  const thumbnailsPath = directoryManager.getThumbnailsPath();
  
  console.log(`  Faces path: ${facesPath}`);
  console.log(`  Temp path: ${tempPath}`);
  console.log(`  Thumbnails path: ${thumbnailsPath}`);
  
} catch (error) {
  console.error('❌ Directory Manager test failed:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 4: Database Manager
console.log('4️⃣ Testing Database Manager...');
try {
  const databaseManager = require('./utils/databaseManager');
  
  console.log('✅ Database Manager loaded successfully');
  console.log('📋 Database Manager Status:');
  console.log(JSON.stringify(databaseManager.getStatus(), null, 2));
  
  const effectivePath = databaseManager.getEffectiveDatabasePath();
  console.log(`\n📋 Effective Database Path: ${effectivePath}`);
  
} catch (error) {
  console.error('❌ Database Manager test failed:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 5: Environment Variables
console.log('5️⃣ Testing Environment Variables...');
console.log('📋 Relevant Environment Variables:');
const envVars = [
  'NODE_ENV',
  'DATABASE_PATH',
  'UPLOADS_PATH',
  'AI_PROVIDER',
  'LOG_LEVEL',
  'WHORANG_ADDON_MODE',
  'DATA_WRITABLE',
  'PORT'
];

envVars.forEach(envVar => {
  const value = process.env[envVar];
  console.log(`  ${envVar}: ${value || 'not set'}`);
});

console.log('\n' + '='.repeat(50) + '\n');

// Test 6: File System Checks
console.log('6️⃣ Testing File System Access...');

const pathsToCheck = [
  '/data',
  '/data/uploads',
  '/app',
  '/app/uploads',
  '/var/lib/nginx',
  '/var/log/nginx',
  '/run/nginx'
];

pathsToCheck.forEach(checkPath => {
  try {
    const exists = fs.existsSync(checkPath);
    let permissions = 'unknown';
    
    if (exists) {
      try {
        fs.accessSync(checkPath, fs.constants.R_OK | fs.constants.W_OK);
        permissions = 'read/write';
      } catch {
        try {
          fs.accessSync(checkPath, fs.constants.R_OK);
          permissions = 'read-only';
        } catch {
          permissions = 'no access';
        }
      }
    }
    
    console.log(`  ${checkPath}: ${exists ? 'exists' : 'missing'} (${permissions})`);
  } catch (error) {
    console.log(`  ${checkPath}: error - ${error.message}`);
  }
});

console.log('\n' + '='.repeat(50) + '\n');

// Test 7: Home Assistant Add-on Detection
console.log('7️⃣ Testing Home Assistant Add-on Detection...');
const optionsFile = '/data/options.json';
const configDir = '/config';

console.log(`📋 Add-on Detection Results:`);
console.log(`  /data/options.json exists: ${fs.existsSync(optionsFile)}`);
console.log(`  /config directory exists: ${fs.existsSync(configDir)}`);

if (fs.existsSync(optionsFile)) {
  try {
    const options = JSON.parse(fs.readFileSync(optionsFile, 'utf8'));
    console.log(`  Options file content:`, Object.keys(options));
  } catch (error) {
    console.log(`  Options file read error: ${error.message}`);
  }
}

console.log('\n🎉 Configuration Test Suite Complete!');
console.log('=====================================');
