const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve the dashboard frontend

let clients = []; // Array to hold connected real-time clients

// Database Setup
const db = new sqlite3.Database('./sensor_data.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS sensor_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        soil_moisture REAL,
        light_intensity REAL,
        temperature REAL,
        humidity REAL,
        water_tank_level REAL,
        pump_status INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

app.post('/api/data', (req, res) => {
  const data = req.body;
  console.log('\n[INFO] Received new data:', data);

  const {
    device_id,
    soil_moisture,
    light_intensity,
    temperature,
    humidity,
    water_tank_level,
    pump_status
  } = data;

  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }

  const sql = `INSERT INTO sensor_readings 
    (device_id, soil_moisture, light_intensity, temperature, humidity, water_tank_level, pump_status) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`;

  const params = [device_id, soil_moisture, light_intensity, temperature, humidity, water_tank_level, pump_status];

  db.run(sql, params, function(err) {
    if (err) {
      console.error('[ERROR] Inserting data:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log(`[SUCCESS] Data saved with ID: ${this.lastID}`);
    res.status(200).json({ message: 'Data logged successfully', id: this.lastID });
    
    // Push real-time event to all connected dashboard clients
    // Use the current server timestamp for the live point
    const liveData = { ...data, timestamp: new Date().toISOString() };
    clients.forEach(client => client.write(`data: ${JSON.stringify(liveData)}\n\n`));
  });
});

// --- Server-Sent Events Endpoint (Live Streaming) ---
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); 

  res.write(`data: {"status": "connected"}\n\n`);

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

app.get('/api/latest', (req, res) => {
  const sql = `SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 50`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`\n=========================================`);
  console.log(`🚀 Server running on port ${port}`);
  console.log(`=========================================`);
  console.log(`-> ESP URL should be: http://<YOUR_COMPUTER_IP>:${port}/api/data\n`);
});
