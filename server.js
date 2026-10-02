import { WebSocketServer } from 'ws';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const file = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  const full = path.join(__dirname, 'public', file);
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(full);
    const type = ext === '.html' ? 'text/html; charset=utf-8'
               : ext === '.js'   ? 'application/javascript; charset=utf-8'
               : ext === '.json' ? 'application/json; charset=utf-8'
               : ext === '.png'  ? 'image/png'
               : 'text/plain; charset=utf-8';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

const history = [];
const MAX_HISTORY = 200;

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'history', messages: history }));
  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    if (data.type !== 'message') return;
    const text = String(data.text || '').trim().slice(0, 2000);
    const name = String(data.name || 'anon').trim().slice(0, 32) || 'anon';
    if (!text) return;
    const msg = { name, text, ts: Date.now() };
    history.push(msg);
    if (history.length > MAX_HISTORY) history.shift();
    broadcast({ type: 'message', ...msg });
  });
});

server.listen(PORT, () => {
  console.log(`server on port ${PORT}`);
});
