# Task Management App

A complete task management application built with React TypeScript frontend, Node.js Express backend, and SQLite database.

## Features

- ✅ Create, read, update, and delete tasks
- 🎯 Priority levels (low, medium, high)
- 📅 Due dates with date picker
- 📂 Task categories
- ✅ Mark tasks as complete/incomplete
- 📱 Responsive design
- 🛡️ Proper error handling
- 🔄 Real-time updates

## Tech Stack

### Frontend
- React 18 with TypeScript
- Axios for API calls
- CSS for styling

### Backend
- Node.js with Express
- SQLite database
- CORS enabled
- RESTful API design

## Project Structure

```
TASK_APP/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── styles/
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── public/
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── models/
│   │   ├── middleware/
│   │   ├── config/
│   │   └── server.js
│   ├── database/
│   │   └── tasks.db
│   └── package.json
└── docs/
    └── README.md
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd TASK_APP/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Initialize database:
   ```bash
   npm run init-db
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

   The backend will run on http://localhost:5000

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd TASK_APP/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

   The frontend will run on http://localhost:3000

## API Endpoints

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Task Schema
```typescript
{
  id?: number;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  due_date?: string; // ISO date string
  category?: string;
  completed: boolean;
  created_at?: string;
  updated_at?: string;
}
```

## Usage

1. **Add a Task**: Fill out the form with task details and click "Add Task"
2. **Edit a Task**: Click the "Edit" button on any task, modify the details, and click "Update Task"
3. **Delete a Task**: Click the "Delete" button on any task
4. **Complete/Incomplete**: Toggle the completion status with the "Mark Complete/Incomplete" button
5. **Filter by Priority**: Tasks are color-coded by priority level

## Error Handling

The application includes comprehensive error handling:
- Network request failures
- Database operation errors
- Invalid input validation
- 404 handling for unknown endpoints

All errors are logged to the console and displayed to the user with appropriate messages.

## Development

### Backend Development
- Use `npm run dev` for development with auto-restart
- Database changes require re-running `npm run init-db`
- Check console for error messages and server status

### Frontend Development
- Use `npm start` for development with hot reload
- TypeScript compilation errors will show in console
- Browser developer tools for debugging

## Production Deployment

1. Build frontend: `npm run build`
2. Set environment variables for production
3. Use process manager like PM2 for backend
4. Configure reverse proxy (nginx/Apache)
5. Secure database connections

## License

MIT License - feel free to use this project for learning and development purposes.