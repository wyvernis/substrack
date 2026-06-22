const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/substrack_db';

    mongoose.set('strictQuery', true);

    await mongoose.connect(uri);
    console.log('✓ MongoDB connected successfully');
};

module.exports = connectDB;
