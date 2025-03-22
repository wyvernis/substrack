const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const checkDatabase = require('./utils/checkDb');
require('dotenv').config();

const app = express();

// Enable CORS pre-flight
app.options('*', cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
    origin: [process.env.CLIENT_URL, 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Basic route for testing
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Substrack API' });
});

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

// Health check route
app.get('/health', async (req, res) => {
    try {
        // Test database connection
        await checkDatabase();
        
        res.json({ 
            status: 'ok', 
            timestamp: new Date(),
            env: process.env.NODE_ENV,
            database: 'connected',
            api: 'running'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            timestamp: new Date(),
            env: process.env.NODE_ENV,
            database: 'disconnected',
            error: error.message
        });
    }
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Load routes
try {
    const authRoutes = require('./routes/auth');
    const subscriptionRoutes = require('./routes/subscriptions');
    const sharedRoutes = require('./routes/shared');
    const budgetRoutes = require('./routes/budget');

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/subscriptions', subscriptionRoutes);
    app.use('/api/shared', sharedRoutes);
    app.use('/api/budget', budgetRoutes);

    console.log('✓ All routes loaded successfully');
} catch (error) {
    console.error('✗ Error loading routes:', error);
    process.exit(1);
}

// API documentation route
app.get('/api', (req, res) => {
    res.json({
        message: 'Substrack API Documentation',
        version: '1.0.0',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                logout: 'POST /api/auth/logout',
                forgotPassword: 'POST /api/auth/forgot-password',
                resetPassword: 'POST /api/auth/reset-password/:token',
                profile: 'GET /api/auth/profile'
            },
            subscriptions: {
                getAll: 'GET /api/subscriptions',
                create: 'POST /api/subscriptions',
                update: 'PUT /api/subscriptions/:id',
                delete: 'DELETE /api/subscriptions/:id',
                stats: 'GET /api/subscriptions/stats'
            },
            shared: {
                getAll: 'GET /api/shared',
                create: 'POST /api/shared',
                updatePayment: 'PUT /api/shared/:id/payment',
                delete: 'DELETE /api/shared/:id'
            },
            budget: {
                get: 'GET /api/budget',
                update: 'POST /api/budget',
                status: 'GET /api/budget/status'
            }
        }
    });
});

// Handle 404
app.use((req, res, next) => {
    console.log(`404 - Not Found - ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        message: 'Route not found',
        path: req.originalUrl,
        suggestion: 'Visit /api for API documentation'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Start server
const startServer = async () => {
    try {
        // Check database connection before starting server
        await checkDatabase();
        
        const PORT = process.env.PORT || 5001;
        const HOST = '0.0.0.0';

        const server = app.listen(PORT, HOST, () => {
            console.log('✓ Database connection successful');
            console.log(`✓ Server is running at http://${HOST}:${PORT}`);
            console.log(`✓ Test the server at: http://localhost:${PORT}/test`);
            console.log(`✓ API documentation at: http://localhost:${PORT}/api`);
            console.log(`✓ Health check at: http://localhost:${PORT}/health`);
            console.log(`✓ Frontend URL: ${process.env.CLIENT_URL}`);
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.syscall !== 'listen') {
                throw error;
            }

            switch (error.code) {
                case 'EACCES':
                    console.error('✗ Port requires elevated privileges');
                    process.exit(1);
                    break;
                case 'EADDRINUSE':
                    console.error('✗ Port is already in use');
                    process.exit(1);
                    break;
                default:
                    throw error;
            }
        });
    } catch (error) {
        console.error('✗ Failed to start server:', error.message);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('✗ Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('✗ Uncaught Exception:', err);
    process.exit(1);
});

// Start the server
startServer();

module.exports = app; 