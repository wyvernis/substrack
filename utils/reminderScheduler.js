const User = require('../models/User');
const Subscription = require('../models/Subscription');
const BudgetSettings = require('../models/BudgetSettings');
const { sendRenewalReminder, sendBudgetAlert, sendTrialReminder } = require('./email');
const { daysUntil, normalizeToMonthly } = require('./currency');

const checkReminders = async () => {
    const users = await User.find({});
    let sent = 0;

    for (const user of users) {
        const settings = user.settings?.reminders || {};
        if (!settings.emailEnabled) continue;

        const daysBefore = settings.daysBeforeRenewal ?? 3;
        const subs = await Subscription.find({ user_id: user._id, status: 'active' });

        for (const sub of subs) {
            const days = daysUntil(sub.next_billing_date);
            if (days !== null && days >= 0 && days <= daysBefore) {
                try {
                    await sendRenewalReminder(user.email, sub, days);
                    sent++;
                } catch (e) {
                    console.error('Renewal reminder failed:', e.message);
                }
            }

            if (settings.trialReminder && sub.trial_ends_at) {
                const trialDays = daysUntil(sub.trial_ends_at);
                if (trialDays !== null && trialDays >= 0 && trialDays <= 3) {
                    try {
                        await sendTrialReminder(user.email, sub, trialDays);
                        sent++;
                    } catch (e) {
                        console.error('Trial reminder failed:', e.message);
                    }
                }
            }
        }

        if (settings.budgetAlert) {
            const budgetDoc = await BudgetSettings.findOne({ user_id: user._id });
            const budget = budgetDoc?.monthly_budget || 0;
            if (budget > 0) {
                const spend = subs.reduce((s, sub) => s + normalizeToMonthly(sub.amount, sub.billing_cycle), 0);
                if (spend > budget) {
                    try {
                        await sendBudgetAlert(user.email, spend, budget, user.settings?.currency || 'INR');
                        sent++;
                    } catch (e) {
                        console.error('Budget alert failed:', e.message);
                    }
                }
            }
        }
    }

    return sent;
};

const startReminderScheduler = () => {
    const HOUR = 60 * 60 * 1000;
    setTimeout(() => checkReminders().catch(console.error), 10000);
    setInterval(() => checkReminders().catch(console.error), 24 * HOUR);
    console.log('✓ Reminder scheduler started (daily)');
};

module.exports = { checkReminders, startReminderScheduler };
