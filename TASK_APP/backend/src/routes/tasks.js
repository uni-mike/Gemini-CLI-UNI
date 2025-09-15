const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '..', '..', 'database', 'tasks.db');

// Get all tasks
router.get('/', (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  db.all('SELECT * FROM tasks ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
  
  db.close();
});

// Get single task
router.get('/:id', (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(row);
  });
  
  db.close();
});

// Create task
router.post('/', (req, res) => {
  const { title, description, priority, due_date, category } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  const db = new sqlite3.Database(dbPath);
  
  db.run(
    'INSERT INTO tasks (title, description, priority, due_date, category) VALUES (?, ?, ?, ?, ?)',
    [title, description, priority, due_date, category],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, title, description, priority, due_date, category });
    }
  );
  
  db.close();
});

// Update task
router.put('/:id', (req, res) => {
  const { title, description, priority, due_date, category, completed } = req.body;
  
  const db = new sqlite3.Database(dbPath);
  
  db.run(
    'UPDATE tasks SET title = ?, description = ?, priority = ?, due_date = ?, category = ?, completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, description, priority, due_date, category, completed, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.json({ message: 'Task updated successfully' });
    }
  );
  
  db.close();
});

// Delete task
router.delete('/:id', (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({ message: 'Task deleted successfully' });
  });
  
  db.close();
});

module.exports = router;