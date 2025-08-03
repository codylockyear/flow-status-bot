const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

// Use DATABASE_URL if available, otherwise fall back to individual variables
const connectionString = process.env.DATABASE_URL;

const poolConfig = connectionString ? {
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false // Required for Render if connecting to external DB or for local testing
    }
} : {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false // Required for Render if connecting to external DB or for local testing
    }
};

const pool = new Pool(poolConfig);

// Event listener for successful connections
pool.on('connect', () => {
    console.log('PostgreSQL client connected');
});

// Event listener for errors in the connection pool
pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
});

// Export a query function for simple queries
module.exports = {
    query: (text, params) => {
        console.log('Executing query:', text, params || '');
        return pool.query(text, params);
    },
    getClient: () => pool.connect(),
};
