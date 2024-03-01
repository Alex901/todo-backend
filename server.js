const express = require('express');
const connectDB = require('./db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const entriesRountes = require('./routes/entry');
const Todo = require('./models/Todo');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const allowOrigins = [
    'https://tod0ify-app.netlify.app',
    'http://localhost:5173'
]

// Connect to MongoDB
connectDB();

// Parse JSON request body
app.use(express.json());
app.use(cors({
    origin: allowOrigins
}));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://main--tod0ify-app.netlify.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });

app.get('/', (req, res) => {
    res.send("server is running");
});

app.use('/api', entriesRountes);


/* // Define authentication routes
app.use('/auth', authRoutes);

// Define user routes
app.use('/user', userRoutes);

app.get('/', (req, res) => {
    res.send("server is running");
});
 */
mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB cluster:', mongoose.connection.client.s.url);
    app.listen(PORT, () => console.log(`Server running on port: ${PORT}`))
})