#!/usr/bin/env node
/**
 * Stdio Proxy Service
 *
 * Converts stdio MCP servers to HTTP by spawning mcp-proxy processes.
 * API: POST /convert, DELETE /convert/:serverName, GET /convert, GET /health
 * MCP traffic: /servers/:serverName/mcp -> forwarded to mcp-proxy
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '8080', 10);
const BASE_PORT = parseInt(process.env.BASE_PORT || '9000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const EXTERNAL_HOST = process.env.EXTERNAL_HOST || 'localhost';

/** Map serverName -> { process, port, url } */
const runningProxies = new Map();
let nextPort = BASE_PORT;

function allocatePort() {
  const port = nextPort++;
  return port;
}

function getProxyUrl(serverName, port) {
  // Return direct access to the mcp-proxy port
  // This works because all containers on the same Docker network can access each other
  return `http://${EXTERNAL_HOST}:${port}`;
}

/**
 * Spawn mcp-proxy: npx mcp-proxy --port X command args...
 */
function spawnProxy(serverName, command, args = [], env = {}) {
  const port = allocatePort();

  // Remove duplicate -y flag if present in args (we already add it for mcp-proxy)
  // This handles cases where MCP server configs include -y in their args
  let cleanedArgs = args;
  if (args.length > 0 && args[0] === '-y') {
    cleanedArgs = args.slice(1);
    console.log(`[${serverName}] Removed duplicate -y flag from args`);
  }

  const fullArgs = [
    '-y',
    'mcp-proxy',
    '--port', String(port),
    command,
    ...cleanedArgs
  ];

  const proc = spawn('npx', fullArgs, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  let stdout = '';
  proc.stdout?.on('data', (d) => {
    const data = d.toString();
    stdout += data;
    console.log(`[${serverName}] stdout:`, data.trim());
  });
  proc.stderr?.on('data', (d) => {
    const data = d.toString();
    stderr += data;
    console.error(`[${serverName}] stderr:`, data.trim());
  });
  proc.on('error', (err) => {
    console.error(`[${serverName}] Failed to spawn:`, err);
  });
  proc.on('exit', (code, signal) => {
    console.log(`[${serverName}] Process exited: code=${code} signal=${signal}`);
    if (code !== 0 && stderr) {
      console.error(`[${serverName}] Process stderr:`, stderr.trim());
    }
    runningProxies.delete(serverName);
  });

  runningProxies.set(serverName, {
    process: proc,
    port,
    url: getProxyUrl(serverName, port),
    command,
    args,
  });

  return { port, url: getProxyUrl(serverName, port) };
}

function waitForHealthy(port, maxAttempts = 20) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      fetch(`http://127.0.0.1:${port}/ping`)
        .then((r) => (r.ok ? resolve() : new Error('Not ok')))
        .catch(() => null)
        .then((err) => {
          if (err === undefined) return resolve();
          if (attempts >= maxAttempts) return reject(new Error('Proxy did not become ready'));
          setTimeout(check, 500);
        });
    };
    setTimeout(check, 1000);
  });
}

// POST /convert
app.post('/convert', async (req, res) => {
  const { serverName, command, args, env } = req.body || {};

  if (!serverName || typeof serverName !== 'string' || !command || typeof command !== 'string') {
    return res.status(400).json({
      error: 'Missing required fields: serverName, command',
    });
  }

  const safeArgs = Array.isArray(args) ? args : [];
  const safeEnv = env && typeof env === 'object' ? env : {};

  if (runningProxies.has(serverName)) {
    return res.status(409).json({
      error: `Server "${serverName}" is already converted`,
      serverName,
      url: runningProxies.get(serverName).url,
      port: runningProxies.get(serverName).port,
    });
  }

  try {
    const { port, url } = spawnProxy(serverName, command, safeArgs, safeEnv);
    await waitForHealthy(port);

    res.status(201).json({
      serverName,
      url,
      port,
      status: 'running',
    });
  } catch (err) {
    const entry = runningProxies.get(serverName);
    if (entry) {
      entry.process.kill();
      runningProxies.delete(serverName);
    }
    console.error(`[${serverName}] Convert failed:`, err);
    res.status(500).json({
      error: 'Failed to start proxy: ' + (err.message || 'Unknown error'),
    });
  }
});

// DELETE /convert/:serverName
app.delete('/convert/:serverName', (req, res) => {
  const { serverName } = req.params;
  const entry = runningProxies.get(serverName);

  if (!entry) {
    return res.status(404).json({
      error: `Server "${serverName}" not found`,
    });
  }

  entry.process.kill();
  runningProxies.delete(serverName);

  res.json({
    serverName,
    status: 'stopped',
  });
});

// GET /convert/:serverName
app.get('/convert/:serverName', (req, res) => {
  const { serverName } = req.params;
  const entry = runningProxies.get(serverName);

  if (!entry) {
    return res.status(404).json({
      error: `Server "${serverName}" not found`,
    });
  }

  res.json({
    serverName,
    url: entry.url,
    port: entry.port,
    status: 'running',
  });
});

// GET /convert
app.get('/convert', (req, res) => {
  const servers = Array.from(runningProxies.entries()).map(([name, e]) => ({
    serverName: name,
    url: e.url,
    port: e.port,
    status: 'running',
  }));

  res.json({
    servers,
    count: servers.length,
  });
});

// GET /health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    servers: runningProxies.size,
  });
});

// Proxy MCP traffic: /servers/:serverName/mcp -> localhost:port/mcp
app.use('/servers/:serverName', (req, res, next) => {
  const { serverName } = req.params;
  const entry = runningProxies.get(serverName);

  if (!entry) {
    return res.status(404).json({
      error: `Server "${serverName}" not found or not running`,
    });
  }

  const proxy = createProxyMiddleware({
    target: `http://127.0.0.1:${entry.port}`,
    pathRewrite: { [`^/servers/${encodeURIComponent(serverName)}`]: '' },
    changeOrigin: true,
    ws: true,
  });
  proxy(req, res, next);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down... stopping all proxies');
  for (const [name, entry] of runningProxies) {
    entry.process.kill();
  }
  runningProxies.clear();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen(PORT, HOST, () => {
  console.log(`Stdio Proxy Service listening on ${HOST}:${PORT}`);
  console.log(`Base port for proxies: ${BASE_PORT}`);
});
