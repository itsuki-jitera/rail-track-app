/**
 * History Repository
 * Manages calculation history and audit trails
 */

const { getConnection } = require('../connection');

class HistoryRepository {
  constructor() {
    this.db = getConnection();
  }

  /**
   * Record export history
   */
  async recordExport(exportData) {
    const {
      resultId,
      exportFormat,
      filePath,
      fileSize,
      exportedBy
    } = exportData;

    const query = `
      INSERT INTO export_history (
        result_id, export_format, file_path,
        file_size, exported_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, exported_at
    `;

    const values = [resultId, exportFormat, filePath, fileSize, exportedBy];
    const result = await this.db.query(query, values);

    return {
      id: result.rows[0].id,
      exportedAt: result.rows[0].exported_at
    };
  }

  /**
   * Get export history for calculation
   */
  async getExportHistory(resultId) {
    const query = `
      SELECT
        eh.*,
        u.username as exported_by_name
      FROM export_history eh
      LEFT JOIN users u ON eh.exported_by = u.id
      WHERE eh.result_id = $1
      ORDER BY eh.exported_at DESC
    `;

    const result = await this.db.query(query, [resultId]);
    return result.rows;
  }

  /**
   * Increment download count
   */
  async incrementDownloadCount(exportId) {
    const query = `
      UPDATE export_history
      SET download_count = download_count + 1
      WHERE id = $1
      RETURNING download_count
    `;

    const result = await this.db.query(query, [exportId]);
    return result.rows[0]?.download_count;
  }

  /**
   * Log system event
   */
  async logSystemEvent(logData) {
    const {
      logLevel,
      category,
      message,
      details,
      userId,
      ipAddress,
      userAgent
    } = logData;

    const query = `
      INSERT INTO system_logs (
        log_level, category, message, details,
        user_id, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const values = [
      logLevel,
      category,
      message,
      details ? JSON.stringify(details) : null,
      userId,
      ipAddress,
      userAgent
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  /**
   * Get system logs
   */
  async getSystemLogs(filters = {}) {
    const {
      logLevel,
      category,
      userId,
      startDate,
      endDate,
      searchTerm,
      limit = 100,
      offset = 0
    } = filters;

    let query = `
      SELECT
        sl.*,
        u.username
      FROM system_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (logLevel) {
      query += ` AND sl.log_level = $${paramIndex++}`;
      params.push(logLevel);
    }

    if (category) {
      query += ` AND sl.category = $${paramIndex++}`;
      params.push(category);
    }

    if (userId) {
      query += ` AND sl.user_id = $${paramIndex++}`;
      params.push(userId);
    }

    if (startDate) {
      query += ` AND sl.created_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND sl.created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    if (searchTerm) {
      query += ` AND sl.message ILIKE $${paramIndex++}`;
      params.push(`%${searchTerm}%`);
    }

    query += ` ORDER BY sl.created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Record audit trail
   */
  async recordAudit(auditData) {
    const {
      tableName,
      recordId,
      action,
      oldValues,
      newValues,
      changedBy
    } = auditData;

    const query = `
      INSERT INTO audit_trail (
        table_name, record_id, action,
        old_values, new_values, changed_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const values = [
      tableName,
      recordId,
      action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      changedBy
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  /**
   * Get audit trail for record
   */
  async getAuditTrail(tableName, recordId) {
    const query = `
      SELECT
        at.*,
        u.username as changed_by_name
      FROM audit_trail at
      LEFT JOIN users u ON at.changed_by = u.id
      WHERE at.table_name = $1 AND at.record_id = $2
      ORDER BY at.changed_at DESC
    `;

    const result = await this.db.query(query, [tableName, recordId]);
    return result.rows;
  }

  /**
   * Get user activity history
   */
  async getUserActivity(userId, days = 30) {
    const query = `
      WITH activity AS (
        SELECT 'calculation' as type, created_at
        FROM calculation_results
        WHERE created_by = $1
          AND created_at >= NOW() - INTERVAL '${days} days'

        UNION ALL

        SELECT 'export' as type, exported_at as created_at
        FROM export_history
        WHERE exported_by = $1
          AND exported_at >= NOW() - INTERVAL '${days} days'

        UNION ALL

        SELECT 'session' as type, created_at
        FROM measurement_sessions
        WHERE operator_id = $1
          AND created_at >= NOW() - INTERVAL '${days} days'
      )
      SELECT
        DATE_TRUNC('day', created_at) as date,
        type,
        COUNT(*) as count
      FROM activity
      GROUP BY date, type
      ORDER BY date DESC, type
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Clean old logs
   */
  async cleanOldLogs(daysToKeep = 90) {
    const client = await this.db.beginTransaction();

    try {
      // Clean system logs
      const logsQuery = `
        DELETE FROM system_logs
        WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
      `;
      const logsResult = await client.query(logsQuery);

      // Clean old export history (keep metadata, remove file paths)
      const exportsQuery = `
        UPDATE export_history
        SET file_path = NULL
        WHERE exported_at < NOW() - INTERVAL '${daysToKeep * 2} days'
      `;
      const exportsResult = await client.query(exportsQuery);

      await this.db.commitTransaction(client);

      return {
        logsDeleted: logsResult.rowCount,
        exportsCleared: exportsResult.rowCount
      };
    } catch (error) {
      await this.db.rollbackTransaction(client);
      throw error;
    }
  }

  /**
   * Get calculation history timeline
   */
  async getCalculationTimeline(options = {}) {
    const { projectId, sessionId, limit = 100 } = options;

    let query = `
      SELECT
        'calculation' as event_type,
        cr.id as event_id,
        cr.calculation_type as event_subtype,
        cr.created_at as event_time,
        cr.quality_score,
        ms.session_name,
        p.name as project_name,
        u.username as user_name
      FROM calculation_results cr
      LEFT JOIN measurement_sessions ms ON cr.session_id = ms.id
      LEFT JOIN projects p ON ms.project_id = p.id
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (projectId) {
      query += ` AND ms.project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    if (sessionId) {
      query += ` AND cr.session_id = $${paramIndex++}`;
      params.push(sessionId);
    }

    query += `
      ORDER BY event_time DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get performance metrics
   */
  async recordPerformanceMetric(metric) {
    const { metricType, metricName, value, unit, context } = metric;

    const query = `
      INSERT INTO performance_metrics (
        metric_type, metric_name, value, unit, context
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const values = [
      metricType,
      metricName,
      value,
      unit,
      context ? JSON.stringify(context) : null
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  /**
   * Get performance metrics summary
   */
  async getPerformanceMetrics(metricType, hours = 24) {
    const query = `
      SELECT
        metric_name,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value,
        COUNT(*) as sample_count,
        unit
      FROM performance_metrics
      WHERE metric_type = $1
        AND recorded_at >= NOW() - INTERVAL '${hours} hours'
      GROUP BY metric_name, unit
    `;

    const result = await this.db.query(query, [metricType]);
    return result.rows;
  }
}

module.exports = HistoryRepository;