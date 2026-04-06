/**
 * Simple HTTPS Maintenance Server
 * Serves a maintenance page while the main application is being updated.
 * Uses the same SSL certificates as the production server.
 *
 * Usage:
 *   node maintenance-server.js          # Start on port 443
 *   node maintenance-server.js 8443     # Start on custom port
 */

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.argv[2] || 443;
const CERT_DIR = path.join(__dirname, '..', 'certs');
const MAINTENANCE_PAGE = path.join(__dirname, '..', 'public', 'maintenance.html');

// Check if running from production folder
const prodCertDir = String.raw`C:\stick-my-note-prod\stickmynote-client\certs`;
const prodMaintenancePage = String.raw`C:\stick-my-note-prod\stickmynote-client\public\maintenance.html`;

let certDir = fs.existsSync(prodCertDir) ? prodCertDir : CERT_DIR;
let maintenancePage = fs.existsSync(prodMaintenancePage) ? prodMaintenancePage : MAINTENANCE_PAGE;

// Load SSL certificates
let sslOptions;
try {
  sslOptions = {
    key: fs.readFileSync(path.join(certDir, 'stickmynote.key')),
    cert: fs.readFileSync(path.join(certDir, 'stickmynote.crt')),
  };

  // Try to load CA bundle if it exists
  const caPath = path.join(certDir, 'stickmynote.ca-bundle');
  if (fs.existsSync(caPath)) {
    sslOptions.ca = fs.readFileSync(caPath);
  }
} catch (err) {
  console.error('Failed to load SSL certificates:', err.message);
  console.error('Make sure certificates exist in:', certDir);
  process.exit(1);
}

// Load maintenance page
let maintenanceHtml;
try {
  maintenanceHtml = fs.readFileSync(maintenancePage, 'utf8');
} catch (err) {
  console.error('Failed to load maintenance page:', err.message);
  // Fallback to simple HTML
  maintenanceHtml = `
<!DOCTYPE html>
<html>
<head><title>Maintenance</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px;">
  <h1>Application Under Maintenance</h1>
  <p>We'll be back shortly. Please try again in a few minutes.</p>
</body>
</html>`;
}

// Create HTTPS server
const server = https.createServer(sslOptions, (req, res) => {
  // Sanitize user-controlled data before logging to prevent log injection (SonarCloud S5145)
  const safeMethod = (req.method || "").replaceAll(/[^\w]/g, "")
  const safeUrl = (req.url || "").slice(0, 200).replaceAll(/[\r\n]/g, "")
  console.log(`${new Date().toISOString()} - ${safeMethod} ${safeUrl} from ${req.socket.remoteAddress}`);

  res.writeHead(503, {
    'Content-Type': 'text/html; charset=utf-8',
    'Retry-After': '300',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  res.end(maintenanceHtml);
});

server.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(60));
  console.log('  MAINTENANCE SERVER STARTED');
  console.log('='.repeat(60));
  console.log(`  URL:     https://stickmynote.com:${PORT}/`);
  console.log(`  Certs:   ${certDir}`);
  console.log(`  Page:    ${maintenancePage}`);
  console.log('');
  console.log('  Press Ctrl+C to stop the maintenance server');
  console.log('='.repeat(60));
  console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down maintenance server...');
  server.close(() => {
    console.log('Maintenance server stopped.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
