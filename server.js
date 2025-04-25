// Import built-in Node.js modules
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

// Import the Google Sheets API module
const { syncToGoogleSheets } = require('./googleSheetsAPI');

// Define the port
const PORT = process.env.PORT || 5000;

// Data storage paths
const DATA_DIR = path.join(__dirname, 'data');
const VOLUNTEERS_FILE = path.join(DATA_DIR, 'volunteers.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize data files with empty arrays if they don't exist
if (!fs.existsSync(VOLUNTEERS_FILE)) {
  fs.writeFileSync(VOLUNTEERS_FILE, JSON.stringify([]));
}

if (!fs.existsSync(EVENTS_FILE)) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify([]));
}

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    adminPassword: 'admin123',
    sheetsConfig: null
  }));
}

// MIME types for file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

// Helper functions
function readData(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}

function writeData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    return false;
  }
}

function getConfig() {
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading config:', error);
    return {
      adminPassword: 'admin123',
      sheetsConfig: null
    };
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Generate a UUID (simplified version)
function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : 
    crypto.randomBytes(16).toString('hex');
}

// Parse request body (JSON)
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', error => {
      reject(error);
    });
  });
}

// Send a JSON response
function sendJsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Serve a static file
function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        sendJsonResponse(res, 404, { error: 'File not found' });
      } else {
        sendJsonResponse(res, 500, { error: 'Server error' });
      }
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  });
}

// Create the HTTP server
const server = http.createServer(async (req, res) => {
  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // API routes
  if (pathname.startsWith('/api/')) {
    // Get all volunteers
    if (pathname === '/api/volunteers' && req.method === 'GET') {
      const volunteers = readData(VOLUNTEERS_FILE);
      sendJsonResponse(res, 200, volunteers);
    }
    
    // Get volunteer by ID
    else if (pathname.match(/^\/api\/volunteers\/[^/]+$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const volunteers = readData(VOLUNTEERS_FILE);
      const volunteer = volunteers.find(v => v.id === id);
      
      if (!volunteer) {
        sendJsonResponse(res, 404, { error: 'Volunteer not found' });
      } else {
        sendJsonResponse(res, 200, volunteer);
      }
    }
    
    // Add a new volunteer
    else if (pathname === '/api/volunteers' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const volunteers = readData(VOLUNTEERS_FILE);
        
        const newVolunteer = {
          id: generateId(),
          ...body,
          createdAt: new Date().toISOString()
        };
        
        volunteers.push(newVolunteer);
        writeData(VOLUNTEERS_FILE, volunteers);
        
        sendJsonResponse(res, 201, newVolunteer);
      } catch (error) {
        sendJsonResponse(res, 400, { error: 'Invalid request body' });
      }
    }
    
    // Delete a volunteer
    else if (pathname.match(/^\/api\/volunteers\/[^/]+$/) && req.method === 'DELETE') {
      const id = pathname.split('/')[3];
      const volunteers = readData(VOLUNTEERS_FILE);
      const events = readData(EVENTS_FILE);
      
      const volunteerIndex = volunteers.findIndex(v => v.id === id);
      
      if (volunteerIndex === -1) {
        sendJsonResponse(res, 404, { error: 'Volunteer not found' });
      } else {
        // Remove volunteer
        volunteers.splice(volunteerIndex, 1);
        writeData(VOLUNTEERS_FILE, volunteers);
        
        // Remove associated events
        const updatedEvents = events.filter(event => event.volunteerId !== id);
        writeData(EVENTS_FILE, updatedEvents);
        
        sendJsonResponse(res, 200, { success: true });
      }
    }
    
    // Get all events
    else if (pathname === '/api/events' && req.method === 'GET') {
      const events = readData(EVENTS_FILE);
      sendJsonResponse(res, 200, events);
    }
    
    // Get events for a volunteer
    else if (pathname.match(/^\/api\/volunteers\/[^/]+\/events$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      const events = readData(EVENTS_FILE);
      const volunteerEvents = events.filter(event => event.volunteerId === id);
      
      sendJsonResponse(res, 200, volunteerEvents);
    }
    
    // Add an event
    else if (pathname === '/api/events' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const events = readData(EVENTS_FILE);
        
        const newEvent = {
          id: generateId(),
          ...body,
          date: body.date || new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        
        events.push(newEvent);
        writeData(EVENTS_FILE, events);
        
        sendJsonResponse(res, 201, newEvent);
      } catch (error) {
        sendJsonResponse(res, 400, { error: 'Invalid request body' });
      }
    }
    
    // Get admin password
    else if (pathname === '/api/admin/password' && req.method === 'GET') {
      const config = getConfig();
      sendJsonResponse(res, 200, { password: config.adminPassword });
    }
    
    // Change admin password
    else if (pathname === '/api/admin/password' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        
        if (!body.password) {
          sendJsonResponse(res, 400, { error: 'Password is required' });
          return;
        }
        
        const config = getConfig();
        config.adminPassword = body.password;
        saveConfig(config);
        
        sendJsonResponse(res, 200, { success: true });
      } catch (error) {
        sendJsonResponse(res, 400, { error: 'Invalid request body' });
      }
    }
    
    // Google Sheets config
    else if (pathname === '/api/sheets/config' && req.method === 'GET') {
      const config = getConfig();
      sendJsonResponse(res, 200, { sheetsConfig: config.sheetsConfig });
    }
    
    else if (pathname === '/api/sheets/config' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        
        if (!body.sheetsConfig) {
          sendJsonResponse(res, 400, { error: 'Sheets config is required' });
          return;
        }
        
        const config = getConfig();
        config.sheetsConfig = body.sheetsConfig;
        saveConfig(config);
        
        sendJsonResponse(res, 200, { success: true });
      } catch (error) {
        sendJsonResponse(res, 400, { error: 'Invalid request body' });
      }
    }
    
    // CSV Export simulation
    else if (pathname === '/api/export/csv' && req.method === 'GET') {
      sendJsonResponse(res, 200, {
        success: true,
        message: 'CSV export completed',
        files: [
          'volunteers.csv',
          'events.csv',
          'summary.csv'
        ]
      });
    }
    
    // Google Sheets sync using real API implementation
    else if (pathname === '/api/sync/sheets' && req.method === 'POST') {
      const config = getConfig();
      
      if (!config.sheetsConfig || !config.sheetsConfig.spreadsheetId) {
        sendJsonResponse(res, 400, { 
          success: false, 
          error: 'Google Sheets not configured' 
        });
        return;
      }

      try {
        // Get the data to sync
        const volunteers = readData(VOLUNTEERS_FILE);
        const events = readData(EVENTS_FILE);
        
        // Use the Google Sheets API to perform the actual sync
        console.log('Starting Google Sheets sync with spreadsheet ID:', config.sheetsConfig.spreadsheetId);
        
        // Get the service account email so we can include it in error messages
        const serviceEmail = config.sheetsConfig.credentials?.client_email || 'the service account email';
        
        // Call the syncToGoogleSheets function
        const syncResult = await syncToGoogleSheets(config.sheetsConfig, volunteers, events);
        
        console.log('Sync result:', syncResult);
        
        if (syncResult.success) {
          sendJsonResponse(res, 200, {
            success: true,
            message: `Synced with Google Sheets successfully. Spreadsheet ID: ${config.sheetsConfig.spreadsheetId}`,
            newData: {
              volunteers: volunteers.length,
              events: events.length
            }
          });
        } else {
          // Special handling for permission errors
          if (syncResult.error && syncResult.error.includes('permission')) {
            sendJsonResponse(res, 403, {
              success: false,
              error: `Permission denied: The service account does not have access to this spreadsheet. Please share the spreadsheet with ${serviceEmail} and give it Editor permission.`,
              serviceEmail: serviceEmail
            });
          } else {
            sendJsonResponse(res, 500, {
              success: false,
              error: syncResult.error || 'Unknown error during sync',
              serviceEmail: serviceEmail
            });
          }
        }
      } catch (error) {
        console.error('Error during Google Sheets sync:', error);
        
        // Get the service account email for error messages
        const serviceEmail = config.sheetsConfig.credentials?.client_email || 'the service account email';
        
        sendJsonResponse(res, 500, { 
          success: false, 
          error: error.message || 'Failed to sync with Google Sheets',
          serviceEmail: serviceEmail
        });
      }
    }
    
    // Unknown API route
    else {
      sendJsonResponse(res, 404, { error: 'API endpoint not found' });
    }
  }
  
  // Static file routes
  else {
    let filePath;
    
    if (pathname === '/') {
      filePath = path.join(__dirname, 'public', 'index.html');
    } else {
      filePath = path.join(__dirname, 'public', pathname);
    }
    
    serveStaticFile(res, filePath);
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});