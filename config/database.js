const mongoose = require('mongoose');
require('dotenv').config();

let connectPromise = null;

const connectDB = async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/substrack_db';

    mongoose.set('strictQuery', true);
    mongoose.set('bufferCommands', false);

    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (connectPromise) {
        return connectPromise;
    }

    connectPromise = mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
    });

    try {
        await connectPromise;
        console.log('✓ MongoDB connected successfully');
        return mongoose.connection;
    } catch (err) {
        console.error('✗ MongoDB connection failed:', err.message);
        throw err;
    } finally {
        connectPromise = null;
    }
};

module.exports = connectDB;
