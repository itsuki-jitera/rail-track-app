/**
 * Session Repository
 * Data access layer for measurement sessions
 */

const { getConnection } = require('../connection');

class SessionRepository {
  constructor() {
    this.db = getConnection();
  }

  /**
   * Create new measurement session
   */
  async createSession(sessionData) {
    const {
      projectId,
      sessionName,
      measurementType,
      filePath,
      originalFilename,
      fileSize,
      dataPoints,
      startPosition,
      endPosition,
      measurementInterval,
      speed,
      temperature,
      weatherCondition,
      operatorId,
      notes
    } = sessionData;

    const query = `
      INSERT INTO measurement_sessions (
        project_id, session_name, measurement_type,
        file_path, original_filename, file_size,
        data_points, start_position, end_position,
        measurement_interval, speed, temperature,
        weather_condition, operator_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, created_at
    `;

    const values = [
      projectId,
      sessionName,
      measurementType || 'versine',
      filePath,
      originalFilename,
      fileSize,
      dataPoints,
      startPosition,
      endPosition,
      measurementInterval || 0.25,
      speed,
      temperature,
      weatherCondition,
      operatorId,
      notes
    ];

    const result = await this.db.query(query, values);
    return {
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at
    };
  }

  /**
   * Get session by ID
   */
  async getSession(id) {
    const query = `
      SELECT
        ms.*,
        p.name as project_name,
        p.railway_line,
        u.username as operator_name,
        COUNT(DISTINCT cr.id) as calculation_count
      FROM measurement_sessions ms
      LEFT JOIN projects p ON ms.project_id = p.id
      LEFT JOIN users u ON ms.operator_id = u.id
      LEFT JOIN calculation_results cr ON cr.session_id = ms.id
      WHERE ms.id = $1
      GROUP BY ms.id, p.name, p.railway_line, u.username
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get sessions for project
   */
  async getProjectSessions(projectId) {
    const query = `
      SELECT
        ms.*,
        u.username as operator_name,
        COUNT(DISTINCT cr.id) as calculation_count
      FROM measurement_sessions ms
      LEFT JOIN users u ON ms.operator_id = u.id
      LEFT JOIN calculation_results cr ON cr.session_id = ms.id
      WHERE ms.project_id = $1
      GROUP BY ms.id, u.username
      ORDER BY ms.created_at DESC
    `;

    const result = await this.db.query(query, [projectId]);
    return result.rows;
  }

  /**
   * Search sessions
   */
  async searchSessions(filters = {}) {
    const {
      projectId,
      measurementType,
      operatorId,
      startDate,
      endDate,
      searchTerm,
      limit = 50,
      offset = 0
    } = filters;

    let query = `
      SELECT
        ms.*,
        p.name as project_name,
        u.username as operator_name,
        COUNT(DISTINCT cr.id) as calculation_count
      FROM measurement_sessions ms
      LEFT JOIN projects p ON ms.project_id = p.id
      LEFT JOIN users u ON ms.operator_id = u.id
      LEFT JOIN calculation_results cr ON cr.session_id = ms.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (projectId) {
      query += ` AND ms.project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    if (measurementType) {
      query += ` AND ms.measurement_type = $${paramIndex++}`;
      params.push(measurementType);
    }

    if (operatorId) {
      query += ` AND ms.operator_id = $${paramIndex++}`;
      params.push(operatorId);
    }

    if (startDate) {
      query += ` AND ms.created_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND ms.created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    if (searchTerm) {
      query += ` AND (ms.session_name ILIKE $${paramIndex} OR ms.original_filename ILIKE $${paramIndex} OR ms.notes ILIKE $${paramIndex})`;
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    query += `
      GROUP BY ms.id, p.name, u.username
      ORDER BY ms.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Update session
   */
  async updateSession(id, updates) {
    const allowedFields = [
      'session_name',
      'notes',
      'weather_condition',
      'temperature',
      'speed'
    ];

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramIndex++}`);
        values.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return false;
    }

    values.push(id);
    const query = `
      UPDATE measurement_sessions
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id
    `;

    const result = await this.db.query(query, values);
    return result.rowCount > 0;
  }

  /**
   * Delete session and related data
   */
  async deleteSession(id) {
    // Cascading delete will handle related calculation_results and versine_data
    const query = 'DELETE FROM measurement_sessions WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(sessionId) {
    const query = `
      SELECT
        ms.id,
        ms.data_points,
        COUNT(DISTINCT cr.id) as total_calculations,
        AVG(cr.quality_score) as avg_quality,
        MIN(cr.created_at) as first_calculation,
        MAX(cr.created_at) as last_calculation,
        SUM(cr.processing_time_ms) as total_processing_time
      FROM measurement_sessions ms
      LEFT JOIN calculation_results cr ON cr.session_id = ms.id
      WHERE ms.id = $1
      GROUP BY ms.id, ms.data_points
    `;

    const result = await this.db.query(query, [sessionId]);
    return result.rows[0] || null;
  }

  /**
   * Get recent sessions
   */
  async getRecentSessions(limit = 10) {
    const query = `
      SELECT
        ms.*,
        p.name as project_name,
        u.username as operator_name
      FROM measurement_sessions ms
      LEFT JOIN projects p ON ms.project_id = p.id
      LEFT JOIN users u ON ms.operator_id = u.id
      ORDER BY ms.created_at DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows;
  }
}

module.exports = SessionRepository;