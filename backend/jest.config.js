/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  // Stryker copies the whole workspace into .stryker-tmp/sandbox-*; an
  // interrupted run leaves one behind and jest would otherwise collect the
  // stale copies of these same tests.
  testPathIgnorePatterns: ['/node_modules/', '/.stryker-tmp/'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 43,
      functions: 60,
      lines: 70,
    },
  },
};
