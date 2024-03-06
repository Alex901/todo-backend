const express = require('express');
const connectDB = require('./db');
const fs = require('fs');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const entriesRountes = require('./routes/entry');
const Todo = require('./models/Todo');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan'); //testing different loggers
const path = require('path');

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'logs', 'access.log'), { flags: 'a' });

const app = express();
const PORT = process.env.PORT || 5000;
const allowOrigins = [
    'https://tod0ify-app.netlify.app',
    'http://localhost:5173'
]
const consoleLogPath = path.join(__dirname, 'logs', 'console.log');
const errorLogPath = path.join(__dirname, 'logs', 'error.log');

// Connect to MongoDB
connectDB();

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
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.get('/', (req, res) => {
    res.send("server is running");
});

app.use('/api', entriesRountes);


// Define authentication routes
app.use('/auth', authRoutes);

// Define user routes
app.use('/users', userRoutes);

app.get('/', (req, res) => {
    res.send("server is running");
});

mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB cluster:', mongoose.connection.client.s.url);
    app.listen(PORT, () => console.log(`Server running on port: ${PORT}`))
})