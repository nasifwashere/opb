const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware for JSON parsing and security
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Add security headers for Render
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// Track bot status
let botStatus = {
  startTime: Date.now(),
  lastPing: Date.now(),
  requestCount: 0,
  memoryUsage: process.memoryUsage(),
  uptime: 0
};

// Update status every minute
setInterval(() => {
  botStatus.lastPing = Date.now();
  botStatus.uptime = Math.floor((Date.now() - botStatus.startTime) / 1000);
  botStatus.memoryUsage = process.memoryUsage();
}, 60000);

// Main health check endpoint for UptimeRobot
app.get('/', (req, res) => {
  botStatus.requestCount++;
  
  const status = {
    status: 'online',
    message: 'One Piece Bot is running!',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - botStatus.startTime) / 1000),
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
  };
  
  res.status(200).json(status);
});

// Comprehensive health check endpoint
app.get('/health', (req, res) => {
  botStatus.requestCount++;
  
  const memoryMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const uptimeSeconds = Math.floor((Date.now() - botStatus.startTime) / 1000);
  
  // Determine health status based on memory usage and uptime
  let healthStatus = 'healthy';
  let statusCode = 200;
  
  if (memoryMB > 450) { // Close to Render's 512MB limit
    healthStatus = 'warning';
    statusCode = 200; // Still healthy, just warning
  }
  
  if (memoryMB > 500) {
    healthStatus = 'critical';
    statusCode = 503; // Service unavailable if memory is critical
  }
  
  const healthData = {
    status: healthStatus,
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptimeSeconds,
      human: formatUptime(uptimeSeconds)
    },
    memory: {
      rss: memoryMB + 'MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    },
    requests: botStatus.requestCount,
    lastPing: new Date(botStatus.lastPing).toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  };
  
  res.status(statusCode).json(healthData);
});

// Simple ping endpoint for quick checks
app.get('/ping', (req, res) => {
  botStatus.requestCount++;
  res.status(200).json({ 
    pong: true, 
    timestamp: Date.now(),
    uptime: Math.floor((Date.now() - botStatus.startTime) / 1000)
  });
});

// Bot status endpoint with detailed information
app.get('/status', (req, res) => {
  botStatus.requestCount++;
  
  const status = {
    bot: {
      name: 'One Piece Bot',
      version: '1.0.0',
      status: 'running',
      startTime: new Date(botStatus.startTime).toISOString(),
      uptime: formatUptime(Math.floor((Date.now() - botStatus.startTime) / 1000))
    },
    server: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: {
        used: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        limit: '512MB (Render Free Tier)'
      },
      cpu: process.cpuUsage()
    },
    metrics: {
      totalRequests: botStatus.requestCount,
      averageRequestsPerMinute: Math.round(botStatus.requestCount / (Math.floor((Date.now() - botStatus.startTime) / 60000) || 1))
    },
    lastCheck: new Date().toISOString()
  };
  
  res.status(200).json(status);
});

// Force garbage collection endpoint (for debugging)
app.post('/gc', (req, res) => {
  if (global.gc) {
    const beforeMemory = Math.round(process.memoryUsage().rss / 1024 / 1024);
    global.gc();
    const afterMemory = Math.round(process.memoryUsage().rss / 1024 / 1024);
    
    res.json({
      message: 'Garbage collection forced',
      memoryBefore: beforeMemory + 'MB',
      memoryAfter: afterMemory + 'MB',
      freed: (beforeMemory - afterMemory) + 'MB'
    });
  } else {
    res.status(400).json({
      error: 'Garbage collection not available',
      message: 'Start with --expose-gc flag to enable'
    });
  }
});

// Metrics endpoint for monitoring
app.get('/metrics', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - botStatus.startTime) / 1000);
  const memoryUsage = process.memoryUsage();
  
  // Simple metrics in text format
  const metrics = [
    `# Bot uptime in seconds`,
    `bot_uptime_seconds ${uptimeSeconds}`,
    ``,
    `# Memory usage in bytes`,
    `bot_memory_rss_bytes ${memoryUsage.rss}`,
    `bot_memory_heap_used_bytes ${memoryUsage.heapUsed}`,
    `bot_memory_heap_total_bytes ${memoryUsage.heapTotal}`,
    ``,
    `# Request count`,
    `bot_requests_total ${botStatus.requestCount}`,
    ``,
    `# Last ping timestamp`,
    `bot_last_ping_timestamp ${botStatus.lastPing}`
  ].join('\n');
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /ping',
      'GET /status',
      'GET /metrics',
      'POST /gc'
    ]
  });
});

// Utility function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function keepAlive() {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Keep-alive server running on http://0.0.0.0:${port}`);
    console.log(`📊 Health check: http://0.0.0.0:${port}/health`);
    console.log(`🏓 Ping endpoint: http://0.0.0.0:${port}/ping`);
  });
  
  // Handle server errors
  server.on('error', (err) => {
    console.error('❌ Keep-alive server error:', err);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📋 Closing keep-alive server...');
    server.close(() => {
      console.log('✅ Keep-alive server closed');
    });
  });
  
  return server;
}

module.exports = { keepAlive, app };
