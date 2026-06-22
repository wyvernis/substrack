const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const BudgetSettings = require('../models/BudgetSettings');
const { getInsights } = require('../utils/insights');
const { normalizeToMonthly, normalizeToYearly, daysUntil, renewalLabel } = require('../utils/currency');
const { getTrends, syncSpendingLog } = require('../utils/spendingLog');
const formatDoc = require('../utils/formatDoc');

router.get('/overview', auth, async (req, res) => {
    try {
        const subs = await Subscription.find({ user_id: req.user.id });
        const active = subs.filter((s) => s.status === 'active');
        const cancelled = subs.filter((s) => s.status === 'cancelled');

        const monthly = active.reduce((sum, s) => sum + normalizeToMonthly(s.amount, s.billing_cycle), 0);
        const yearly = active.reduce((sum, s) => sum + normalizeToYearly(s.amount, s.billing_cycle), 0);

        const upcoming = active
            .map((s) => ({
                ...formatDoc(s),
                daysUntil: daysUntil(s.next_billing_date),
                renewalLabel: renewalLabel(s.next_billing_date),
            }))
            .filter((s) => s.daysUntil !== null && s.daysUntil >= 0)
            .sort((a, b) => a.daysUntil - b.daysUntil)
            .slice(0, 10);

        const nextRenewal = upcoming[0] || null;

        const categoryBreakdown = {};
        active.forEach((s) => {
            const cat = s.category || 'other';
            categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + normalizeToMonthly(s.amount, s.billing_cycle);
        });

        const budgetDoc = await BudgetSettings.findOne({ user_id: req.user.id });
        const monthly_budget = budgetDoc?.monthly_budget || 0;

        res.json({
            totalActive: active.length,
            totalCancelled: cancelled.length,
            monthlySpend: monthly,
            yearlySpend: yearly,
            projectedYearly: yearly,
            nextRenewal,
            upcoming,
            categoryBreakdown,
            budget: {
                limit: monthly_budget,
                spent: monthly,
                remaining: monthly_budget - monthly,
                exceeded: monthly_budget > 0 && monthly > monthly_budget,
                percent: monthly_budget > 0 ? Math.min((monthly / monthly_budget) * 100, 100) : 0,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/trends', auth, async (req, res) => {
    try {
        const trends = await getTrends(req.user.id, 6);
        res.json(trends);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/insights', auth, async (req, res) => {
    try {
        const subs = await Subscription.find({ user_id: req.user.id });
        res.json(getInsights(subs.map(formatDoc)));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/sync', auth, async (req, res) => {
    try {
        const amount = await syncSpendingLog(req.user.id);
        res.json({ month: require('../utils/spendingLog').currentMonthKey(), amount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
