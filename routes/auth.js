const express = require('express');
const { register, login } = require('../controllers/auth');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { error } = require('winston');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/register', register);


router.post('/login', async(req, res) => {
   // console.log("req body ", req.body);
    try{
        //Check if the username or password is null
        if (!req.body.username || !req.body.password) {
            return res.status(204).send();
        }

        // Check if the user exists
        const user = await User.findOne({ username: req.body.username });
        if (!user) {
            console.log('User not found');
            return res.status(404).send({ error: 'User not found' });
        }

        // Authenticate the user
        console.log('Password: ', req.body.password, "  ", user.password);
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        console.log('isMatch: ', isMatch);
        if (!isMatch) {
            console.log(error.toString);
            return res.status(400).send({ error: 'Invalid login credentials' });
        } else {
            const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY);
            res.cookie('token', token, { sameSite: 'None', secure: true, httpOnly: true});
            res.status(200).send({ message: 'User authenticated' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).send({ error: error.toString() });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token', { path: '/', secure: true, sameSite: 'none' });
    res.status(200).send({ message: 'User logged out' });
});

router.get('/checkLogin', async (req, res) => {
    const token = req.cookies.token;

    // If there's no token, the user is not logged in
    if (!token) {
        return res.json({ valid: false });
    }
    // Verify the token
    jwt.verify(token, process.env.SECRET_KEY, async (err, decoded) => {
        console.log('Decoded user: ', decoded.userId);
        if (err) {
            return res.json({ valid: false });
        }

    

        // Fetch the user from the database
        try {
            const user = await User.findById(decoded.userId); 
            if (!user) {
                return res.json({ valid: false });
            }

            return res.json({ valid: true, user });
        } catch (err) {
            console.error(err);
            return res.json({ valid: false });
        }
    });
});


module.exports = router;