const { normalizeToMonthly } = require('./currency');

const CHEAPER_ALTERNATIVES = {
    netflix: { alt: 'Amazon Prime Video', note: 'Lower cost with bundled shipping benefits' },
    spotify: { alt: 'YouTube Music / JioSaavn', note: 'Regional plans often cheaper in India' },
    adobe: { alt: 'Affinity / Canva Pro', note: 'One-time or lower monthly creative tools' },
    microsoft: { alt: 'Google Workspace / LibreOffice', note: 'Free or lower-cost productivity suites' },
    dropbox: { alt: 'Google Drive / iCloud', note: 'Often included with phone plans' },
    gym: { alt: 'Home workout apps', note: 'Peloton Digital, Nike Training Club' },
};

const getInsights = (subscriptions) => {
    const active = subscriptions.filter((s) => s.status === 'active');
    const suggestions = [];
    const duplicates = [];
    const unused = [];
    const seen = {};

    active.forEach((sub) => {
        const key = sub.name.toLowerCase().trim().replace(/\s+/g, ' ');
        if (seen[key]) {
            duplicates.push({ name: sub.name, ids: [seen[key], sub.id || sub._id] });
        } else {
            seen[key] = sub.id || sub._id?.toString();
        }

        const lastUsed = sub.last_used_at ? new Date(sub.last_used_at) : null;
        const daysSinceUse = lastUsed
            ? Math.floor((Date.now() - lastUsed) / (1000 * 60 * 60 * 24))
            : Math.floor((Date.now() - new Date(sub.createdAt)) / (1000 * 60 * 60 * 24));

        if (!lastUsed && daysSinceUse > 30) {
            unused.push({ ...sub, daysSinceUse, reason: 'Never marked as used' });
        } else if (lastUsed && daysSinceUse > 30) {
            unused.push({ ...sub, daysSinceUse, reason: `Not used in ${daysSinceUse} days` });
        }

        const monthly = normalizeToMonthly(sub.amount, sub.billing_cycle);
        if (monthly > 500 && daysSinceUse > 14) {
            suggestions.push({
                type: 'cancel',
                subscription: sub.name,
                id: sub.id || sub._id,
                monthly,
                reason: 'High cost with low recent usage — consider cancelling',
                estimatedSavings: normalizeToMonthly(sub.amount, sub.billing_cycle) * 12,
            });
        }

        Object.keys(CHEAPER_ALTERNATIVES).forEach((keyword) => {
            if (key.includes(keyword)) {
                const alt = CHEAPER_ALTERNATIVES[keyword];
                suggestions.push({
                    type: 'alternative',
                    subscription: sub.name,
                    id: sub.id || sub._id,
                    alternative: alt.alt,
                    reason: alt.note,
                });
            }
        });
    });

    duplicates.forEach((d) => {
        suggestions.push({
            type: 'duplicate',
            subscription: d.name,
            reason: 'Possible duplicate subscription detected',
        });
    });

    const totalSavings = suggestions
        .filter((s) => s.type === 'cancel')
        .reduce((sum, s) => sum + (s.estimatedSavings || 0), 0);

    return {
        suggestions,
        duplicates,
        unused,
        totalPotentialSavings: totalSavings,
        expensive: [...active]
            .sort((a, b) => normalizeToMonthly(b.amount, b.billing_cycle) - normalizeToMonthly(a.amount, a.billing_cycle))
            .slice(0, 5)
            .map((s) => ({
                name: s.name,
                monthly: normalizeToMonthly(s.amount, s.billing_cycle),
                id: s.id || s._id,
            })),
    };
};

module.exports = { getInsights, CHEAPER_ALTERNATIVES };
