/**
 * Calculation Repository
 * Data access layer for calculation results
 */

const { getConnection } = require('../connection');

class CalculationRepository {
  constructor() {
    this.db = getConnection();
  }

  /**
   * Save calculation result
   */
  async saveCalculation(data) {
    const {
      sessionId,
      calculationType,
      parameters,
      processingTimeMs,
      resultSummary,
      qualityScore,
      createdBy,
      versineData
    } = data;

    const client = await this.db.beginTransaction();

    try {
      // Insert calculation result
      const calculationQuery = `
        INSERT INTO calculation_results (
          session_id, calculation_type, parameters,
          processing_time_ms, result_summary, quality_score, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, created_at
      `;

      const calculationValues = [
        sessionId,
        calculationType,
        JSON.stringify(parameters),
        processingTimeMs,
        JSON.stringify(resultSummary),
        qualityScore,
        createdBy
      ];

      const result = await client.query(calculationQuery, calculationValues);
      const resultId = result.rows[0].id;

      // Insert versine data if provided
      if (versineData && versineData.length > 0) {
        await this.saveVersineData(client, resultId, versineData);
      }

      await this.db.commitTransaction(client);

      // Invalidate cache
      await this.db.deleteCached(`calc_${sessionId}_*`);

      return {
        id: resultId,
        createdAt: result.rows[0].created_at,
        success: true
      };
    } catch (error) {
      await this.db.rollbackTransaction(client);
      console.error('Error saving calculation:', error);
      throw error;
    }
  }

  /**
   * Save versine data points
   */
  async saveVersineData(client, resultId, versineData) {
    // Prepare bulk insert
    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    versineData.forEach((point, index) => {
      placeholders.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      );
      values.push(
        resultId,
        point.position,
        point.versine10m,
        point.versine10mRestored,
        point.restorationAmount,
        point.angle,
        point.radius,
        point.qualityFlag
      );
    });

    const query = `
      INSERT INTO versine_data (
        result_id, position, versine_10m, versine_10m_restored,
        restoration_amount, angle, radius, quality_flag
      ) VALUES ${placeholders.join(', ')}
    `;

    await client.query(query, values);
  }

  /**
   * Get calculation by ID
   */
  async getCalculation(id) {
    // Check cache first
    const cached = await this.db.getCached(`calc_${id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const query = `
      SELECT
        cr.*,
        ms.session_name,
        ms.original_filename,
        ms.data_points,
        p.name as project_name,
        u.username as created_by_username
      FROM calculation_results cr
      LEFT JOIN measurement_sessions ms ON cr.session_id = ms.id
      LEFT JOIN projects p ON ms.project_id = p.id
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE cr.id = $1
    `;

    const result = await this.db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const calculation = result.rows[0];

    // Cache result
    await this.db.setCached(
      `calc_${id}`,
      JSON.stringify(calculation),
      3600
    );

    return calculation;
  }

  /**
   * Get versine data for calculation
   */
  async getVersineData(resultId, options = {}) {
    const { limit, offset, minPosition, maxPosition } = options;

    let query = `
      SELECT * FROM versine_data
      WHERE result_id = $1
    `;
    const params = [resultId];
    let paramIndex = 2;

    if (minPosition !== undefined) {
      query += ` AND position >= $${paramIndex++}`;
      params.push(minPosition);
    }

    if (maxPosition !== undefined) {
      query += ` AND position <= $${paramIndex++}`;
      params.push(maxPosition);
    }

    query += ' ORDER BY position';

    if (limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(limit);
    }

    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
    }

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Search calculations
   */
  async searchCalculations(filters = {}) {
    const {
      calculationType,
      sessionId,
      projectId,
      createdBy,
      startDate,
      endDate,
      minQuality,
      limit = 50,
      offset = 0
    } = filters;

    let query = `
      SELECT
        cr.id,
        cr.calculation_type,
        cr.parameters,
        cr.processing_time_ms,
        cr.quality_score,
        cr.created_at,
        ms.session_name,
        ms.original_filename,
        p.name as project_name,
        u.username as created_by_username
      FROM calculation_results cr
      LEFT JOIN measurement_sessions ms ON cr.session_id = ms.id
      LEFT JOIN projects p ON ms.project_id = p.id
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (calculationType) {
      query += ` AND cr.calculation_type = $${paramIndex++}`;
      params.push(calculationType);
    }

    if (sessionId) {
      query += ` AND cr.session_id = $${paramIndex++}`;
      params.push(sessionId);
    }

    if (projectId) {
      query += ` AND ms.project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    if (createdBy) {
      query += ` AND cr.created_by = $${paramIndex++}`;
      params.push(createdBy);
    }

    if (startDate) {
      query += ` AND cr.created_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND cr.created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    if (minQuality) {
      query += ` AND cr.quality_score >= $${paramIndex++}`;
      params.push(minQuality);
    }

    query += ` ORDER BY cr.created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get calculation statistics
   */
  async getStatistics(options = {}) {
    const { startDate, endDate, groupBy = 'day' } = options;

    let dateFormat;
    switch (groupBy) {
      case 'hour':
        dateFormat = 'YYYY-MM-DD HH24:00:00';
        break;
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'YYYY-IW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    let query = `
      SELECT
        TO_CHAR(created_at, '${dateFormat}') as period,
        calculation_type,
        COUNT(*) as count,
        AVG(processing_time_ms) as avg_processing_time,
        AVG(quality_score) as avg_quality,
        MIN(quality_score) as min_quality,
        MAX(quality_score) as max_quality
      FROM calculation_results
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += `
      GROUP BY period, calculation_type
      ORDER BY period DESC, calculation_type
    `;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Delete calculation and related data
   */
  async deleteCalculation(id) {
    const query = 'DELETE FROM calculation_results WHERE id = $1';
    const result = await this.db.query(query, [id]);

    // Clear cache
    await this.db.deleteCached(`calc_${id}`);

    return result.rowCount > 0;
  }

  /**
   * Update calculation quality score
   */
  async updateQualityScore(id, qualityScore) {
    const query = `
      UPDATE calculation_results
      SET quality_score = $1
      WHERE id = $2
      RETURNING id
    `;

    const result = await this.db.query(query, [qualityScore, id]);

    // Clear cache
    await this.db.deleteCached(`calc_${id}`);

    return result.rowCount > 0;
  }

  /**
   * Get recent calculations
   */
  async getRecentCalculations(limit = 10) {
    const query = `
      SELECT * FROM v_recent_calculations
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows;
  }

  /**
   * Compare calculations
   */
  async compareCalculations(ids) {
    if (ids.length < 2) {
      throw new Error('At least 2 calculation IDs required for comparison');
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      SELECT
        cr.id,
        cr.calculation_type,
        cr.parameters,
        cr.quality_score,
        cr.created_at,
        ms.session_name,
        COUNT(vd.id) as data_points,
        AVG(vd.restoration_amount) as avg_restoration,
        STDDEV(vd.restoration_amount) as restoration_stddev
      FROM calculation_results cr
      LEFT JOIN measurement_sessions ms ON cr.session_id = ms.id
      LEFT JOIN versine_data vd ON vd.result_id = cr.id
      WHERE cr.id IN (${placeholders})
      GROUP BY cr.id, cr.calculation_type, cr.parameters,
               cr.quality_score, cr.created_at, ms.session_name
    `;

    const result = await this.db.query(query, ids);
    return result.rows;
  }
}

module.exports = CalculationRepository;