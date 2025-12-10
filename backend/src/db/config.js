/**
 * Database Configuration
 * PostgreSQL and Oracle connection settings
 */

const config = {
  // Default database type
  defaultType: process.env.DB_TYPE || 'postgresql',

  // PostgreSQL configuration
  postgresql: {
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE || 'railtrack_db',
    user: process.env.PG_USER || 'railtrack_user',
    password: process.env.PG_PASSWORD || 'railtrack_password',

    // Connection pool settings
    pool: {
      min: parseInt(process.env.PG_POOL_MIN) || 2,
      max: parseInt(process.env.PG_POOL_MAX) || 10,
      idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT) || 2000
    },

    // SSL configuration
    ssl: process.env.PG_SSL === 'true' ? {
      rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false'
    } : false
  },

  // Oracle configuration
  oracle: {
    user: process.env.ORACLE_USER || 'railtrack_user',
    password: process.env.ORACLE_PASSWORD || 'railtrack_password',
    connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/XEPDB1',

    // Connection pool settings
    poolMin: parseInt(process.env.ORACLE_POOL_MIN) || 2,
    poolMax: parseInt(process.env.ORACLE_POOL_MAX) || 10,
    poolIncrement: parseInt(process.env.ORACLE_POOL_INCREMENT) || 1,
    poolTimeout: parseInt(process.env.ORACLE_POOL_TIMEOUT) || 60,

    // Performance tuning
    prefetchRows: parseInt(process.env.ORACLE_PREFETCH_ROWS) || 100,
    stmtCacheSize: parseInt(process.env.ORACLE_STMT_CACHE_SIZE) || 30
  },

  // Redis cache configuration (optional)
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB) || 0,
    ttl: parseInt(process.env.REDIS_TTL) || 3600 // seconds
  }
};

module.exports = config;