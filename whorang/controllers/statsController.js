class StatsController {
  constructor(dependencies) {
    this.databaseManager = dependencies.databaseManager;
    this.getConnectedClients = dependencies.getConnectedClients;
    this.getStats = this.getStats.bind(this);
  }

  getStats(req, res) {
    const db = this.databaseManager.getDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const todayStmt = db.prepare('SELECT COUNT(*) as count FROM doorbell_events WHERE timestamp >= ?');
      const weekStmt = db.prepare('SELECT COUNT(*) as count FROM doorbell_events WHERE timestamp >= ?');
      const monthStmt = db.prepare('SELECT COUNT(*) as count FROM doorbell_events WHERE timestamp >= ?');
      const totalStmt = db.prepare('SELECT COUNT(*) as count FROM doorbell_events');

      const todayCount = todayStmt.get(today).count;
      const weekCount = weekStmt.get(weekAgo).count;
      const monthCount = monthStmt.get(monthAgo).count;
      const totalCount = totalStmt.get().count;

      const connectedClientsCount = this.getConnectedClients ? this.getConnectedClients() : 0;

      res.json({
        today: todayCount,
        week: weekCount,
        month: monthCount,
        total: totalCount,
        peakHour: 14, // Static value, could be calculated
        isOnline: connectedClientsCount > 0,
        connectedClients: connectedClientsCount,
      });
    } catch (err) {
      console.error('Error getting stats:', err);
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = StatsController;
