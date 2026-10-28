require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const { setWsBroadcaster } = require('./utils');
const { ocppServer } = require('./ocppServer');
const { isSupabaseConfigured } = require('./supabaseClient');

// Routes
const authRoutes = require('./routes/auth');
const stationRoutes = require('./routes/stations');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const simulatorRoutes = require('./routes/simulator');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// UI WebSocket for real-time dashboard events (< 5 seconds per PE-3 & Monitor.Status.Update)
const uiWss = new WebSocketServer({ noServer: true });
const connectedUiClients = new Set();

uiWss.on('connection', (ws) => {
  connectedUiClients.add(ws);
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Real-time CSMS Event Stream Connected' }));

  ws.on('close', () => {
    connectedUiClients.delete(ws);
  });
});

// Configure broadcaster to push live events to all connected browsers
setWsBroadcaster((event) => {
  const message = JSON.stringify(event);
  for (const client of connectedUiClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
});

// Initialize OCPP 2.0.1 WebSocket server
ocppServer.initialize(server);

// Route upgrade requests appropriately between /ws and /ocpp/v201
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url;
  if (pathname === '/ws') {
    uiWss.handleUpgrade(request, socket, head, (ws) => {
      uiWss.emit('connection', ws, request);
    });
  }
  // Note: /ocpp/v201 is handled by ocppServer.wss automatically
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'EV Charging Station Management System (CSMS)',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/simulator', simulatorRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` CSMS Backend API & WebSocket Server Running`);
  console.log(` Port: ${PORT}`);
  console.log(` REST API: http://localhost:${PORT}/api`);
  console.log(` Live UI WebSocket: ws://localhost:${PORT}/ws`);
  console.log(` Database: SQLite (csms.db) ${isSupabaseConfigured() ? '+ Supabase Connected' : '(Ready for Supabase sync)'}`);
  console.log(`====================================================`);
});
