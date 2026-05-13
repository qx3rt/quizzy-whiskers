import { initializeDatabase } from '../src/db/database.js';
import { seedIfEmpty } from '../src/db/seed.js';

await initializeDatabase();

const seeded = await seedIfEmpty();
if (!seeded) {
  console.log('Database already seeded — nothing to do.');
}
