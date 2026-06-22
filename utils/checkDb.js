const mongoose = require('mongoose');
const connectDB = require('../config/database');

const checkDatabase = async () => {
    if (mongoose.connection.readyState === 1) {
        return;
    }
    await connectDB();
};

module.exports = checkDatabase;
