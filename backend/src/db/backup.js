/**
 * Database Backup and Restore Utilities
 * Handles database backup, restore, and maintenance operations
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const archiver = require('archiver');
const config = require('./config');
const { getConnection } = require('./connection');

class DatabaseBackup {
  constructor() {
    this.db = getConnection();
    this.backupPath = path.join(__dirname, '../../backups');
  }

  /**
   * Initialize backup directory
   */
  async initBackupDirectory() {
    try {
      await fs.mkdir(this.backupPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create backup directory:', error);
    }
  }

  /**
   * Create full database backup
   */
  async createBackup(options = {}) {
    const {
      format = 'custom', // custom, plain, directory, tar
      compress = true,
      includeData = true,
      includeLargeObjects = false
    } = options;

    await this.initBackupDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.${format === 'plain' ? 'sql' : 'backup'}`;
    const filepath = path.join(this.backupPath, filename);

    try {
      const pgConfig = config.postgresql;
      const connectionString = `postgresql://${pgConfig.user}:${pgConfig.password}@${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`;

      // Build pg_dump command
      let command = `pg_dump "${connectionString}"`;
      command += ` --format=${format}`;
      command += ` --file="${filepath}"`;

      if (compress && format === 'custom') {
        command += ' --compress=9';
      }

      if (!includeData) {
        command += ' --schema-only';
      }

      if (includeLargeObjects) {
        command += ' --blobs';
      }

      command += ' --verbose';
      command += ' --no-owner';
      command += ' --no-privileges';

      console.log('Starting database backup...');
      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes('dumping')) {
        console.warn('Backup warnings:', stderr);
      }

      // Get file size
      const stats = await fs.stat(filepath);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      // Create metadata file
      const metadataPath = filepath + '.meta.json';
      const metadata = {
        timestamp,
        filename,
        filepath,
        format,
        size: stats.size,
        sizeFormatted: `${fileSizeInMB} MB`,
        includeData,
        database: pgConfig.database,
        createdAt: new Date().toISOString(),
        checksum: await this.calculateChecksum(filepath)
      };

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      console.log(`Backup completed: ${filename} (${fileSizeInMB} MB)`);

      return metadata;
    } catch (error) {
      console.error('Backup error:', error);
      throw new Error(`Backup failed: ${error.message}`);
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(backupFile, options = {}) {
    const {
      clean = false, // Drop database objects before recreating
      dataOnly = false,
      schemaOnly = false,
      exitOnError = true
    } = options;

    const filepath = path.join(this.backupPath, backupFile);

    // Check if backup file exists
    try {
      await fs.access(filepath);
    } catch (error) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    try {
      const pgConfig = config.postgresql;
      const connectionString = `postgresql://${pgConfig.user}:${pgConfig.password}@${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`;

      // Build pg_restore command
      let command = `pg_restore "${connectionString}"`;
      command += ` "${filepath}"`;

      if (clean) {
        command += ' --clean';
      }

      if (dataOnly) {
        command += ' --data-only';
      }

      if (schemaOnly) {
        command += ' --schema-only';
      }

      if (exitOnError) {
        command += ' --exit-on-error';
      }

      command += ' --verbose';
      command += ' --no-owner';
      command += ' --no-privileges';

      console.log('Starting database restore...');
      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes('processing')) {
        console.warn('Restore warnings:', stderr);
      }

      console.log(`Database restored from: ${backupFile}`);

      return {
        success: true,
        backupFile,
        restoredAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Restore error:', error);
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    await this.initBackupDirectory();

    try {
      const files = await fs.readdir(this.backupPath);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.meta.json')) {
          const metadataPath = path.join(this.backupPath, file);
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
          backups.push(metadata);
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return backups;
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  /**
   * Delete old backups
   */
  async cleanupOldBackups(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const backups = await this.listBackups();
    const deletedBackups = [];

    for (const backup of backups) {
      const backupDate = new Date(backup.createdAt);
      if (backupDate < cutoffDate) {
        try {
          await fs.unlink(backup.filepath);
          await fs.unlink(backup.filepath + '.meta.json');
          deletedBackups.push(backup.filename);
        } catch (error) {
          console.error(`Failed to delete backup ${backup.filename}:`, error);
        }
      }
    }

    console.log(`Deleted ${deletedBackups.length} old backups`);
    return deletedBackups;
  }

  /**
   * Export specific tables
   */
  async exportTables(tables, format = 'csv') {
    await this.initBackupDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportDir = path.join(this.backupPath, `export_${timestamp}`);
    await fs.mkdir(exportDir, { recursive: true });

    const exported = [];

    for (const table of tables) {
      try {
        if (format === 'csv') {
          await this.exportTableToCSV(table, exportDir);
        } else if (format === 'json') {
          await this.exportTableToJSON(table, exportDir);
        }
        exported.push(table);
      } catch (error) {
        console.error(`Failed to export table ${table}:`, error);
      }
    }

    // Create archive
    const archivePath = `${exportDir}.zip`;
    await this.createArchive(exportDir, archivePath);

    // Clean up directory
    await this.removeDirectory(exportDir);

    return {
      exported,
      archivePath,
      timestamp
    };
  }

  /**
   * Export table to CSV
   */
  async exportTableToCSV(tableName, outputDir) {
    const outputFile = path.join(outputDir, `${tableName}.csv`);
    const pgConfig = config.postgresql;

    const query = `COPY ${tableName} TO STDOUT WITH CSV HEADER`;
    const command = `psql "postgresql://${pgConfig.user}:${pgConfig.password}@${pgConfig.host}:${pgConfig.port}/${pgConfig.database}" -c "${query}" > "${outputFile}"`;

    await execAsync(command);
  }

  /**
   * Export table to JSON
   */
  async exportTableToJSON(tableName, outputDir) {
    await this.db.initialize();

    const query = `SELECT * FROM ${tableName}`;
    const result = await this.db.query(query);

    const outputFile = path.join(outputDir, `${tableName}.json`);
    await fs.writeFile(outputFile, JSON.stringify(result.rows, null, 2));
  }

  /**
   * Create archive from directory
   */
  async createArchive(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(archive.pointer()));
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  /**
   * Calculate file checksum
   */
  async calculateChecksum(filepath) {
    const crypto = require('crypto');
    const fileBuffer = await fs.readFile(filepath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  /**
   * Remove directory recursively
   */
  async removeDirectory(dirPath) {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await this.removeDirectory(filePath);
      } else {
        await fs.unlink(filePath);
      }
    }
    await fs.rmdir(dirPath);
  }

  /**
   * Database maintenance operations
   */
  async runMaintenance() {
    await this.db.initialize();

    const maintenanceQueries = [
      // Update statistics
      'ANALYZE',

      // Reindex tables
      'REINDEX DATABASE CONCURRENTLY',

      // Vacuum (reclaim storage)
      'VACUUM ANALYZE',

      // Refresh materialized views
      'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_calculation_statistics'
    ];

    const results = [];

    for (const query of maintenanceQueries) {
      try {
        await this.db.query(query);
        results.push({ query, status: 'success' });
      } catch (error) {
        results.push({ query, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  /**
   * Get database size information
   */
  async getDatabaseSize() {
    await this.db.initialize();

    const sizeQuery = `
      SELECT
        pg_database_size(current_database()) as total_size,
        pg_size_pretty(pg_database_size(current_database())) as total_size_formatted
    `;

    const tableQuery = `
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;

    const [dbSize, tableSizes] = await Promise.all([
      this.db.query(sizeQuery),
      this.db.query(tableQuery)
    ]);

    return {
      database: {
        size: dbSize.rows[0].total_size,
        formatted: dbSize.rows[0].total_size_formatted
      },
      tables: tableSizes.rows
    };
  }
}

// CLI interface
if (require.main === module) {
  const backup = new DatabaseBackup();
  const command = process.argv[2];
  const args = process.argv.slice(3);

  async function execute() {
    try {
      switch (command) {
        case 'backup':
          const backupResult = await backup.createBackup();
          console.log('Backup created:', backupResult);
          break;

        case 'restore':
          if (!args[0]) {
            console.error('Please provide backup filename');
            process.exit(1);
          }
          const restoreResult = await backup.restoreBackup(args[0]);
          console.log('Restore completed:', restoreResult);
          break;

        case 'list':
          const backups = await backup.listBackups();
          console.log('Available backups:');
          backups.forEach(b => {
            console.log(`  ${b.filename} - ${b.sizeFormatted} - ${b.createdAt}`);
          });
          break;

        case 'cleanup':
          const days = parseInt(args[0]) || 30;
          const deleted = await backup.cleanupOldBackups(days);
          console.log('Deleted backups:', deleted);
          break;

        case 'export':
          const tables = args[0] ? args[0].split(',') : [
            'users', 'projects', 'measurement_sessions',
            'calculation_results', 'versine_data'
          ];
          const exportResult = await backup.exportTables(tables);
          console.log('Export completed:', exportResult);
          break;

        case 'maintenance':
          const maintenanceResult = await backup.runMaintenance();
          console.log('Maintenance completed:', maintenanceResult);
          break;

        case 'size':
          const sizeInfo = await backup.getDatabaseSize();
          console.log('Database size:', sizeInfo.database.formatted);
          console.log('Table sizes:');
          sizeInfo.tables.forEach(t => {
            console.log(`  ${t.tablename}: ${t.size}`);
          });
          break;

        default:
          console.log('Database Backup Tool');
          console.log('Usage: node backup.js [command] [options]');
          console.log('');
          console.log('Commands:');
          console.log('  backup           Create full database backup');
          console.log('  restore [file]   Restore database from backup');
          console.log('  list            List available backups');
          console.log('  cleanup [days]   Delete backups older than X days');
          console.log('  export [tables]  Export specific tables to CSV/JSON');
          console.log('  maintenance      Run database maintenance tasks');
          console.log('  size            Show database size information');
      }
    } catch (error) {
      console.error('Operation failed:', error);
      process.exit(1);
    } finally {
      const db = getConnection();
      await db.close();
    }
  }

  execute();
}

module.exports = DatabaseBackup;