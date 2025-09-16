const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'plants.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS plants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT,
    lastWatered TEXT,
    wateringInterval INTEGER DEFAULT 7,
    notes TEXT
  )`);
});

app.get('/api/plants', (req, res) => {
  db.all('SELECT * FROM plants', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/plants', (req, res) => {
  const { name, type, lastWatered, wateringInterval, notes } = req.body;
  db.run(
    'INSERT INTO plants (name, type, lastWatered, wateringInterval, notes) VALUES (?, ?, ?, ?, ?)',
    [name, type, lastWatered, wateringInterval, notes],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, name, type, lastWatered, wateringInterval, notes });
    }
  );
});

app.put('/api/plants/:id', (req, res) => {
  const { name, type, lastWatered, wateringInterval, notes } = req.body;
  const { id } = req.params;
  db.run(
    'UPDATE plants SET name = ?, type = ?, lastWatered = ?, wateringInterval = ?, notes = ? WHERE id = ?',
    [name, type, lastWatered, wateringInterval, notes, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Plant updated', changes: this.changes });
    }
  );
});

app.delete('/api/plants/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM plants WHERE id = ?', id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Plant deleted', changes: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});