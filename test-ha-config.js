// Test script to verify Home Assistant configuration loading
const fs = require('fs');
const path = require('path');

console.log('=== WhoRang Home Assistant Config Test ===');

// Create test directories
const testDataDir = path.join(__dirname, 'test-ha-data');
const testConfigFile = path.join(testDataDir, 'options.json');

try {
  // Create test data directory
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Create test options.json with Home Assistant addon structure
  const testOptions = {
    "database_path": "/config/whorang/whorang.db",
    "uploads_path": "/config/whorang/uploads",
    "ai_provider": "openai",
    "openai_api_key": "sk-test123",
    "log_level": "debug",
    "websocket_enabled": true,
    "cors_enabled": true,
    "cors_origins": ["http://localhost:8123"],
    "public_url": "http://homeassistant.local:3001",
    "max_upload_size": "15MB",
    "face_recognition_threshold": 0.7,
    "ai_analysis_timeout": 45
  };
  
  fs.writeFileSync(testConfigFile, JSON.stringify(testOptions, null, 2));
  console.log('✅ Created test Home Assistant options.json:');
  console.log(JSON.stringify(testOptions, null, 2));
  
  // Test the config reader logic by directly testing the methods
  console.log('\n--- Testing ConfigReader Logic ---');
  
  // Import the ConfigReader class directly (not the singleton)
  const configReaderModule = require('./whorang/utils/configReader');
  
  // Create a mock ConfigReader that uses our test file instead of /data/options.json
  class MockConfigReader {
    constructor() {
      this.config = null;
      this.configSources = {
        homeAssistantOptions: testConfigFile,  // Use our test file
        environmentVariables: process.env,
        defaults: {
          database_path: '/data/whorang.db',
          uploads_path: '/data/uploads',
          ai_provider: 'local',
          log_level: 'info',
          websocket_enabled: true,
          cors_enabled: true,
          cors_origins: ['*'],
          public_url: '',
          max_upload_size: '10MB',
          face_recognition_threshold: 0.6,
          ai_analysis_timeout: 30
        }
      };
      
      // Copy the methods from the real ConfigReader
      const realConfigReader = new (require('./whorang/utils/configReader').constructor)();
      this.loadHomeAssistantOptions = realConfigReader.loadHomeAssistantOptions.bind(this);
      this.loadEnvironmentVariables = realConfigReader.loadEnvironmentVariables.bind(this);
      this.validateConfiguration = realConfigReader.validateConfiguration.bind(this);
      
      // Override the loadConfiguration method to use our test file
      this.loadConfiguration = function() {
        console.log('🔧 Loading configuration from multiple sources...');
        
        // Start with defaults
        this.config = { ...this.configSources.defaults };
        
        // Try to load Home Assistant add-on options
        const haOptions = this.loadHomeAssistantOptions();
        if (haOptions) {
          console.log('✅ Loaded Home Assistant add-on options');
          this.config = { ...this.config, ...haOptions };
        }
        
        // Override with environment variables (highest priority)
        this.loadEnvironmentVariables();
        
        // Validate and sanitize configuration
        this.validateConfiguration();
        
        console.log('📋 Final configuration loaded:');
        console.log(`  Database path: ${this.config.database_path}`);
        console.log(`  Uploads path: ${this.config.uploads_path}`);
        console.log(`  AI provider: ${this.config.ai_provider}`);
        console.log(`  Log level: ${this.config.log_level}`);
        console.log(`  WebSocket enabled: ${this.config.websocket_enabled}`);
        console.log(`  CORS enabled: ${this.config.cors_enabled}`);
      };
      
      this.get = function(key) {
        return this.config[key];
      };
      
      this.getAll = function() {
        return { ...this.config };
      };
      
      // Load the configuration
      this.loadConfiguration();
    }
  }
  
  // Test with Home Assistant options only
  const mockConfigReader = new MockConfigReader();
  
  console.log('\n✅ Loaded configuration from Home Assistant options:');
  console.log(`  Database path: ${mockConfigReader.get('database_path')}`);
  console.log(`  Uploads path: ${mockConfigReader.get('uploads_path')}`);
  console.log(`  AI provider: ${mockConfigReader.get('ai_provider')}`);
  console.log(`  Log level: ${mockConfigReader.get('log_level')}`);
  console.log(`  WebSocket enabled: ${mockConfigReader.get('websocket_enabled')}`);
  console.log(`  CORS enabled: ${mockConfigReader.get('cors_enabled')}`);
  console.log(`  Public URL: ${mockConfigReader.get('public_url')}`);
  
  // Test with environment variables (simulating run.sh export)
  console.log('\n--- Testing Environment Variable Override ---');
  process.env.DATABASE_PATH = '/custom/db/whorang.db';
  process.env.UPLOADS_PATH = '/custom/uploads';
  process.env.AI_PROVIDER = 'local';
  process.env.LOG_LEVEL = 'info';
  
  // Create a new mock config reader to test environment variable loading
  const mockConfigReader2 = new MockConfigReader();
  
  console.log('\n✅ Configuration with environment variables (higher priority):');
  console.log(`  Database path: ${mockConfigReader2.get('database_path')}`);
  console.log(`  Uploads path: ${mockConfigReader2.get('uploads_path')}`);
  console.log(`  AI provider: ${mockConfigReader2.get('ai_provider')}`);
  console.log(`  Log level: ${mockConfigReader2.get('log_level')}`);
  
  // Verify environment variables take precedence
  if (mockConfigReader2.get('database_path') === '/custom/db/whorang.db') {
    console.log('✅ Environment variables correctly override Home Assistant options');
  } else {
    console.log('❌ Environment variables are not overriding Home Assistant options');
  }
  
  console.log('\n--- Config Precedence Summary ---');
  console.log('1. Environment variables (highest priority)');
  console.log('2. Home Assistant add-on options (/data/options.json)');
  console.log('3. Default values (lowest priority)');
  
} catch (error) {
  console.error('❌ Test failed:', error);
} finally {
  // Cleanup
  try {
    // Remove our test directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
    console.log('\n✅ Test completed and cleaned up');
  } catch (err) {
    console.log('⚠️  Cleanup failed:', err.message);
  }
}
