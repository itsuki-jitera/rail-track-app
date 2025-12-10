/**
 * User Repository
 * User management and authentication
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getConnection } = require('../connection');

class UserRepository {
  constructor() {
    this.db = getConnection();
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
  }

  /**
   * Create new user
   */
  async createUser(userData) {
    const { username, email, password, fullName, role } = userData;

    // Check if user already exists
    const existingUser = await this.findByUsernameOrEmail(username, email);
    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (
        username, email, password_hash, full_name, role
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, full_name, role, created_at
    `;

    const values = [
      username,
      email,
      passwordHash,
      fullName,
      role || 'user'
    ];

    const result = await this.db.query(query, values);
    const user = result.rows[0];

    // Don't return password hash
    delete user.password_hash;

    return user;
  }

  /**
   * Authenticate user
   */
  async authenticate(username, password) {
    const query = `
      SELECT
        id, username, email, password_hash,
        full_name, role, is_active
      FROM users
      WHERE (username = $1 OR email = $1) AND is_active = true
    `;

    const result = await this.db.query(query, [username]);

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await this.updateLastLogin(user.id);

    // Generate JWT token
    const token = this.generateToken(user);

    // Remove password hash before returning
    delete user.password_hash;

    return { user, token };
  }

  /**
   * Generate JWT token
   */
  generateToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiry
    });
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);

      // Get current user data
      const user = await this.getUserById(decoded.id);
      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      return user;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id) {
    const query = `
      SELECT
        id, username, email, full_name, role,
        is_active, created_at, updated_at, last_login
      FROM users
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find user by username or email
   */
  async findByUsernameOrEmail(username, email) {
    const query = `
      SELECT id, username, email
      FROM users
      WHERE username = $1 OR email = $2
    `;

    const result = await this.db.query(query, [username, email]);
    return result.rows[0] || null;
  }

  /**
   * Update last login time
   */
  async updateLastLogin(userId) {
    const query = `
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await this.db.query(query, [userId]);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
    const allowedFields = ['full_name', 'email'];
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

    values.push(userId);
    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, full_name, role
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Change password
   */
  async changePassword(userId, oldPassword, newPassword) {
    // Verify old password
    const query = `
      SELECT password_hash
      FROM users
      WHERE id = $1
    `;

    const result = await this.db.query(query, [userId]);
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const isValid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!isValid) {
      throw new Error('Invalid current password');
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const updateQuery = `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
    `;

    await this.db.query(updateQuery, [newPasswordHash, userId]);
    return true;
  }

  /**
   * Reset password (admin function)
   */
  async resetPassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const query = `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
      RETURNING id
    `;

    const result = await this.db.query(query, [passwordHash, userId]);
    return result.rowCount > 0;
  }

  /**
   * List users
   */
  async listUsers(options = {}) {
    const { role, isActive, searchTerm, limit = 50, offset = 0 } = options;

    let query = `
      SELECT
        id, username, email, full_name, role,
        is_active, created_at, last_login
      FROM users
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND role = $${paramIndex++}`;
      params.push(role);
    }

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    if (searchTerm) {
      query += ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR full_name ILIKE $${paramIndex})`;
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Update user role
   */
  async updateUserRole(userId, newRole) {
    const validRoles = ['admin', 'operator', 'viewer', 'user'];
    if (!validRoles.includes(newRole)) {
      throw new Error('Invalid role');
    }

    const query = `
      UPDATE users
      SET role = $1
      WHERE id = $2
      RETURNING id, username, role
    `;

    const result = await this.db.query(query, [newRole, userId]);
    return result.rows[0] || null;
  }

  /**
   * Activate/deactivate user
   */
  async setUserActive(userId, isActive) {
    const query = `
      UPDATE users
      SET is_active = $1
      WHERE id = $2
      RETURNING id, username, is_active
    `;

    const result = await this.db.query(query, [isActive, userId]);
    return result.rows[0] || null;
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(userId) {
    const query = `
      SELECT
        u.id,
        u.username,
        u.created_at as member_since,
        u.last_login,
        COUNT(DISTINCT cr.id) as total_calculations,
        COUNT(DISTINCT ms.id) as total_sessions,
        COUNT(DISTINCT eh.id) as total_exports,
        AVG(cr.quality_score) as avg_quality_score
      FROM users u
      LEFT JOIN calculation_results cr ON cr.created_by = u.id
      LEFT JOIN measurement_sessions ms ON ms.operator_id = u.id
      LEFT JOIN export_history eh ON eh.exported_by = u.id
      WHERE u.id = $1
      GROUP BY u.id, u.username, u.created_at, u.last_login
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Check user permission
   */
  async checkPermission(userId, resource, action) {
    const query = `
      SELECT role
      FROM users
      WHERE id = $1 AND is_active = true
    `;

    const result = await this.db.query(query, [userId]);
    if (result.rows.length === 0) {
      return false;
    }

    const role = result.rows[0].role;

    // Define permission matrix
    const permissions = {
      admin: ['create', 'read', 'update', 'delete'],
      operator: ['create', 'read', 'update'],
      viewer: ['read'],
      user: ['read', 'create'] // Can create but only their own
    };

    return permissions[role]?.includes(action) || false;
  }
}

module.exports = UserRepository;