const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        let dbName;

        switch (process.env.NODE_ENV) {
            case 'development':
                dbName = 'todoDatabase';
                break;
            case 'production':
                dbName = 'habitForge';
                break;
            case 'test':
                dbName = 'habitForgeTest';
                break;
            default:
                throw new Error('Unknown NODE_ENV value');
        }

        await mongoose.connect(process.env.DATABASE_URI, { dbName });

        console.log('Successfully connected to MongoDB');
    } catch (error) {
        console.log('Error connecting to MongoDB:', error);
    }
};

module.exports = connectDB;