import { WebSocketServer } from 'ws';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  let file = req.url.split('?')[0];
  if (file === '/') file = '/index.html';
  const full = path.join(__dirname, file);

  console.log('LOOKING:', full);

  fs.readFile(full, (err, data) => {
    if (err) {
      console.log('NOT FOUND:', full);
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(full);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js':   'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png':  'image/png'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const history = [];

wss.on('connection', (ws) => {
  console.log('WS CONNECTED');
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
    if (history.length > 200) history.shift();
    const out = JSON.stringify({ type: 'message', ...msg });
    for (const c of wss.clients) if (c.readyState === 1) c.send(out);
  });

  ws.on('close', () => console.log('WS DISCONNECTED'));
});

server.listen(PORT, () => console.log('server on port ' + PORT));
