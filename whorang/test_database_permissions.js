#!/usr/bin/env node

/**
 * Database Permission Test Script
 * Tests database connectivity and persistence with fallback support
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 WhoRang Database Permission Test');
console.log('=====================================\n');

// Test 1: Environment Variables
console.log('1. Environment Variables:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`   DATABASE_PATH: ${process.env.DATABASE_PATH || 'not set'}`);
console.log(`   UPLOADS_PATH: ${process.env.UPLOADS_PATH || 'not set'}`);
console.log(`   DATA_UPLOADS_WRITABLE: ${process.env.DATA_UPLOADS_WRITABLE || 'not set'}`);
console.log('');

// Test 2: DatabaseManager
console.log('2. DatabaseManager Test:');
try {
  const databaseManager = require('./utils/databaseManager');
  const dbStatus = databaseManager.getStatus();
  
  console.log('   DatabaseManager Status:');
  console.log(`   ✓ Primary DB path: ${dbStatus.primaryDbPath}`);
  console.log(`   ✓ Fallback DB path: ${dbStatus.fallbackDbPath}`);
  console.log(`   ✓ Effective path: ${dbStatus.effectivePath || 'ERROR'}`);
  console.log(`   ✓ Is persistent: ${dbStatus.isPersistent ? '✅ YES' : '❌ NO'}`);
  console.log(`   ✓ Data writable: ${dbStatus.isDataWritable ? '✅ YES' : '❌ NO'}`);
  
  if (dbStatus.warning) {
    console.log(`   ⚠️  WARNING: ${dbStatus.warning}`);
  }
  
  if (dbStatus.error) {
    console.log(`   ❌ ERROR: ${dbStatus.error}`);
  }
} catch (error) {
  console.log(`   ❌ DatabaseManager failed: ${error.message}`);
}
console.log('');

// Test 3: DirectoryManager
console.log('3. DirectoryManager Test:');
try {
  const directoryManager = require('./utils/directoryManager');
  const dirStatus = directoryManager.getStatus();
  
  console.log('   DirectoryManager Status:');
  console.log(`   ✓ Primary path: ${dirStatus.primaryBasePath}`);
  console.log(`   ✓ Fallback path: ${dirStatus.fallbackBasePath}`);
  console.log(`   ✓ Effective path: ${dirStatus.effectiveBasePath}`);
  console.log(`   ✓ Is data writable: ${dirStatus.isDataWritable ? '✅ YES' : '❌ NO'}`);
  console.log(`   ✓ Used fallback: ${dirStatus.usedFallback ? '⚠️  YES' : '✅ NO'}`);
} catch (error) {
  console.log(`   ❌ DirectoryManager failed: ${error.message}`);
}
console.log('');

// Test 4: Database Connection
console.log('4. Database Connection Test:');
try {
  const { initializeDatabase, getDatabase, closeDatabase } = require('./config/database');
  
  console.log('   Attempting database initialization...');
  const db = initializeDatabase();
  
  if (db) {
    console.log('   ✅ Database connection successful');
    
    // Test basic query
    try {
      const result = db.prepare('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"').get();
      console.log(`   ✅ Database query successful - ${result.count} tables found`);
      
      // Test write operation
      try {
        db.prepare('CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, test_data TEXT)').run();
        db.prepare('INSERT OR REPLACE INTO test_table (id, test_data) VALUES (1, ?)').run(new Date().toISOString());
        const testResult = db.prepare('SELECT test_data FROM test_table WHERE id = 1').get();
        console.log(`   ✅ Database write test successful - data: ${testResult.test_data}`);
        
        // Clean up test table
        db.prepare('DROP TABLE IF EXISTS test_table').run();
        console.log('   ✅ Test cleanup successful');
      } catch (writeError) {
        console.log(`   ❌ Database write test failed: ${writeError.message}`);
      }
    } catch (queryError) {
      console.log(`   ❌ Database query failed: ${queryError.message}`);
    }
    
    closeDatabase();
  } else {
    console.log('   ❌ Database initialization returned null');
  }
} catch (error) {
  console.log(`   ❌ Database connection failed: ${error.message}`);
}
console.log('');

// Test 5: File System Permissions
console.log('5. File System Permissions Test:');

const testPaths = [
  '/data',
  '/data/uploads',
  '/data/uploads/faces',
  '/app',
  '/app/uploads'
];

testPaths.forEach(testPath => {
  try {
    const stats = fs.statSync(testPath);
    const isWritable = fs.constants && (stats.mode & fs.constants.S_IWUSR);
    console.log(`   ${testPath}: ${stats.isDirectory() ? '📁' : '📄'} ${isWritable ? '✅ writable' : '❌ not writable'}`);
    
    // Test actual write
    if (stats.isDirectory()) {
      try {
        const testFile = path.join(testPath, '.write_test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`   ${testPath}: ✅ write test successful`);
      } catch (writeError) {
        console.log(`   ${testPath}: ❌ write test failed - ${writeError.message}`);
      }
    }
  } catch (error) {
    console.log(`   ${testPath}: ❌ not accessible - ${error.message}`);
  }
});
console.log('');

// Test 6: Persistence Analysis
console.log('6. Data Persistence Analysis:');

const databaseManager = require('./utils/databaseManager');
const directoryManager = require('./utils/directoryManager');

const dbStatus = databaseManager.getStatus();
const dirStatus = directoryManager.getStatus();

console.log('   Persistence Status:');
console.log(`   Database persistent: ${dbStatus.isPersistent ? '✅ YES' : '❌ NO'}`);
console.log(`   Uploads persistent: ${dirStatus.isDataWritable ? '✅ YES' : '❌ NO'}`);

if (!dbStatus.isPersistent || !dirStatus.isDataWritable) {
  console.log('');
  console.log('   ⚠️  CRITICAL PERSISTENCE WARNINGS:');
  
  if (!dbStatus.isPersistent) {
    console.log('   • Database is using temporary storage');
    console.log('   • All face recognition data will be lost on restart');
    console.log('   • Person assignments and visitor history will be lost');
  }
  
  if (!dirStatus.isDataWritable) {
    console.log('   • Upload files are using temporary storage');
    console.log('   • Face images and thumbnails will be lost on restart');
    console.log('   • Users will lose all face recognition images');
  }
  
  console.log('');
  console.log('   🔧 SOLUTIONS:');
  console.log('   1. Ensure Home Assistant addon has "data:rw" in volume mapping');
  console.log('   2. Restart the addon after configuration changes');
  console.log('   3. Check Home Assistant supervisor logs for permission errors');
  console.log('   4. Verify /data directory is properly mounted in container');
}

console.log('');

// Test 7: Debug Endpoint Test
console.log('7. Debug Endpoint Simulation:');
try {
  // Simulate the debug endpoint response
  const status = {
    timestamp: new Date().toISOString(),
    directoryManager: dirStatus,
    databaseManager: dbStatus,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      UPLOADS_PATH: process.env.UPLOADS_PATH,
      DATABASE_PATH: process.env.DATABASE_PATH,
      DATA_UPLOADS_WRITABLE: process.env.DATA_UPLOADS_WRITABLE
    },
    persistenceWarnings: []
  };
  
  // Add persistence warnings
  if (!dbStatus.isPersistent) {
    status.persistenceWarnings.push({
      type: 'database',
      message: 'Database is using temporary storage - data will be lost on restart!',
      effectivePath: dbStatus.effectivePath,
      recommendation: 'Ensure /data directory is properly mounted and writable'
    });
  }
  
  if (!dirStatus.isDataWritable) {
    status.persistenceWarnings.push({
      type: 'uploads',
      message: 'Uploads are using temporary storage - files will be lost on restart!',
      effectivePath: dirStatus.effectiveBasePath,
      recommendation: 'Ensure /data directory is properly mounted and writable'
    });
  }
  
  console.log('   Debug endpoint would return:');
  console.log(`   • Timestamp: ${status.timestamp}`);
  console.log(`   • Persistence warnings: ${status.persistenceWarnings.length}`);
  
  if (status.persistenceWarnings.length > 0) {
    console.log('   • Warning details:');
    status.persistenceWarnings.forEach((warning, index) => {
      console.log(`     ${index + 1}. ${warning.type}: ${warning.message}`);
    });
  }
} catch (error) {
  console.log(`   ❌ Debug endpoint simulation failed: ${error.message}`);
}

console.log('');
console.log('=====================================');
console.log('🏁 Database Permission Test Complete');

// Summary
const dbStatus2 = databaseManager.getStatus();
const dirStatus2 = directoryManager.getStatus();

if (dbStatus2.isPersistent && dirStatus2.isDataWritable) {
  console.log('✅ RESULT: All systems operational with persistent storage');
} else {
  console.log('⚠️  RESULT: System operational but using temporary storage');
  console.log('   Data will be lost on addon restart!');
}
