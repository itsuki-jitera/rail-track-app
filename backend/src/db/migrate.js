/**
 * Database Migration Runner
 * Handles database schema creation and updates
 */

const fs = require('fs').promises;
const path = require('path');
const { getConnection } = require('./connection');

class MigrationRunner {
  constructor() {
    this.db = getConnection();
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    console.log('Starting database migration...');

    try {
      // Initialize database connection
      await this.db.initialize();

      // Create migrations table if not exists
      await this.createMigrationsTable();

      // Get migration files
      const migrationFiles = await this.getMigrationFiles();

      // Get completed migrations
      const completedMigrations = await this.getCompletedMigrations();

      // Run pending migrations
      for (const file of migrationFiles) {
        if (!completedMigrations.includes(file)) {
          await this.runMigration(file);
        }
      }

      console.log('Database migration completed successfully');
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.db.query(query);
  }

  /**
   * Get list of migration files
   */
  async getMigrationFiles() {
    const files = await fs.readdir(this.migrationsPath);
    return files
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order
  }

  /**
   * Get list of completed migrations
   */
  async getCompletedMigrations() {
    const result = await this.db.query('SELECT filename FROM migrations');
    return result.rows.map(row => row.filename);
  }

  /**
   * Run a single migration file
   */
  async runMigration(filename) {
    console.log(`Running migration: ${filename}`);

    const filepath = path.join(this.migrationsPath, filename);
    const sql = await fs.readFile(filepath, 'utf8');

    // Begin transaction
    const client = await this.db.beginTransaction();

    try {
      // Split SQL into individual statements (simple approach)
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Execute each statement
      for (const statement of statements) {
        if (statement.trim()) {
          await client.query(statement);
        }
      }

      // Record migration as completed
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );

      // Commit transaction
      await this.db.commitTransaction(client);
      console.log(`Migration ${filename} completed successfully`);
    } catch (error) {
      // Rollback on error
      await this.db.rollbackTransaction(client);
      console.error(`Migration ${filename} failed:`, error);
      throw error;
    }
  }

  /**
   * Rollback last migration
   */
  async rollbackLastMigration() {
    console.log('Rolling back last migration...');

    try {
      // Get last migration
      const result = await this.db.query(
        'SELECT filename FROM migrations ORDER BY executed_at DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        console.log('No migrations to rollback');
        return;
      }

      const filename = result.rows[0].filename;
      const rollbackFile = filename.replace('.sql', '_rollback.sql');
      const rollbackPath = path.join(this.migrationsPath, rollbackFile);

      // Check if rollback file exists
      try {
        await fs.access(rollbackPath);
      } catch (error) {
        console.error(`Rollback file not found: ${rollbackFile}`);
        throw new Error('Cannot rollback: no rollback script found');
      }

      // Execute rollback
      const sql = await fs.readFile(rollbackPath, 'utf8');
      const client = await this.db.beginTransaction();

      try {
        await client.query(sql);
        await client.query(
          'DELETE FROM migrations WHERE filename = $1',
          [filename]
        );
        await this.db.commitTransaction(client);
        console.log(`Rollback of ${filename} completed successfully`);
      } catch (error) {
        await this.db.rollbackTransaction(client);
        throw error;
      }
    } catch (error) {
      console.error('Rollback error:', error);
      throw error;
    }
  }

  /**
   * Reset database (dangerous - drops all tables)
   */
  async resetDatabase() {
    console.log('WARNING: Resetting database - all data will be lost!');

    const query = `
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
    `;

    try {
      await this.db.query(query);
      console.log('Database reset completed');
    } catch (error) {
      console.error('Database reset error:', error);
      throw error;
    }
  }

  /**
   * Check migration status
   */
  async checkStatus() {
    try {
      await this.db.initialize();

      const migrations = await this.getMigrationFiles();
      const completed = await this.getCompletedMigrations();

      console.log('Migration Status:');
      console.log('-----------------');

      for (const migration of migrations) {
        const status = completed.includes(migration) ? '✓' : '✗';
        console.log(`${status} ${migration}`);
      }

      console.log('-----------------');
      console.log(`Total: ${migrations.length} | Completed: ${completed.length} | Pending: ${migrations.length - completed.length}`);
    } catch (error) {
      console.error('Status check error:', error);
    }
  }
}

// CLI interface
if (require.main === module) {
  const runner = new MigrationRunner();
  const command = process.argv[2];

  async function execute() {
    try {
      switch (command) {
        case 'up':
        case 'migrate':
          await runner.runMigrations();
          break;

        case 'down':
        case 'rollback':
          await runner.rollbackLastMigration();
          break;

        case 'reset':
          if (process.argv[3] === '--force') {
            await runner.resetDatabase();
          } else {
            console.log('Use --force flag to confirm database reset');
          }
          break;

        case 'status':
          await runner.checkStatus();
          break;

        default:
          console.log('Database Migration Tool');
          console.log('Usage: node migrate.js [command]');
          console.log('');
          console.log('Commands:');
          console.log('  up, migrate    Run pending migrations');
          console.log('  down, rollback Rollback last migration');
          console.log('  status         Check migration status');
          console.log('  reset --force  Reset database (WARNING: deletes all data)');
      }
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    } finally {
      const db = getConnection();
      await db.close();
    }
  }

  execute();
}

module.exports = MigrationRunner;