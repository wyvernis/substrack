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

const Currency = {
  code: 'INR',

  list() {
    return Object.entries(CURRENCIES).map(([code, c]) => ({ code, ...c }));
  },

  format(amount, code) {
    const currency = code || App.settings?.currency || this.code || 'INR';
    const cfg = CURRENCIES[currency] || CURRENCIES.INR;
    return new Intl.NumberFormat(cfg.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount || 0);
  },

  setCode(code) {
    this.code = code || 'INR';
  },
};
