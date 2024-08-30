const jwt = require('jsonwebtoken');

//For later use
const generateToken = (req, res, next) => {
  const user = req.user; 

  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: '24h' });
  req.token = token; // Attach the token to the request object

  next(); // Proceed to the next middleware or route handler
};

module.exports = generateToken;