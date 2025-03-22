const router = require('express').Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const pool = require('../config/database');

// Get all subscriptions for a user
router.get('/', auth, async (req, res) => {
    try {
        const [subscriptions] = await pool.query(
            `SELECT s.*, c.name as category_name, c.color as category_color 
             FROM subscriptions s 
             LEFT JOIN categories c ON s.category_id = c.id 
             WHERE s.user_id = ?`,
            [req.user.id]
        );
        res.json(subscriptions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add new subscription
router.post('/', [
    auth,
    check('name', 'Name is required').not().isEmpty(),
    check('price', 'Price is required').isNumeric(),
    check('next_payment_date', 'Next payment date is required').not().isEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, category_id, price, billing_cycle, next_payment_date } = req.body;

        const [result] = await pool.query(
            `INSERT INTO subscriptions (user_id, name, category_id, price, billing_cycle, next_payment_date) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.user.id, name, category_id, price, billing_cycle, next_payment_date]
        );

        const [subscription] = await pool.query(
            `SELECT s.*, c.name as category_name, c.color as category_color 
             FROM subscriptions s 
             LEFT JOIN categories c ON s.category_id = c.id 
             WHERE s.id = ?`,
            [result.insertId]
        );

        res.json(subscription[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update subscription
router.put('/:id', [
    auth,
    check('name', 'Name is required').not().isEmpty(),
    check('price', 'Price is required').isNumeric()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, category_id, price, billing_cycle, next_payment_date } = req.body;

        // Check if subscription belongs to user
        const [existing] = await pool.query(
            'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        await pool.query(
            `UPDATE subscriptions 
             SET name = ?, category_id = ?, price = ?, billing_cycle = ?, next_payment_date = ? 
             WHERE id = ?`,
            [name, category_id, price, billing_cycle, next_payment_date, req.params.id]
        );

        const [subscription] = await pool.query(
            `SELECT s.*, c.name as category_name, c.color as category_color 
             FROM subscriptions s 
             LEFT JOIN categories c ON s.category_id = c.id 
             WHERE s.id = ?`,
            [req.params.id]
        );

        res.json(subscription[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete subscription
router.delete('/:id', auth, async (req, res) => {
    try {
        // Check if subscription belongs to user
        const [existing] = await pool.query(
            'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        await pool.query('DELETE FROM subscriptions WHERE id = ?', [req.params.id]);
        res.json({ message: 'Subscription deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get subscription statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const [totalSpend] = await pool.query(
            'SELECT SUM(price) as total FROM subscriptions WHERE user_id = ?',
            [req.user.id]
        );

        const [categoryBreakdown] = await pool.query(
            `SELECT c.name, c.color, COUNT(*) as count, SUM(s.price) as total 
             FROM subscriptions s 
             LEFT JOIN categories c ON s.category_id = c.id 
             WHERE s.user_id = ? 
             GROUP BY c.id`,
            [req.user.id]
        );

        res.json({
            totalMonthlySpend: totalSpend[0].total || 0,
            categoryBreakdown
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 