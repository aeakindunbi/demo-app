const http = require("http");
const fs = require("fs");
const path = require("path");
const client = require("prom-client");

// 1. Create Registry
const register = new client.Registry();

// 2. Collect default Node.js metrics (Memory, CPU, etc.)
// The prefix matches your Grafana JSON
client.collectDefaultMetrics({
  register,
  prefix: "myapp_",
});

// 3. Custom metrics with the 'myapp_' prefix to match your dashboard
const httpRequestsTotal = new client.Counter({
  name: "myapp_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "myapp_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const httpErrorsTotal = new client.Counter({
  name: "myapp_http_errors_total",
  help: "Total number of HTTP errors",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

// 4. Create Server
const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  const method = req.method;
  const route = req.url === "/" ? "index.html" : req.url;

  // ====================== METRICS ENDPOINT ======================
  if (req.url === "/metrics") {
    try {
      res.setHeader("Content-Type", register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
      return;
    } catch (err) {
      console.error("Error generating metrics:", err);
      res.writeHead(500);
      res.end("Error generating metrics");
      return;
    }
  }

  // ====================== FILE SERVING / APP LOGIC ======================
  // Note: Ensure index.html exists in your directory, or update this logic
  let filePath = path.join(__dirname, route);

  fs.readFile(filePath, (err, data) => {
    const duration = (Date.now() - startTime) / 1000;

    if (err) {
      // If file not found, serve a simple message
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Page not found..");

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

// 5. LISTEN ON 0.0.0.0 (Crucial for Docker/ECS/AWS Scrapers)
const PORT = 3000;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
  console.log(`📊 Metrics available at http://${HOST}:${PORT}/metrics`);
});
