const jwt = require('jsonwebtoken');
require('dotenv').config();

const auth = (req, res, next) => {
    try {
        // Get token from cookie, Authorization header, or x-auth-token header
        const token = req.cookies.token || 
                     req.header('Authorization')?.replace('Bearer ', '') || 
                     req.header('x-auth-token');
        
        if (!token) {
            return res.status(401).json({ 
                message: 'No authentication token, access denied',
                error: 'token_missing'
            });
        }

        try {
            // Verify token
            const verified = jwt.verify(token, process.env.JWT_SECRET);
            req.user = verified;
            next();
        } catch (verifyError) {
            console.error('Token verification failed:', verifyError.message);
            return res.status(401).json({ 
                message: 'Token is invalid or expired',
                error: 'token_invalid'
            });
        }
    } catch (err) {
        console.error('Auth middleware error:', err.message);
        res.status(500).json({ 
            message: 'Server error in authentication',
            error: 'server_error'
        });
    }
};

module.exports = auth; 