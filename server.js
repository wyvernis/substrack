const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const checkDatabase = require('./utils/checkDb');
const { startReminderScheduler } = require('./utils/reminderScheduler');
require('dotenv').config();

const app = express();

// Behind Vercel/reverse proxies — required for rate-limit IP detection and secure cookies
app.set('trust proxy', 1);

// Enable CORS pre-flight
app.options('*', cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
    origin: true, // Allow all origins in development
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

// Serve static files (must be before API catch-all for SPA pages)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/favicon.ico', (req, res) => {
    res.type('image/svg+xml');
    res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// API documentation route (moved — root serves index.html via static)
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
            database: 'mongodb connected',
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
app.use('/api', limiter);

// Load routes
try {
    const authRoutes = require('./routes/auth');
    const subscriptionRoutes = require('./routes/subscriptions');
    const sharedRoutes = require('./routes/shared');
    const budgetRoutes = require('./routes/budget');
    const analyticsRoutes = require('./routes/analytics');

    app.use('/api/auth', authRoutes);
    app.use('/api/subscriptions', subscriptionRoutes);
    app.use('/api/shared', sharedRoutes);
    app.use('/api/budget', budgetRoutes);
    app.use('/api/analytics', analyticsRoutes);

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

// Handle 404 — serve JSON for API routes, plain message for pages
app.use((req, res) => {
    console.log(`404 - Not Found: ${req.method} ${req.path}`);
    if (req.path.startsWith('/api')) {
        return res.status(404).json({
            message: 'Route not found',
            path: req.path,
            method: req.method
        });
    }
    res.status(404).send('Page not found');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// Start server
const startServer = async () => {
    const PORT = process.env.PORT || 5001;
    const HOST = '0.0.0.0';

    const server = app.listen(PORT, HOST, () => {
        console.log(`
    Server is running! 🚀
    
    Local:            http://localhost:${PORT}
    Test endpoint:    http://localhost:${PORT}/test
    Health check:     http://localhost:${PORT}/health
    API endpoint:     http://localhost:${PORT}/api
    
    Environment:      ${process.env.NODE_ENV}
    `);

        // Try DB connection after server starts so process doesn't crash on transient DB outages.
        checkDatabase()
            .then(() => {
                console.log('✓ Database connection successful');
                startReminderScheduler();
            })
            .catch((error) => {
                console.error('✗ Database unavailable at startup:', error.message);
                console.error('Server is running; DB-dependent routes may return 503 until connection is restored.');
            });
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