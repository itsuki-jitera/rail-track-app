/**
 * Database Connection Manager
 * Handles connections to PostgreSQL and Oracle databases
 */

const { Pool } = require('pg');
const config = require('./config');

class DatabaseConnection {
  constructor() {
    this.type = config.defaultType;
    this.pool = null;
    this.oracleConnection = null;
    this.redisClient = null;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    try {
      if (this.type === 'postgresql') {
        await this.initializePostgreSQL();
      } else if (this.type === 'oracle') {
        await this.initializeOracle();
      }

      // Initialize Redis cache if enabled
      if (config.redis.enabled) {
        await this.initializeRedis();
      }

      console.log(`Database connection established: ${this.type}`);
      return true;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  async initializePostgreSQL() {
    this.pool = new Pool(config.postgresql);

    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT NOW()');
      console.log('PostgreSQL connection successful');
    } finally {
      client.release();
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });
  }

  /**
   * Initialize Oracle connection
   * Note: Requires oracledb package installation
   */
  async initializeOracle() {
    try {
      const oracledb = require('oracledb');

      // Initialize Oracle client
      if (process.platform === 'win32') {
        oracledb.initOracleClient({
          libDir: process.env.ORACLE_CLIENT_PATH || 'C:\\oracle\\instantclient'
        });
      }

      // Create connection pool
      this.oracleConnection = await oracledb.createPool(config.oracle);

      // Test connection
      const connection = await this.oracleConnection.getConnection();
      try {
        const result = await connection.execute('SELECT SYSDATE FROM DUAL');
        console.log('Oracle connection successful:', result.rows[0][0]);
      } finally {
        await connection.close();
      }
    } catch (error) {
      console.error('Oracle initialization requires oracledb package:', error);
      throw new Error('Oracle database driver not installed. Run: npm install oracledb');
    }
  }

  /**
   * Initialize Redis connection
   */
  async initializeRedis() {
    try {
      const redis = require('redis');

      this.redisClient = redis.createClient({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db
      });

      await this.redisClient.connect();
      console.log('Redis cache connection established');
    } catch (error) {
      console.warn('Redis initialization failed, continuing without cache:', error);
      this.redisClient = null;
    }
  }

  /**
   * Execute query (database agnostic)
   */
  async query(text, params = []) {
    if (this.type === 'postgresql') {
      return await this.queryPostgreSQL(text, params);
    } else if (this.type === 'oracle') {
      return await this.queryOracle(text, params);
    }
    throw new Error(`Unsupported database type: ${this.type}`);
  }

  /**
   * Execute PostgreSQL query
   */
  async queryPostgreSQL(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      throw error;
    }
  }

  /**
   * Execute Oracle query
   */
  async queryOracle(text, params) {
    const connection = await this.oracleConnection.getConnection();
    try {
      const result = await connection.execute(text, params, {
        outFormat: require('oracledb').OUT_FORMAT_OBJECT
      });
      return {
        rows: result.rows,
        rowCount: result.rows.length
      };
    } finally {
      await connection.close();
    }
  }

  /**
   * Begin transaction
   */
  async beginTransaction() {
    if (this.type === 'postgresql') {
      const client = await this.pool.connect();
      await client.query('BEGIN');
      return client;
    } else if (this.type === 'oracle') {
      return await this.oracleConnection.getConnection();
    }
  }

  /**
   * Commit transaction
   */
  async commitTransaction(client) {
    try {
      if (this.type === 'postgresql') {
        await client.query('COMMIT');
      } else if (this.type === 'oracle') {
        await client.commit();
      }
    } finally {
      await this.releaseTransaction(client);
    }
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(client) {
    try {
      if (this.type === 'postgresql') {
        await client.query('ROLLBACK');
      } else if (this.type === 'oracle') {
        await client.rollback();
      }
    } finally {
      await this.releaseTransaction(client);
    }
  }

  /**
   * Release transaction client
   */
  async releaseTransaction(client) {
    if (this.type === 'postgresql') {
      client.release();
    } else if (this.type === 'oracle') {
      await client.close();
    }
  }

  /**
   * Cache operations
   */
  async getCached(key) {
    if (!this.redisClient) return null;
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      console.warn('Redis get error:', error);
      return null;
    }
  }

  async setCached(key, value, ttl = config.redis.ttl) {
    if (!this.redisClient) return;
    try {
      await this.redisClient.set(key, value, { EX: ttl });
    } catch (error) {
      console.warn('Redis set error:', error);
    }
  }

  async deleteCached(key) {
    if (!this.redisClient) return;
    try {
      await this.redisClient.del(key);
    } catch (error) {
      console.warn('Redis delete error:', error);
    }
  }

  /**
   * Close all connections
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.end();
      }
      if (this.oracleConnection) {
        await this.oracleConnection.close();
      }
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      console.log('Database connections closed');
    } catch (error) {
      console.error('Error closing connections:', error);
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const stats = {
      type: this.type,
      connected: false,
      pool: {}
    };

    if (this.type === 'postgresql' && this.pool) {
      stats.connected = true;
      stats.pool = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      };
    } else if (this.type === 'oracle' && this.oracleConnection) {
      stats.connected = true;
      // Oracle pool stats would go here
    }

    return stats;
  }
}

// Singleton instance
let dbConnection = null;

module.exports = {
  getConnection: () => {
    if (!dbConnection) {
      dbConnection = new DatabaseConnection();
    }
    return dbConnection;
  },
  DatabaseConnection
};