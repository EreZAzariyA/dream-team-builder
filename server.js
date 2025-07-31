/**
 * Custom Next.js Server with Integrated WebSocket Support
 * Combines Next.js HTTP server with BMAD WebSocket functionality
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Import ES module
async function loadESModules() {
  const { BmadWebSocketServer } = await import('./lib/websocket/WebSocketServer.js');
  return { BmadWebSocketServer };
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Load ES modules
  const { BmadWebSocketServer } = await loadESModules();

  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize BMAD WebSocket Server
  const wsServer = new BmadWebSocketServer({
    server, // Attach to the same HTTP server
    port: null // Don't create separate port, use the HTTP server
  });

  // Start WebSocket server
  wsServer.start().then(() => {
    console.log(`🚀 Next.js + WebSocket server ready on http://${hostname}:${port}`);
    console.log(`📡 WebSocket server integrated on same port`);
  }).catch(err => {
    console.error('Failed to start WebSocket server:', err);
    process.exit(1);
  });

  // Start the server
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`🌐 Server listening on http://${hostname}:${port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await wsServer.stop();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await wsServer.stop();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});