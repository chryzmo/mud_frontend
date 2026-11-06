// Runs once, after the web servers are up: adds the game master the staff tests sign in as.
// The server has already created its schema (the gm column), and no tests have started.
import bcrypt from 'bcryptjs';
import pg from 'pg';

// One account per staff test that signs in: the server allows one session per account, and tests run in parallel.
export const GM_NAMES = ['e2egmone', 'e2egmtwo', 'e2egmthree'];
export const GM_PASSWORD = 'correct horse battery';

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? 'postgres://mud:mud@127.0.0.1:5432/mud_test';
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const hash = await bcrypt.hash(GM_PASSWORD, 4);
    for (const name of GM_NAMES) {
      await client.query(
        `INSERT INTO player (username, passwordhash, inventoryidslice, equipmentslots, attackpower, defense, hp, maxhp, mp, maxmp, roomid, spawnlocationid, gm)
         VALUES ($1, $2, '{}', '{}', 5, 10, 20, 20, 10, 10, 1, 1, true)
         ON CONFLICT DO NOTHING`,
        [name, hash],
      );
    }
  } finally {
    await client.end();
  }
}
