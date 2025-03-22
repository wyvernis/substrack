const router = require('express').Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const pool = require('../config/database');

// Get user's budget settings
router.get('/', auth, async (req, res) => {
    try {
        const [settings] = await pool.query(
            'SELECT * FROM budget_settings WHERE user_id = ?',
            [req.user.id]
        );

        if (settings.length === 0) {
            return res.json({ monthly_budget: 0 });
        }

        res.json(settings[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update budget settings
router.post('/', [
    auth,
    check('monthly_budget', 'Monthly budget must be a number').isNumeric()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { monthly_budget } = req.body;

        // Check if settings exist
        const [existing] = await pool.query(
            'SELECT * FROM budget_settings WHERE user_id = ?',
            [req.user.id]
        );

        if (existing.length === 0) {
            // Create new settings
            await pool.query(
                'INSERT INTO budget_settings (user_id, monthly_budget) VALUES (?, ?)',
                [req.user.id, monthly_budget]
            );
        } else {
            // Update existing settings
            await pool.query(
                'UPDATE budget_settings SET monthly_budget = ? WHERE user_id = ?',
                [monthly_budget, req.user.id]
            );
        }

        // Get budget status
        const [totalSpend] = await pool.query(
            'SELECT SUM(price) as total FROM subscriptions WHERE user_id = ?',
            [req.user.id]
        );

        res.json({
            monthly_budget,
            current_spend: totalSpend[0].total || 0,
            remaining: monthly_budget - (totalSpend[0].total || 0)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get budget status
router.get('/status', auth, async (req, res) => {
    try {
        const [settings] = await pool.query(
            'SELECT monthly_budget FROM budget_settings WHERE user_id = ?',
            [req.user.id]
        );

        const monthly_budget = settings.length > 0 ? settings[0].monthly_budget : 0;

        const [totalSpend] = await pool.query(
            'SELECT SUM(price) as total FROM subscriptions WHERE user_id = ?',
            [req.user.id]
        );

        const current_spend = totalSpend[0].total || 0;
        const remaining = monthly_budget - current_spend;
        const status = remaining >= 0 ? 'On Track' : 'Over Budget';

        res.json({
            monthly_budget,
            current_spend,
            remaining,
            status
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 