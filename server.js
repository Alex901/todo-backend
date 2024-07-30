require('dotenv').config();

const express = require('express');
const connectDB = require('./db');
const fs = require('fs');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const entriesRoutes = require('./routes/entry');
const groupRoutes = require('./routes/group');
const notificationRoutes = require('./routes/notification');
const Todo = require('./models/Todo');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan'); //testing different loggers
const path = require('path');
const cookieParser = require('cookie-parser');
const swaggerSetup = require('./swagger');


const accessLogStream = fs.createWriteStream(path.join(__dirname, 'logs', 'access.log'), { flags: 'a' });

const app = express();
swaggerSetup(app);
const PORT = process.env.PORT || 5000;
const allowOrigins = [
    'https://the-task-forge.netlify.app',
    'http://localhost:5173'
]
const consoleLogPath = path.join(__dirname, 'logs', 'console.log');
const errorLogPath = path.join(__dirname, 'logs', 'error.log');
const corsOptions = {
    origin: function (origin, callback) {
        if (allowOrigins.indexOf(origin) !== -1 || !origin) {
          callback(null, true)
        } else {
          callback(new Error('Not allowed by CORS'))
        }
      },
    allowedHeaders: ['User', 'Content-Type'],
    credentials: true
  };
  
app.use(cors(corsOptions));

// Connect to MongoDB
connectDB();

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
    allowedHeaders: ['Content-Type', 'Authorization'],
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

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`, req.body);
    next();
});

mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB cluster:', mongoose.connection.client.s.url);
    app.listen(PORT, () => console.log(`Server running on port: ${PORT}`))
})

module.exports = app;