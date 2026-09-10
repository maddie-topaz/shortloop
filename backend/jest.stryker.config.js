const base = require('./jest.config.js');

/**
 * Mutation testing runs the app's own logic only. The integration tests are
 * excluded because they need a live Postgres, and Stryker runs many mutants
 * in parallel against whatever database it is given — parallel workers would
 * truncate the shared `links` table out from under each other and make the
 * mutation score nondeterministic. Keeping them out leaves the mutation run
 * in-process, fast, and database-free.
 */
/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.ts$'],
};
