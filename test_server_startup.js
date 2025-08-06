#!/usr/bin/env node

// Simple test script to validate server startup without Home Assistant addon infrastructure
console.log('🧪 Testing WhoRang server startup...');

// Set up minimal environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'debug';
process.env.AI_PROVIDER = 'local';
process.env.DATABASE_PATH = '/tmp/test-whorang.db';
process.env.UPLOADS_PATH = '/tmp/test-uploads';

// Create test directories
const fs = require('fs');
const path = require('path');

try {
  fs.mkdirSync('/tmp/test-uploads', { recursive: true });
  console.log('✅ Created test directories');
} catch (error) {
  console.log('⚠️  Test directories already exist or creation failed:', error.message);
}

// Change to the whorang directory
process.chdir('./whorang');

console.log('🚀 Starting server...');

// Import and run the server
try {
  require('./server.js');
  console.log('✅ Server import successful - checking for startup errors...');
  
  // Give the server a moment to initialize
  setTimeout(() => {
    console.log('🎉 Server startup test completed successfully!');
    console.log('   If you see this message, the route registration fixes worked.');
    process.exit(0);
  }, 3000);
  
} catch (error) {
  console.error('❌ SERVER STARTUP FAILED:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  
  if (error.message.includes('callback function')) {
    console.error('\n🚨 THE ROUTE REGISTRATION ERROR IS STILL PRESENT!');
    console.error('   Controller methods are still undefined');
  }
  
  process.exit(1);
}
