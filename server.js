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

// Custom metric - Fixed label handling
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

// Create Server
const server = http.createServer(async (req, res) => {
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

  // ====================== YOUR FILE SERVING LOGIC ======================
  const route = req.url === "/" ? "index.html" : req.url;   // Safe route name

  let filePath = path.join(__dirname, route);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("File not found");

      // Record 404 - provide ALL labels
      httpRequestsTotal.inc({
        method: req.method,
        route: route,
        status: 404
      });
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);

      // Record 200 - provide ALL labels
      httpRequestsTotal.inc({
        method: req.method,
        route: route,
        status: 200
      });
    }
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
  console.log("Metrics available at http://localhost:3000/metrics");
});