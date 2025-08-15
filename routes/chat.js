const express = require('express');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

const router = express.Router();




module.exports = router;