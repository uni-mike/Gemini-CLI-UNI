import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

interface Task {
  id?: number;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  category?: string;
  completed: boolean;
  created_at?: string;
  updated_at?: string;
}

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState<Omit<Task, 'id' | 'completed'>>({ 
    title: '', 
    description: '', 
    priority: 'medium', 
    due_date: '', 
    category: '' 
  });
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API_BASE}/tasks`);
      setTasks(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/tasks`, newTask);
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '', category: '' });
      fetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const updateTask = async (task: Task) => {
    try {
      await axios.put(`${API_BASE}/tasks/${task.id}`, task);
      setEditingTask(null);
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (id: number) => {
    try {
      await axios.delete(`${API_BASE}/tasks/${id}`);
      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const toggleComplete = async (task: Task) => {
    try {
      await axios.put(`${API_BASE}/tasks/${task.id}`, {
        ...task,
        completed: !task.completed
      });
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Task Management App</h1>
      </header>
      
      <div className="container">
        {/* Task Form */}
        <form onSubmit={createTask} className="task-form">
          <h2>{editingTask ? 'Edit Task' : 'Add New Task'}</h2>
          <input
            type="text"
            placeholder="Title"
            value={editingTask ? editingTask.title : newTask.title}
            onChange={(e) => editingTask 
              ? setEditingTask({...editingTask, title: e.target.value})
              : setNewTask({...newTask, title: e.target.value})
            }
            required
          />
          <textarea
            placeholder="Description"
            value={editingTask ? editingTask.description || '' : newTask.description}
            onChange={(e) => editingTask 
              ? setEditingTask({...editingTask, description: e.target.value})
              : setNewTask({...newTask, description: e.target.value})
            }
          />
          <select
            value={editingTask ? editingTask.priority : newTask.priority}
            onChange={(e) => editingTask 
              ? setEditingTask({...editingTask, priority: e.target.value as 'low' | 'medium' | 'high'})
              : setNewTask({...newTask, priority: e.target.value as 'low' | 'medium' | 'high'})
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            type="date"
            value={editingTask ? editingTask.due_date || '' : newTask.due_date}
            onChange={(e) => editingTask 
              ? setEditingTask({...editingTask, due_date: e.target.value})
              : setNewTask({...newTask, due_date: e.target.value})
            }
          />
          <input
            type="text"
            placeholder="Category"
            value={editingTask ? editingTask.category || '' : newTask.category}
            onChange={(e) => editingTask 
              ? setEditingTask({...editingTask, category: e.target.value})
              : setNewTask({...newTask, category: e.target.value})
            }
          />
          {editingTask ? (
            <>
              <button type="button" onClick={() => updateTask(editingTask)}>
                Update Task
              </button>
              <button type="button" onClick={() => setEditingTask(null)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="submit">Add Task</button>
          )}
        </form>

        {/* Tasks List */}
        <div className="tasks-list">
          <h2>Tasks ({tasks.length})</h2>
          {tasks.map((task) => (
            <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
              <div className="task-header">
                <h3>{task.title}</h3>
                <span className={`priority ${task.priority}`}>{task.priority}</span>
              </div>
              <p>{task.description}</p>
              <div className="task-details">
                {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                {task.category && <span>Category: {task.category}</span>}
              </div>
              <div className="task-actions">
                <button onClick={() => toggleComplete(task)}>
                  {task.completed ? 'Mark Incomplete' : 'Mark Complete'}
                </button>
                <button onClick={() => setEditingTask(task)}>Edit</button>
                <button onClick={() => deleteTask(task.id!)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;