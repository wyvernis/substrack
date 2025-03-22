const router = require('express').Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const pool = require('../config/database');

// Get all shared subscriptions for a user
router.get('/', auth, async (req, res) => {
    try {
        // Get subscriptions where user is owner
        const [ownedSubscriptions] = await pool.query(
            `SELECT ss.*, s.name as subscription_name, s.price as total_price,
                    u.name as member_name, u.email as member_email
             FROM shared_subscriptions ss
             JOIN subscriptions s ON ss.subscription_id = s.id
             JOIN users u ON ss.member_id = u.id
             WHERE ss.owner_id = ?`,
            [req.user.id]
        );

        // Get subscriptions where user is member
        const [memberSubscriptions] = await pool.query(
            `SELECT ss.*, s.name as subscription_name, s.price as total_price,
                    u.name as owner_name, u.email as owner_email
             FROM shared_subscriptions ss
             JOIN subscriptions s ON ss.subscription_id = s.id
             JOIN users u ON ss.owner_id = u.id
             WHERE ss.member_id = ?`,
            [req.user.id]
        );

        res.json({
            owned: ownedSubscriptions,
            member: memberSubscriptions
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create shared subscription
router.post('/', [
    auth,
    check('subscription_id', 'Subscription ID is required').not().isEmpty(),
    check('member_email', 'Member email is required').isEmail(),
    check('share_amount', 'Share amount is required').isNumeric()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { subscription_id, member_email, share_amount } = req.body;

        // Check if subscription belongs to user
        const [subscription] = await pool.query(
            'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
            [subscription_id, req.user.id]
        );

        if (subscription.length === 0) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        // Get member user
        const [member] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [member_email]
        );

        if (member.length === 0) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // Check if share already exists
        const [existing] = await pool.query(
            'SELECT * FROM shared_subscriptions WHERE subscription_id = ? AND member_id = ?',
            [subscription_id, member[0].id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Share already exists' });
        }

        // Create share
        const [result] = await pool.query(
            `INSERT INTO shared_subscriptions 
             (subscription_id, owner_id, member_id, share_amount) 
             VALUES (?, ?, ?, ?)`,
            [subscription_id, req.user.id, member[0].id, share_amount]
        );

        const [sharedSubscription] = await pool.query(
            `SELECT ss.*, s.name as subscription_name, s.price as total_price,
                    u.name as member_name, u.email as member_email
             FROM shared_subscriptions ss
             JOIN subscriptions s ON ss.subscription_id = s.id
             JOIN users u ON ss.member_id = u.id
             WHERE ss.id = ?`,
            [result.insertId]
        );

        res.json(sharedSubscription[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update payment status
router.put('/:id/payment', auth, async (req, res) => {
    try {
        const { payment_status } = req.body;

        // Check if share exists and user is member
        const [share] = await pool.query(
            'SELECT * FROM shared_subscriptions WHERE id = ? AND member_id = ?',
            [req.params.id, req.user.id]
        );

        if (share.length === 0) {
            return res.status(404).json({ message: 'Shared subscription not found' });
        }

        await pool.query(
            'UPDATE shared_subscriptions SET payment_status = ? WHERE id = ?',
            [payment_status, req.params.id]
        );

        res.json({ message: 'Payment status updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete shared subscription
router.delete('/:id', auth, async (req, res) => {
    try {
        // Check if share exists and user is owner
        const [share] = await pool.query(
            'SELECT * FROM shared_subscriptions WHERE id = ? AND owner_id = ?',
            [req.params.id, req.user.id]
        );

        if (share.length === 0) {
            return res.status(404).json({ message: 'Shared subscription not found' });
        }

        await pool.query('DELETE FROM shared_subscriptions WHERE id = ?', [req.params.id]);
        res.json({ message: 'Shared subscription deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 