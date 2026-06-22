const mongoose = require('mongoose');

const spendingLogSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    month: { type: String, required: true },
    amount: { type: Number, default: 0 },
}, { timestamps: true });

spendingLogSchema.index({ user_id: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('SpendingLog', spendingLogSchema);
