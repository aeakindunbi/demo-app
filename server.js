const http = require("http");
const fs = require("fs");
const path = require("path");
const client = require("prom-client");

// Create Registry
const register = new client.Registry();

// Collect default Node.js metrics
client.collectDefaultMetrics({
  register,
  prefix: 'myapp_',
});

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],   // Good buckets for web apps
  registers: [register]
});

const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

// Create Server
const server = http.createServer(async (req, res) => {
  const startTime = Date.now();

  // ====================== METRICS ENDPOINT ======================
  if (req.url === '/metrics') {
    try {
      res.setHeader('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
      return;
    } catch (err) {
      console.error('Error generating metrics:', err);
      res.writeHead(500);
      res.end('Error generating metrics');
      return;
    }
  }

  // ====================== FILE SERVING LOGIC ======================
  const route = req.url === "/" ? "index.html" : req.url;
  const method = req.method;

  let filePath = path.join(__dirname, route);

  fs.readFile(filePath, (err, data) => {
    const duration = (Date.now() - startTime) / 1000;   // in seconds

    if (err) {
      res.writeHead(404);
      res.end("File not found");

      const status = 404;
      httpRequestsTotal.inc({ method, route, status });
      httpErrorsTotal.inc({ method, route, status });
      httpRequestDurationSeconds.observe({ method, route, status }, duration);
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);

      const status = 200;
      httpRequestsTotal.inc({ method, route, status });
      httpRequestDurationSeconds.observe({ method, route, status }, duration);
    }
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
  console.log("Metrics available at http://localhost:3000/metrics");
});