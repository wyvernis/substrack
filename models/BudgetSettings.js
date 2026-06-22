const mongoose = require('mongoose');

const budgetSettingsSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    monthly_budget: { type: Number, default: 0, min: 0 },
    alert_threshold: { type: Number, default: 80, min: 0, max: 100 },
}, { timestamps: true });

module.exports = mongoose.model('BudgetSettings', budgetSettingsSchema);
