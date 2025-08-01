const { getDatabase } = require('../utils/databaseManager');

// This module is now a proxy to the centralized databaseManager.
// It ensures that other parts of the application that require it
// can still get the database instance without causing circular dependencies.

module.exports = {
  getDatabase,
};
