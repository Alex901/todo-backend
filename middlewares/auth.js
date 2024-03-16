const jwt = require('jsonwebtoken');
const User = require('../models/User');


const authenticate = async (req, res, next) => {
  const token = req.cookies.token; // Get the token from the cookie

  if (token) {
    try {
      const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
      console.log('DEBUG: Decoded token: ', decodedToken);
      const user = await User.findById(decodedToken.userId);
      if (user) {
        console.log('DEBUG: User authenticated: ', user.username);
        req.user = user;
      } else {
        console.log('DEBUG: No user found with this ID');
      }
    } catch (error) {
      console.error('Invalid token', error);
    }
  } else {
    console.log('DEBUG: No token provided');
  }

  next();
};

module.exports = { authenticate };