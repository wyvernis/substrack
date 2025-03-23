const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test database connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✓ Database connected successfully');
        
        // Test query
        const [result] = await connection.query('SELECT 1');
        console.log('✓ Database query successful');
        
        // Check if required tables exist
        const [tables] = await connection.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = ?`, 
            [process.env.DB_NAME]
        );
        
        const requiredTables = ['users', 'subscriptions', 'shared_subscriptions', 'budget_settings', 'password_reset_tokens'];
        const existingTables = tables.map(t => t.table_name);
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));
        
        if (missingTables.length > 0) {
            console.warn('⚠ Missing tables:', missingTables);
            console.warn('Please run the database.sql script to create all required tables');
        } else {
            console.log('✓ All required tables exist');
        }
        
        connection.release();
    } catch (error) {
        console.error('✗ Database connection failed:', error.message);
        console.error('Please check your database credentials in .env file');
        throw error;
    }
};

// Execute connection test
testConnection().catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error('Database connection was closed.');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
        console.error('Database has too many connections.');
    }
    if (err.code === 'ECONNREFUSED') {
        console.error('Database connection was refused.');
    }
});

module.exports = pool; 