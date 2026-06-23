const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const auth = require('../middleware/auth');
const formatDoc = require('../utils/formatDoc');
const { sendPasswordResetEmail } = require('../utils/email');
const checkDatabase = require('../utils/checkDb');

const signToken = (user) => {
    const payload = {
        user: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
        },
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
};

const isDatabaseUnavailableError = (err) => {
    const message = String(err?.message || '').toLowerCase();
    return (
        err?.name === 'MongooseError' ||
        message.includes('buffering timed out') ||
        message.includes('server selection') ||
        message.includes('econnrefused')
    );
};

router.post('/register', [
    check('firstName', 'First name is required').trim().not().isEmpty(),
    check('lastName', 'Last name is required').trim().not().isEmpty(),
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
], async (req, res) => {
    try {
        await checkDatabase();
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array(),
            });
        }

        const { firstName, lastName, email, password } = req.body;
        const name = `${firstName} ${lastName}`.trim();

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email',
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            settings: { currency: 'INR', darkMode: false },
        });
        const token = signToken(user);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: formatDoc(user),
        });
    } catch (err) {
        console.error('Registration error:', err);
        if (isDatabaseUnavailableError(err)) {
            return res.status(503).json({
                success: false,
                message: 'Database unavailable. Please try again in a moment.',
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    }
});

router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
], async (req, res) => {
    try {
        await checkDatabase();
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = signToken(user);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({
            message: 'Logged in successfully',
            token,
            user: formatDoc(user),
        });
    } catch (err) {
        console.error('Login error:', err);
        if (isDatabaseUnavailableError(err)) {
            return res.status(503).json({ message: 'Database unavailable. Please try again in a moment.' });
        }
        res.status(500).json({ message: 'Server error during login' });
    }
});

router.post('/forgot-password', [
    check('email', 'Please include a valid email').isEmail(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        await PasswordResetToken.deleteMany({ user_id: user._id });
        await PasswordResetToken.create({
            user_id: user._id,
            token: hashedToken,
            expires_at: new Date(Date.now() + 60 * 60 * 1000),
        });

        await sendPasswordResetEmail(email, resetToken);

        res.json({ message: 'Password reset email sent' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ message: 'Server error during password reset request' });
    }
});

router.post('/reset-password/:token', [
    check('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { password } = req.body;
        const { token } = req.params;
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const resetRecord = await PasswordResetToken.findOne({
            token: hashedToken,
            expires_at: { $gt: new Date() },
        });

        if (!resetRecord) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await User.findByIdAndUpdate(resetRecord.user_id, { password: hashedPassword });
        await PasswordResetToken.deleteMany({ user_id: resetRecord.user_id });

        res.json({ message: 'Password reset successful' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ message: 'Server error during password reset' });
    }
});

router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('name email settings createdAt');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(formatDoc(user));
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ message: 'Server error while fetching profile' });
    }
});

router.put('/profile', auth, [
    check('name').optional().trim().not().isEmpty(),
    check('email').optional().isEmail().normalizeEmail(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        const { name, email } = req.body;
        const update = {};
        if (name) update.name = name;
        if (email) {
            const exists = await User.findOne({ email, _id: { $ne: req.user.id } });
            if (exists) return res.status(400).json({ message: 'Email already in use' });
            update.email = email;
        }

        const user = await User.findByIdAndUpdate(req.user.id, update, { new: true })
            .select('name email settings createdAt');
        res.json(formatDoc(user));
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/settings', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('settings name email');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({
            ...formatDoc(user),
            settings: user.settings || { currency: 'INR', darkMode: false },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/settings', auth, async (req, res) => {
    try {
        const { currency, darkMode, reminders, timezone } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.settings) user.settings = {};
        if (currency) user.settings.currency = currency.toUpperCase();
        if (typeof darkMode === 'boolean') user.settings.darkMode = darkMode;
        if (timezone) user.settings.timezone = timezone;
        if (reminders) user.settings.reminders = { ...user.settings.reminders, ...reminders };

        await user.save();
        res.json({ settings: user.settings });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/change-password', auth, [
    check('currentPassword', 'Current password required').exists(),
    check('newPassword', 'New password must be 6+ characters').isLength({ min: 6 }),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        const user = await User.findById(req.user.id);
        const match = await bcrypt.compare(req.body.currentPassword, user.password);
        if (!match) return res.status(400).json({ message: 'Current password is incorrect' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.newPassword, salt);
        await user.save();

        res.json({ message: 'Password updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
