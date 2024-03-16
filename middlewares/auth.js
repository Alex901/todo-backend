const jwt = require('jsonwebtoken');
const User = require('../models/User');


const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('DEBUG: authHeader: ', authHeader);

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Extract the token from the Authorization header

    if (token !== 'undefined') {
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
      console.log('DEBUG: Token is undefined');
    }
  } else {
    console.log('DEBUG: No token provided');
  }

  next();
};

module.exports = { authenticate };