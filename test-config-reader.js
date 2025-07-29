// Test script to verify configuration loading
const fs = require('fs');
const path = require('path');

console.log('=== WhoRang Config Reader Test ===');

// Create test directories
const testDataDir = path.join(__dirname, 'test-data');
const testConfigFile = path.join(testDataDir, 'options.json');

try {
  // Create test data directory
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Create test options.json
  const testOptions = {
    database_path: '/tmp/test-data/whorang.db',
    uploads_path: '/tmp/test-data/uploads',
    ai_provider: 'local',
    log_level: 'debug',
    websocket_enabled: true,
    cors_enabled: true,
    cors_origins: ['*'],
    public_url: '',
    max_upload_size: '10MB',
    face_recognition_threshold: 0.6,
    ai_analysis_timeout: 30
  };
  
  fs.writeFileSync(testConfigFile, JSON.stringify(testOptions, null, 2));
  console.log('Created test options.json:');
  console.log(JSON.stringify(testOptions, null, 2));
  
  // Test the config reader
  console.log('\n--- Testing ConfigReader ---');
  
  // Temporarily set the config source to our test file
  const originalConfigSource = require('./whorang/utils/configReader').prototype.configSources.homeAssistantOptions;
  require('./whorang/utils/configReader').prototype.configSources.homeAssistantOptions = testConfigFile;
  
  // Load the config reader
  const ConfigReader = require('./whorang/utils/configReader');
  const configReader = new ConfigReader();
  
  console.log('\nLoaded configuration:');
  console.log(`  Database path: ${configReader.config.database_path}`);
  console.log(`  Uploads path: ${configReader.config.uploads_path}`);
  console.log(`  AI provider: ${configReader.config.ai_provider}`);
  console.log(`  Log level: ${configReader.config.log_level}`);
  
  // Test with environment variables
  console.log('\n--- Testing Environment Variable Override ---');
  process.env.DATABASE_PATH = '/custom/db/whorang.db';
  process.env.UPLOADS_PATH = '/custom/uploads';
  
  // Create a new config reader to test environment variable loading
  const ConfigReader2 = require('./whorang/utils/configReader');
  const configReader2 = new ConfigReader2();
  
  console.log('\nConfiguration with environment variables:');
  console.log(`  Database path: ${configReader2.config.database_path}`);
  console.log(`  Uploads path: ${configReader2.config.uploads_path}`);
  console.log(`  AI provider: ${configReader2.config.ai_provider}`);
  console.log(`  Log level: ${configReader2.config.log_level}`);
  
  // Verify environment variables take precedence
  if (configReader2.config.database_path === '/custom/db/whorang.db') {
    console.log('✅ Environment variables correctly override Home Assistant options');
  } else {
    console.log('❌ Environment variables are not overriding Home Assistant options');
  }
  
  // Test native module loading
  console.log('\n--- Testing Native Module Loading ---');
  try {
    const sqlite3 = require('better-sqlite3');
    console.log('✅ better-sqlite3 loaded successfully');
  } catch (err) {
    console.log('❌ Failed to load better-sqlite3:', err.message);
  }
  
  try {
    const sharp = require('sharp');
    console.log('✅ sharp loaded successfully');
  } catch (err) {
    console.log('❌ Failed to load sharp:', err.message);
  }
  
  try {
    const canvas = require('canvas');
    console.log('✅ canvas loaded successfully');
  } catch (err) {
    console.log('❌ Failed to load canvas:', err.message);
  }
  
} catch (error) {
  console.error('Test failed:', error);
} finally {
  // Cleanup
  try {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
    console.log('\n✅ Test completed and cleaned up');
  } catch (err) {
    console.log('⚠️  Cleanup failed:', err.message);
  }
}
