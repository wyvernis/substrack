const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    notes: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    billing_cycle: {
        type: String,
        enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
        default: 'monthly',
    },
    next_billing_date: { type: Date, required: true },
    trial_ends_at: { type: Date, default: null },
    category: {
        type: String,
        enum: ['entertainment', 'productivity', 'education', 'streaming', 'utilities', 'software', 'gaming', 'music', 'health', 'finance', 'other'],
        default: 'other',
    },
    tags: [{ type: String, trim: true }],
    status: {
        type: String,
        enum: ['active', 'cancelled', 'paused'],
        default: 'active',
    },
    last_used_at: { type: Date, default: null },
    invoice_url: { type: String, default: '' },
    currency: { type: String, default: 'INR', uppercase: true },
}, { timestamps: true });

subscriptionSchema.index({ user_id: 1, name: 1 });
subscriptionSchema.index({ user_id: 1, next_billing_date: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
