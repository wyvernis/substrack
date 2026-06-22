const Subscription = require('../models/Subscription');
const SpendingLog = require('../models/SpendingLog');
const { normalizeToMonthly } = require('./currency');

const currentMonthKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const syncSpendingLog = async (userId) => {
    const subs = await Subscription.find({ user_id: userId, status: 'active' });
    const total = subs.reduce((sum, s) => sum + normalizeToMonthly(s.amount, s.billing_cycle), 0);
    const month = currentMonthKey();

    await SpendingLog.findOneAndUpdate(
        { user_id: userId, month },
        { amount: total },
        { upsert: true, new: true }
    );

    return total;
};

const getTrends = async (userId, months = 6) => {
    const keys = [];
    const d = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
        keys.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
    }

    const logs = await SpendingLog.find({ user_id: userId, month: { $in: keys } });
    const map = Object.fromEntries(logs.map((l) => [l.month, l.amount]));

    const current = await syncSpendingLog(userId);
    map[currentMonthKey()] = current;

    return keys.map((month) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        amount: map[month] || 0,
    }));
};

module.exports = { syncSpendingLog, getTrends, currentMonthKey };
