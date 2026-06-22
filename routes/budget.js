const router = require('express').Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const BudgetSettings = require('../models/BudgetSettings');
const Subscription = require('../models/Subscription');
const formatDoc = require('../utils/formatDoc');

const { normalizeToMonthly } = require('../utils/currency');

const getMonthlySpend = async (userId) => {
    const subs = await Subscription.find({ user_id: userId, status: 'active' });
    return subs.reduce((sum, s) => sum + normalizeToMonthly(s.amount, s.billing_cycle), 0);
};

router.get('/', auth, async (req, res) => {
    try {
        const settings = await BudgetSettings.findOne({ user_id: req.user.id });
        if (!settings) {
            return res.json({ monthly_budget: 0 });
        }
        res.json(formatDoc(settings));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/', [
    auth,
    check('monthly_budget', 'Monthly budget must be a number').isNumeric(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { monthly_budget } = req.body;

        await BudgetSettings.findOneAndUpdate(
            { user_id: req.user.id },
            { monthly_budget },
            { upsert: true, new: true, runValidators: true }
        );

        const current_spend = await getMonthlySpend(req.user.id);

        res.json({
            monthly_budget,
            current_spend,
            remaining: monthly_budget - current_spend,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/status', auth, async (req, res) => {
    try {
        const settings = await BudgetSettings.findOne({ user_id: req.user.id });
        const monthly_budget = settings?.monthly_budget || 0;
        const current_spend = await getMonthlySpend(req.user.id);
        const remaining = monthly_budget - current_spend;
        const status = remaining >= 0 ? 'On Track' : 'Over Budget';

        res.json({
            monthly_budget,
            current_spend,
            remaining,
            status,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
