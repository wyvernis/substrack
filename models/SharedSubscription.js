const mongoose = require('mongoose');

const sharedSubscriptionSchema = new mongoose.Schema({
    subscription_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    shared_with_email: { type: String, required: true, lowercase: true, trim: true },
    share_percentage: { type: Number, required: true, min: 1, max: 100 },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
}, { timestamps: true });

module.exports = mongoose.model('SharedSubscription', sharedSubscriptionSchema);
