const express = require('express');
const { authenticate } = require('../middlewares/auth');
const Feedback = require('../models/Feedback');

const router = express.Router();

module.exports = router;