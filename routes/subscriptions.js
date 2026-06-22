const router = require('express').Router();
const mongoose = require('mongoose');
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const formatDoc = require('../utils/formatDoc');
const { syncSpendingLog } = require('../utils/spendingLog');
const { daysUntil, renewalLabel } = require('../utils/currency');

const afterSubChange = async (userId) => {
    await syncSpendingLog(userId);
};

router.get('/', auth, async (req, res) => {
    try {
        const { status, category, search } = req.query;
        const filter = { user_id: req.user.id };

        if (status && status !== 'all') filter.status = status;
        if (category && category !== 'all') filter.category = category;
        if (search) filter.name = { $regex: search, $options: 'i' };

        const subscriptions = await Subscription.find(filter).sort({ next_billing_date: 1 });
        const formatted = formatDoc(subscriptions).map((s) => ({
            ...s,
            daysUntil: daysUntil(s.next_billing_date),
            renewalLabel: renewalLabel(s.next_billing_date),
        }));
        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/upcoming', auth, async (req, res) => {
    try {
        const subs = await Subscription.find({ user_id: req.user.id, status: 'active' })
            .sort({ next_billing_date: 1 });
        res.json(formatDoc(subs).map((s) => ({
            ...s,
            daysUntil: daysUntil(s.next_billing_date),
            renewalLabel: renewalLabel(s.next_billing_date),
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/', [
    auth,
    check('name', 'Name is required').not().isEmpty(),
    check('amount', 'Amount is required').isNumeric(),
    check('next_billing_date', 'Next billing date is required').not().isEmpty(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
        }

        const {
            name, category, amount, billing_cycle, next_billing_date,
            notes, tags, trial_ends_at, invoice_url, currency, status,
        } = req.body;

        const subscription = await Subscription.create({
            user_id: req.user.id,
            name,
            category: category || 'other',
            amount,
            billing_cycle: billing_cycle || 'monthly',
            next_billing_date: new Date(next_billing_date),
            notes: notes || '',
            tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map((t) => t.trim()) : []),
            trial_ends_at: trial_ends_at ? new Date(trial_ends_at) : null,
            invoice_url: invoice_url || '',
            currency: currency || 'INR',
            status: status || 'active',
        });

        await afterSubChange(req.user.id);
        res.json(formatDoc(subscription));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/import', auth, async (req, res) => {
    try {
        const { csv } = req.body;
        if (!csv || typeof csv !== 'string') {
            return res.status(400).json({ message: 'CSV content required' });
        }

        const lines = csv.trim().split('\n').filter(Boolean);
        if (lines.length < 2) {
            return res.status(400).json({ message: 'CSV must have header and at least one row' });
        }

        const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
        const imported = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim());
            const row = Object.fromEntries(headers.map((h, idx) => [h, cols[idx] || '']));

            try {
                if (!row.name || !row.amount) {
                    errors.push({ line: i + 1, message: 'Missing name or amount' });
                    continue;
                }

                const sub = await Subscription.create({
                    user_id: req.user.id,
                    name: row.name,
                    amount: parseFloat(row.amount),
                    category: row.category || 'other',
                    billing_cycle: row.billing_cycle || row.cycle || 'monthly',
                    next_billing_date: row.next_billing_date ? new Date(row.next_billing_date) : new Date(Date.now() + 30 * 86400000),
                    notes: row.notes || '',
                    tags: row.tags ? row.tags.split(';').map((t) => t.trim()) : [],
                    currency: row.currency || 'INR',
                });
                imported.push(formatDoc(sub));
            } catch (e) {
                errors.push({ line: i + 1, message: e.message });
            }
        }

        await afterSubChange(req.user.id);
        res.json({ imported: imported.length, subscriptions: imported, errors });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/:id', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        const update = { ...req.body };
        if (update.next_billing_date) update.next_billing_date = new Date(update.next_billing_date);
        if (update.trial_ends_at) update.trial_ends_at = new Date(update.trial_ends_at);
        if (update.tags && typeof update.tags === 'string') {
            update.tags = update.tags.split(',').map((t) => t.trim());
        }
        delete update.user_id;
        delete update.id;

        const subscription = await Subscription.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user.id },
            update,
            { new: true, runValidators: true }
        );

        if (!subscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        await afterSubChange(req.user.id);
        res.json(formatDoc(subscription));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/mark-used', auth, async (req, res) => {
    try {
        const subscription = await Subscription.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user.id },
            { last_used_at: new Date() },
            { new: true }
        );
        if (!subscription) return res.status(404).json({ message: 'Subscription not found' });
        res.json(formatDoc(subscription));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        const subscription = await Subscription.findOneAndDelete({
            _id: req.params.id,
            user_id: req.user.id,
        });

        if (!subscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        await afterSubChange(req.user.id);
        res.json({ message: 'Subscription deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/stats', auth, async (req, res) => {
    try {
        const [totals, categoryBreakdown] = await Promise.all([
            Subscription.aggregate([
                { $match: { user_id: new mongoose.Types.ObjectId(req.user.id), status: 'active' } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Subscription.aggregate([
                { $match: { user_id: new mongoose.Types.ObjectId(req.user.id), status: 'active' } },
                {
                    $group: {
                        _id: '$category',
                        name: { $first: '$category' },
                        count: { $sum: 1 },
                        total: { $sum: '$amount' },
                    },
                },
            ]),
        ]);

        res.json({
            totalMonthlySpend: totals[0]?.total || 0,
            categoryBreakdown: categoryBreakdown.map((c) => ({
                name: c.name || c._id || 'other',
                count: c.count,
                total: c.total,
            })),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
