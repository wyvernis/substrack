const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    settings: {
        currency: { type: String, default: 'INR', uppercase: true },
        darkMode: { type: Boolean, default: false },
        reminders: {
            emailEnabled: { type: Boolean, default: true },
            browserEnabled: { type: Boolean, default: true },
            daysBeforeRenewal: { type: Number, default: 3 },
            trialReminder: { type: Boolean, default: true },
            budgetAlert: { type: Boolean, default: true },
        },
        timezone: { type: String, default: 'Asia/Kolkata' },
    },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
