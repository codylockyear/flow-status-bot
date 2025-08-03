const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // Remove SSL for local development
    // ssl: {
    //     rejectUnauthorized: false
    // }
});

// Optional: Log when client connects/disconnects for debugging
pool.on('connect', () => {
    console.log('PostgreSQL client connected');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1); // Exit process if pool encounters an unrecoverable error
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(), // For transactions or multiple queries with same client
};