/**
 * Run add_batch_to_semesters migration manually
 * Usage: node scripts/run_add_batch_migration.js
 */
const { runMigrations } = require('./runMigrations');

runMigrations()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
