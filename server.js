require('dotenv').config();

const express = require('express');
const connectDB = require('./db');
const fs = require('fs');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const entriesRoutes = require('./routes/entry');
const groupRoutes = require('./routes/group');
const notificationRoutes = require('./routes/notification');
const feedbackRoutes = require('./routes/feedback');
const settingsRountes = require('./routes/settings');
const User = require('./models/User');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan'); //testing different loggers
const path = require('path');
const cookieParser = require('cookie-parser');
const swaggerSetup = require('./swagger');
const scheduler = require('./utils/scheduler');
const rateLimeit = require('express-rate-limit')
const { initializeGlobalSettings } = require('./models/GlobalSettings');
const chatRoutes = require('./routes/chat');

const limiter = rateLimeit({
    windowMs: 5 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req, res) => {
        const ip = req.ip || req.connection.remoteAddress;
        return ip === '127.0.0.1' || ip === '::1'; // Skip rate limiting for localhost
    },
});

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'logs', 'access.log'), { flags: 'a' });

const app = express();
app.use(limiter); // Apply the rate limiting middleware to all requests
swaggerSetup(app);
const PORT = process.env.PORT || 5000;
const allowOrigins = [
    'todo-backend-gkdo.onrender.com',
    'https://the-task-forge.netlify.app',
    'http://localhost:5173',
    'http://localhost:5000',
    'http://localhost:3000',
    'https://habitforge.se',
    'https://api.habitforge.se',
    'https://accounts.google.com' // Allow Google OAuth origin
]



const corsOptions = {
    origin: function (origin, callback) {
        // console.log('[DEBUG] Incoming origin:', origin); // Log the origin
        if (!origin || allowOrigins.includes(origin) || origin.endsWith('.habitforge.se')) { //This allows all subdomains of habitforge.se
            callback(null, true)
        } else {
            console.log('\x1b[31m%s\x1b[0m', '[DEBUG] CORS rejected origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    allowedHeaders: ['User', 'Content-Type', 'Authorization'],
    credentials: true
};

//Not in use
const consoleLogPath = path.join(__dirname, 'logs', 'console.log');
const errorLogPath = path.join(__dirname, 'logs', 'error.log');

app.use(cors(corsOptions));

// Connect to MongoDB
connectDB(initializeGlobalSettings);

app.use(cookieParser());
app.use(morgan('dev'));
app.use(morgan('combined', { stream: accessLogStream }));
app.use(express.json());

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'User'],
    credentials: true
}));

app.get('/', (req, res) => {
    res.send("server is running");
});

app.use('/api', entriesRoutes);
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/groups', groupRoutes)
app.use('/notifications', notificationRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/settings', settingsRountes);
app.use('/chat', chatRoutes);

app.use((req, res, next) => {
    // console.log(`${req.method} ${req.url}`, req.body);
    next();
});

mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB cluster:', mongoose.connection.client.s.url);
    app.listen(PORT, () => console.log(`Server running on port: ${PORT}`))
})

module.exports = app;