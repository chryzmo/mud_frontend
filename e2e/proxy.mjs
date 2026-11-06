// A TCP proxy between the web server and the game server, so tests can cut one
// browser's connection, or refuse its reconnects, without touching anyone else's.
// It reads the first HTTP request of each connection and tags the connection with the
// `e2e` cookie the test gave that browser context.
//
//   POST /cut?id=X       close X's live connections now
//   POST /block?id=X     refuse X's new connections (and close its live ones)
//   POST /unblock?id=X
import http from 'node:http';
import net from 'node:net';

const listenPort = Number(process.env.E2E_PROXY_PORT ?? 18081);
const controlPort = Number(process.env.E2E_PROXY_CONTROL_PORT ?? 18082);
const upstreamPort = Number(process.env.E2E_SERVER_PORT ?? 18080);

const live = new Map(); // id -> Set of sockets
const blocked = new Set();

const track = (id, ...sockets) => {
  const set = live.get(id) ?? new Set();
  live.set(id, set);
  for (const s of sockets) {
    set.add(s);
    s.on('close', () => set.delete(s));
  }
};
const cut = (id) => {
  for (const s of live.get(id) ?? []) s.destroy();
};

net.createServer((client) => {
  client.on('error', () => {});
  let buf = Buffer.alloc(0);
  const onData = (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const end = buf.indexOf('\r\n\r\n');
    if (end < 0) {
      if (buf.length > 16384) client.destroy();
      return;
    }
    client.off('data', onData);
    client.pause();
    const id = /^cookie:.*\be2e=([A-Za-z0-9]+)/im.exec(buf.subarray(0, end).toString('latin1'))?.[1] ?? '';
    if (blocked.has(id)) {
      client.destroy();
      return;
    }
    const up = net.connect(upstreamPort, '127.0.0.1', () => {
      up.write(buf);
      client.pipe(up);
      up.pipe(client);
      client.resume();
    });
    up.on('error', () => client.destroy());
    client.on('close', () => up.destroy());
    up.on('close', () => client.destroy());
    track(id, client, up);
  };
  client.on('data', onData);
}).listen(listenPort, '127.0.0.1');

http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const id = url.searchParams.get('id') ?? '';
  if (req.method === 'POST' && url.pathname === '/cut') cut(id);
  else if (req.method === 'POST' && url.pathname === '/block') { blocked.add(id); cut(id); }
  else if (req.method === 'POST' && url.pathname === '/unblock') blocked.delete(id);
  else if (url.pathname !== '/health') { res.writeHead(404).end(); return; }
  res.writeHead(200).end('ok');
}).listen(controlPort, '127.0.0.1');
