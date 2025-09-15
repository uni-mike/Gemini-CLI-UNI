# ECOMMERCE_PLATFORM

A comprehensive e-commerce platform built with React TypeScript frontend and Node.js Express backend.

## Features

- User registration and login with JWT authentication
- Product catalog with categories and search
- Shopping cart functionality
- Secure checkout process
- Order history and tracking
- Admin panel for product management
- Responsive design with mobile support
- RESTful API with proper error handling

## Tech Stack

### Frontend
- React 18 with TypeScript
- Material-UI for components
- Redux Toolkit for state management
- React Router for navigation
- Axios for API calls

### Backend
- Node.js with Express
- SQLite database
- JWT authentication
- bcryptjs for password hashing
- express-validator for input validation
- Helmet for security headers
- CORS for cross-origin requests

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd ecommerce-platform
```

2. Install frontend dependencies
```bash
cd ecommerce-platform
npm install
```

3. Install backend dependencies
```bash
cd backend
npm install
```

4. Set up environment variables
```bash
# Backend .env file
JWT_SECRET=your-super-secret-jwt-key
PORT=5000
```

5. Initialize database
```bash
cd backend
npm run dev
# This will create the SQLite database and tables
```

6. Start the development servers

Frontend (port 3000):
```bash
cd ecommerce-platform
npm start
```

Backend (port 5000):
```bash
cd backend
npm run dev
```

## API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Register a new user

Request body:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### POST /api/auth/login
Login user

Request body:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Product Endpoints

#### GET /api/products
Get all products (with optional query parameters)

#### GET /api/products/:id
Get product by ID

#### GET /api/products/category/:categoryId
Get products by category

### Order Endpoints

#### POST /api/orders
Create new order (requires authentication)

#### GET /api/orders
Get user's order history (requires authentication)

#### GET /api/orders/:id
Get order details (requires authentication)

### Admin Endpoints

#### POST /api/admin/products
Create new product (requires admin authentication)

#### PUT /api/admin/products/:id
Update product (requires admin authentication)

#### DELETE /api/admin/products/:id
Delete product (requires admin authentication)

## Database Schema

### Users Table
- id: INTEGER PRIMARY KEY
- email: TEXT UNIQUE
- password: TEXT
- first_name: TEXT
- last_name: TEXT
- is_admin: BOOLEAN
- created_at: DATETIME

### Products Table
- id: INTEGER PRIMARY KEY
- name: TEXT
- description: TEXT
- price: DECIMAL(10,2)
- category_id: INTEGER
- image_url: TEXT
- stock_quantity: INTEGER
- is_active: BOOLEAN
- created_at: DATETIME

### Categories Table
- id: INTEGER PRIMARY KEY
- name: TEXT
- description: TEXT
- created_at: DATETIME

### Orders Table
- id: INTEGER PRIMARY KEY
- user_id: INTEGER
- total_amount: DECIMAL(10,2)
- status: TEXT
- shipping_address: TEXT
- created_at: DATETIME

### Order Items Table
- id: INTEGER PRIMARY KEY
- order_id: INTEGER
- product_id: INTEGER
- quantity: INTEGER
- price: DECIMAL(10,2)

## Testing

Run unit tests:
```bash
# Frontend tests
cd ecommerce-platform
npm test

# Backend tests
cd backend
npm test
```

## Production Deployment

1. Build frontend:
```bash
cd ecommerce-platform
npm run build
```

2. Set production environment variables
3. Use process manager like PM2 for backend
4. Configure reverse proxy (nginx)
5. Enable HTTPS
6. Set up proper backups for database

## Security Features

- JWT authentication with secure tokens
- Password hashing with bcrypt
- Input validation with express-validator
- Security headers with Helmet
- Rate limiting
- CORS configuration
- SQL injection prevention

## Performance Optimizations

- Database indexing
- Query optimization
- Response compression
- Static file serving
- Client-side caching

## License

MIT License