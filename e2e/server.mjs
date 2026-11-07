// Starts the game server for the end-to-end tests: reseeds the database from the
// server repo's SQL, builds the server and runs it. Playwright starts this and
// waits for the port; it runs until Playwright stops it.
//
//   MUD_SERVER_DIR      the mud_server checkout (default ../mud_server)
//   E2E_DATABASE_URL    a database it may DROP AND RESEED (default: the local test database)
//   E2E_SERVER_PORT     listen port (default 18080)
//   E2E_CONTENT=1       content mode: the server plays the fixture world in e2e/content-world.mjs
//                       (people, scenery, a walkthrough, events, a sticker) instead of the SQL-seeded one
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { CODE_SECRET, worldYaml } from './content-world.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(process.env.MUD_SERVER_DIR ?? path.join(here, '..', '..', 'mud_server'));
const databaseUrl = process.env.E2E_DATABASE_URL ?? 'postgres://mud:mud@127.0.0.1:5432/mud_test';
const port = process.env.E2E_SERVER_PORT ?? '18080';

// Refuse anything that is not clearly a throwaway database: this script drops tables.
const dbName = new URL(databaseUrl).pathname.slice(1);
if (!/(_test|_e2e)$/.test(dbName)) {
  console.error(`e2e/server.mjs: refusing to reseed "${dbName}"; use a database whose name ends in _test or _e2e`);
  process.exit(1);
}

// The same scripts, in the same order, as the server's own integration tests.
const sqlDir = path.join(serverDir, 'src', 'sql');
const order = readFileSync(path.join(sqlDir, 'load_order.txt'), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
for (const file of order) {
  await client.query(readFileSync(path.join(sqlDir, file), 'utf8')); // no parameters: multiple statements are fine
}
await client.end();
console.log(`seeded ${dbName} from ${sqlDir}`);

const bin = path.join(mkdtempSync(path.join(tmpdir(), 'mud-e2e-')), 'mudserver');
const build = spawnSync('go', ['build', '-o', bin, './src'], { cwd: serverDir, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const env = { ...process.env, MUD_LISTEN_ADDR: `127.0.0.1:${port}`, MUD_DATABASE_URL: databaseUrl };
if (process.env.E2E_CONTENT) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mud-e2e-world-'));
  writeFileSync(path.join(dir, 'world.yaml'), worldYaml());
  env.MUD_WORLD_DIR = dir;
  env.MUD_CODE_SECRET = CODE_SECRET;
  console.log(`content mode: world in ${dir}`);
}
const server = spawn(bin, [], {
  cwd: serverDir, // the server reads config/server_config.json from here
  stdio: 'inherit',
  env,
});
server.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
