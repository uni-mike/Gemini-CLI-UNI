import express, { Request, Response, Router } from 'express';

const router: Router = express.Router();

// In-memory database for demonstration
let users: User[] = [];
let currentId = 1;

// User type definition
type User = {
  id: number;
  name: string;
  email: string;
};

// Get all users
router.get('/', (req: Request, res: Response) => {
  res.json(users);
});

// Get user by ID
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const user = users.find(u => u.id === id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).send('User not found');
  }
});

// Create new user
router.post('/', (req: Request, res: Response) => {
  const newUser: User = {
    id: currentId++,
    name: req.body.name,
    email: req.body.email
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

// Update user
router.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const userIndex = users.findIndex(u => u.id === id);
  
  if (