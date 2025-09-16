#!/usr/bin/env npx tsx
// Before dotenv
console.log('Before dotenv - DATABASE_URL:', process.env.DATABASE_URL);

// Load dotenv like the app does
import dotenv from 'dotenv';
dotenv.config();

console.log('After dotenv - DATABASE_URL:', process.env.DATABASE_URL);

// Check if .env file exists and what it contains
import fs from 'fs';
if (fs.existsSync('.env')) {
  console.log('.env file contents:');
  console.log(fs.readFileSync('.env', 'utf8'));
} else {
  console.log('.env file does not exist');
}
