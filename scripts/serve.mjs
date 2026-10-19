import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.png': 'image/png', '.csv': 'text/csv' };
http.createServer(async (req, res) => {
  try {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(file === root ? path.join(root, 'index.html') : file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/html' }); res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(Number(process.env.PORT || 4173), '0.0.0.0', () => console.log('Local: http://localhost:' + (process.env.PORT || 4173)));
