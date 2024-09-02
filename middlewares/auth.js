const jwt = require('jsonwebtoken');
const User = require('../models/User');


const authenticate = async (req, res, next) => {
 // console.log("DEBUG: auth header", req)
  const token = req.cookies.token; // Get the token from the cookie
 // console.log('Token: ', token);

  if (token) {
    try {
      console.log('Token found, processing..')
      const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
     // console.log('Decoded token: ', decodedToken);
      const user = await User.findById(decodedToken.userId);
      if (user) {
        req.user = user;
      //  console.log('User found in auth: ', user);
      } else {
        console.error('User not found');
      }
    } catch (error) {
      console.error('Invalid token', error);
    }
  } else {
    console.error('No token found');
  }

  next();
};

module.exports = { authenticate };