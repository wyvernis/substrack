const CURRENCIES = {
    INR: { symbol: '₹', locale: 'en-IN', name: 'Indian Rupee' },
    USD: { symbol: '$', locale: 'en-US', name: 'US Dollar' },
    EUR: { symbol: '€', locale: 'de-DE', name: 'Euro' },
    GBP: { symbol: '£', locale: 'en-GB', name: 'British Pound' },
    JPY: { symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen' },
    AUD: { symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar' },
    CAD: { symbol: 'C$', locale: 'en-CA', name: 'Canadian Dollar' },
    SGD: { symbol: 'S$', locale: 'en-SG', name: 'Singapore Dollar' },
};

const formatAmount = (amount, currency = 'INR') => {
    const cfg = CURRENCIES[currency] || CURRENCIES.INR;
    return new Intl.NumberFormat(cfg.locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: currency === 'JPY' ? 0 : 2,
        maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount || 0);
};

const normalizeToMonthly = (amount, cycle) => {
    const a = parseFloat(amount) || 0;
    switch (cycle) {
        case 'weekly': return a * 4.33;
        case 'yearly': return a / 12;
        case 'quarterly': return a / 3;
        default: return a;
    }
};

const normalizeToYearly = (amount, cycle) => normalizeToMonthly(amount, cycle) * 12;

const daysUntil = (date) => {
    if (!date) return null;
    const target = new Date(date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
};

const renewalLabel = (date) => {
    const days = daysUntil(date);
    if (days === null) return '—';
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Renews today';
    if (days === 1) return 'Renews tomorrow';
    return `Renews in ${days} days`;
};

module.exports = {
    CURRENCIES,
    formatAmount,
    normalizeToMonthly,
    normalizeToYearly,
    daysUntil,
    renewalLabel,
};
