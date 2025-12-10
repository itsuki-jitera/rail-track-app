/**
 * Jest configuration for backend testing
 */
export default {
  // Use node environment
  testEnvironment: 'node',

  // Support ES modules
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**',
  ],

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js',
  ],

  // Setup files
  setupFilesAfterEnv: [],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
