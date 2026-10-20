const http = require('http');
const os = require('os');

const PORT = process.env.PORT || 4000;
let globalCounter = 0;
let updateHistory = [];

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET' && req.url === '/counter') {
    res.writeHead(200);
    return res.end(JSON.stringify({
      counter: globalCounter,
      coordinatorPod: os.hostname(),
      historyLength: updateHistory.length,
      time: new Date().toISOString()
    }));
  }

  if (req.method === 'POST' && req.url === '/increment') {
    // Incremento atómico en el Event Loop de Node.js (monohilo)
    globalCounter++;
    const record = {
      sequence: globalCounter,
      pod: os.hostname(),
      time: new Date().toISOString()
    };
    updateHistory.push(record);
    if (updateHistory.length > 500) updateHistory.shift();

    res.writeHead(200);
    return res.end(JSON.stringify({
      status: 'success',
      counter: globalCounter,
      coordinatorPod: os.hostname(),
      sequence: record.sequence
    }));
  }

  if (req.method === 'POST' && req.url === '/reset') {
    globalCounter = 0;
    updateHistory = [];
    res.writeHead(200);
    return res.end(JSON.stringify({
      status: 'reset',
      counter: 0,
      coordinatorPod: os.hostname()
    }));
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'healthy', pod: os.hostname() }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Coordinator] State Coordinator running on port ${PORT}`);
  console.log(`[Coordinator] Pod Hostname: ${os.hostname()}`);
});
