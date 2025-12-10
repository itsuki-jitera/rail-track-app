/**
 * Database API Routes
 * Endpoints for database operations
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireRole, logActivity } = require('../middleware/auth');
const UserRepository = require('../db/repositories/user-repository');
const CalculationRepository = require('../db/repositories/calculation-repository');
const SessionRepository = require('../db/repositories/session-repository');
const HistoryRepository = require('../db/repositories/history-repository');

// Initialize repositories
const userRepo = new UserRepository();
const calcRepo = new CalculationRepository();
const sessionRepo = new SessionRepository();
const historyRepo = new HistoryRepository();

/**
 * Authentication Routes
 */

// User registration
router.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const user = await userRepo.createUser({
      username,
      email,
      password,
      fullName,
      role: 'user'
    });

    res.status(201).json({ user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// User login
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const { user, token } = await userRepo.authenticate(username, password);

    res.json({ user, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Verify token
router.get('/auth/verify', authenticate, (req, res) => {
  res.json({ user: req.user, valid: true });
});

// Change password
router.post('/auth/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    await userRepo.changePassword(req.user.id, oldPassword, newPassword);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * User Management Routes
 */

// Get user profile
router.get('/users/profile', authenticate, async (req, res) => {
  try {
    const user = await userRepo.getUserById(req.user.id);
    const stats = await userRepo.getUserStatistics(req.user.id);

    res.json({ user, statistics: stats });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/users/profile', authenticate, async (req, res) => {
  try {
    const { fullName, email } = req.body;

    const updated = await userRepo.updateProfile(req.user.id, {
      full_name: fullName,
      email
    });

    res.json({ user: updated });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// List users (admin only)
router.get('/users', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { role, active, search, limit, offset } = req.query;

    const users = await userRepo.listUsers({
      role,
      isActive: active === 'true',
      searchTerm: search,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.json({ users });
  } catch (error) {
    console.error('User list error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role (admin only)
router.put('/users/:id/role', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const userId = parseInt(req.params.id);

    const updated = await userRepo.updateUserRole(userId, role);

    res.json({ user: updated });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/**
 * Calculation Routes
 */

// Save calculation result
router.post('/calculations', authenticate, logActivity('save-calculation'), async (req, res) => {
  try {
    const {
      sessionId,
      calculationType,
      parameters,
      processingTimeMs,
      resultSummary,
      qualityScore,
      versineData
    } = req.body;

    const result = await calcRepo.saveCalculation({
      sessionId,
      calculationType,
      parameters,
      processingTimeMs,
      resultSummary,
      qualityScore,
      createdBy: req.user.id,
      versineData
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Save calculation error:', error);
    res.status(500).json({ error: 'Failed to save calculation' });
  }
});

// Get calculation by ID
router.get('/calculations/:id', authenticate, async (req, res) => {
  try {
    const calculation = await calcRepo.getCalculation(req.params.id);

    if (!calculation) {
      return res.status(404).json({ error: 'Calculation not found' });
    }

    res.json(calculation);
  } catch (error) {
    console.error('Get calculation error:', error);
    res.status(500).json({ error: 'Failed to fetch calculation' });
  }
});

// Get versine data
router.get('/calculations/:id/versine', authenticate, async (req, res) => {
  try {
    const { limit, offset, minPos, maxPos } = req.query;

    const data = await calcRepo.getVersineData(req.params.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      minPosition: parseFloat(minPos),
      maxPosition: parseFloat(maxPos)
    });

    res.json({ data, count: data.length });
  } catch (error) {
    console.error('Get versine data error:', error);
    res.status(500).json({ error: 'Failed to fetch versine data' });
  }
});

// Search calculations
router.get('/calculations', authenticate, async (req, res) => {
  try {
    const {
      type,
      sessionId,
      projectId,
      startDate,
      endDate,
      minQuality,
      limit,
      offset
    } = req.query;

    const calculations = await calcRepo.searchCalculations({
      calculationType: type,
      sessionId: parseInt(sessionId),
      projectId: parseInt(projectId),
      createdBy: req.user.role === 'admin' ? undefined : req.user.id,
      startDate,
      endDate,
      minQuality: parseFloat(minQuality),
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.json({ calculations, count: calculations.length });
  } catch (error) {
    console.error('Search calculations error:', error);
    res.status(500).json({ error: 'Failed to search calculations' });
  }
});

// Get calculation statistics
router.get('/calculations/stats', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const stats = await calcRepo.getStatistics({
      startDate,
      endDate,
      groupBy: groupBy || 'day'
    });

    res.json({ statistics: stats });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Compare calculations
router.post('/calculations/compare', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length < 2) {
      return res.status(400).json({ error: 'At least 2 calculation IDs required' });
    }

    const comparison = await calcRepo.compareCalculations(ids);

    res.json({ comparison });
  } catch (error) {
    console.error('Compare calculations error:', error);
    res.status(500).json({ error: 'Failed to compare calculations' });
  }
});

/**
 * Session Routes
 */

// Create session
router.post('/sessions', authenticate, async (req, res) => {
  try {
    const sessionData = {
      ...req.body,
      operatorId: req.user.id
    };

    const session = await sessionRepo.createSession(sessionData);

    res.status(201).json(session);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session
router.get('/sessions/:id', authenticate, async (req, res) => {
  try {
    const session = await sessionRepo.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Search sessions
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const sessions = await sessionRepo.searchSessions({
      ...req.query,
      operatorId: req.user.role === 'admin' ? undefined : req.user.id
    });

    res.json({ sessions, count: sessions.length });
  } catch (error) {
    console.error('Search sessions error:', error);
    res.status(500).json({ error: 'Failed to search sessions' });
  }
});

/**
 * History Routes
 */

// Get export history
router.get('/history/exports/:resultId', authenticate, async (req, res) => {
  try {
    const history = await historyRepo.getExportHistory(req.params.resultId);

    res.json({ history });
  } catch (error) {
    console.error('Get export history error:', error);
    res.status(500).json({ error: 'Failed to fetch export history' });
  }
});

// Get system logs
router.get('/history/logs', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const logs = await historyRepo.getSystemLogs(req.query);

    res.json({ logs });
  } catch (error) {
    console.error('Get system logs error:', error);
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
});

// Get audit trail
router.get('/history/audit/:table/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { table, id } = req.params;

    const audit = await historyRepo.getAuditTrail(table, id);

    res.json({ audit });
  } catch (error) {
    console.error('Get audit trail error:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

// Get user activity
router.get('/history/activity/:userId', authenticate, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const days = parseInt(req.query.days) || 30;

    // Users can only view their own activity unless admin
    if (req.user.role !== 'admin' && userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const activity = await historyRepo.getUserActivity(userId, days);

    res.json({ activity });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// Get calculation timeline
router.get('/history/timeline', authenticate, async (req, res) => {
  try {
    const { projectId, sessionId, limit } = req.query;

    const timeline = await historyRepo.getCalculationTimeline({
      projectId: parseInt(projectId),
      sessionId: parseInt(sessionId),
      limit: parseInt(limit) || 100
    });

    res.json({ timeline });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// Record performance metric
router.post('/history/metrics', authenticate, async (req, res) => {
  try {
    const metric = req.body;

    const id = await historyRepo.recordPerformanceMetric(metric);

    res.status(201).json({ id });
  } catch (error) {
    console.error('Record metric error:', error);
    res.status(500).json({ error: 'Failed to record metric' });
  }
});

// Get performance metrics
router.get('/history/metrics/:type', authenticate, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;

    const metrics = await historyRepo.getPerformanceMetrics(
      req.params.type,
      hours
    );

    res.json({ metrics });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

module.exports = router;