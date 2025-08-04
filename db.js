const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const poolConfig = connectionString ? {
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 2000, // Fail fast if can't connect
    idleTimeoutMillis: 30000,      // Close idle connections
    max: 5                         // Reduce connection count for Render
} : {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30000,
    max: 5
};

const pool = new Pool(poolConfig);

// Set statement timeout on new connections
pool.on('connect', (client) => {
    client.query('SET statement_timeout = 3000'); // 3 second timeout
    console.log('PostgreSQL client connected');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = {
    query: (text, params) => {
        // Support both string and config objects
        if (typeof text === 'object') {
            console.log('Executing query:', text.text, text.values || '');
            return pool.query(text);
        }
        
        console.log('Executing query:', text, params || '');
        return pool.query(text, params);
    },
    getClient: () => pool.connect(),
};