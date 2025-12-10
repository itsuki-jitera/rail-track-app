/**
 * Authentication Middleware
 * JWT-based authentication and authorization
 */

const UserRepository = require('../db/repositories/user-repository');

class AuthMiddleware {
  constructor() {
    this.userRepo = new UserRepository();
  }

  /**
   * Authenticate request
   */
  async authenticate(req, res, next) {
    try {
      // Get token from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify token
      const user = await this.userRepo.verifyToken(token);
      if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }

  /**
   * Require specific role
   */
  requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: roles,
          current: req.user.role
        });
      }

      next();
    };
  }

  /**
   * Optional authentication (doesn't fail if no token)
   */
  async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const user = await this.userRepo.verifyToken(token);
        req.user = user;
      }
      next();
    } catch (error) {
      // Continue without authentication
      next();
    }
  }

  /**
   * Check resource ownership
   */
  checkOwnership(resourceField = 'userId') {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Admin can access everything
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if user owns the resource
      const resourceUserId = req.params[resourceField] || req.body[resourceField];
      if (resourceUserId && resourceUserId !== req.user.id.toString()) {
        return res.status(403).json({ error: 'Access denied to this resource' });
      }

      next();
    };
  }

  /**
   * Rate limiting by user
   */
  rateLimit(maxRequests = 100, windowMs = 60000) {
    const userRequests = new Map();

    return (req, res, next) => {
      if (!req.user) {
        return next();
      }

      const userId = req.user.id;
      const now = Date.now();
      const userHistory = userRequests.get(userId) || [];

      // Remove old requests outside the window
      const recentRequests = userHistory.filter(
        timestamp => now - timestamp < windowMs
      );

      if (recentRequests.length >= maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
        });
      }

      recentRequests.push(now);
      userRequests.set(userId, recentRequests);

      next();
    };
  }

  /**
   * Log user activity
   */
  logActivity(action) {
    return async (req, res, next) => {
      try {
        if (req.user) {
          const HistoryRepository = require('../db/repositories/history-repository');
          const historyRepo = new HistoryRepository();

          await historyRepo.logSystemEvent({
            logLevel: 'info',
            category: 'user-activity',
            message: action,
            details: {
              method: req.method,
              path: req.path,
              params: req.params,
              query: req.query
            },
            userId: req.user.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
          });
        }
      } catch (error) {
        console.error('Activity logging error:', error);
      }

      next();
    };
  }
}

// Export singleton instance
const authMiddleware = new AuthMiddleware();

module.exports = {
  authenticate: authMiddleware.authenticate.bind(authMiddleware),
  requireRole: authMiddleware.requireRole.bind(authMiddleware),
  optionalAuth: authMiddleware.optionalAuth.bind(authMiddleware),
  checkOwnership: authMiddleware.checkOwnership.bind(authMiddleware),
  rateLimit: authMiddleware.rateLimit.bind(authMiddleware),
  logActivity: authMiddleware.logActivity.bind(authMiddleware)
};