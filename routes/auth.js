const express = require('express');
const { register, login } = require('../controllers/auth');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { error } = require('winston');
const jwt = require('jsonwebtoken');
const router = express.Router();


require('dotenv').config();

router.post('/register', register);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: User login
 *     description: Authenticates a user and returns a JWT token.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john_doe"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: User authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User authenticated"
 *       204:
 *         description: No Content - Username or password is null
 *       400:
 *         description: Invalid login credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid login credentials"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.post('/login', async (req, res) => {
    // console.log("req body ", req.body);

    try {
        //Check if the username or password is null
        if (!req.body.username || !req.body.password) {
            return res.status(204).send();
        }

        let queryField;
        if (req.body.username.includes("@")) {
            // console.log("email");
            queryField = { email: new RegExp(`^${req.body.username.trim()}$`, 'i') };
        } else {
            queryField = { username: req.body.username };
        }

        // Check if the user exists
        const user = await User.findOne(queryField);
        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }

        if (!user.verified) {
            return res.status(403).send({ error: 'Please verify you e-mail before logging in. \n Check your inbox for the verification e-mail.' });
        }

        // Authenticate the user
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            // console.log(error.toString);
            return res.status(400).send({ error: 'Invalid login credentials' });
        } else {
            // console.log("User authenticated, creating token: !")
            const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY);
            // console.log("Token: ", token);
            res.cookie('token', token, {
                sameSite: 'Strict',
                secure: true,
                httpOnly: true
            });
            res.status(200).send({ message: 'User authenticated' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).send({ error: error.toString() });
    }
});

/**
 * @swagger
 * /logout:
 *   post:
 *     summary: User logout
 *     description: Logs out a user by clearing the authentication token cookie.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: User logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User logged out"
 */
router.post('/logout', (req, res) => {
    res.clearCookie('token', { path: '/', secure: true, sameSite: 'none' });
    res.status(200).send({ message: 'User logged out' });
});

/**
 * @swagger
 * /checkLogin:
 *   get:
 *     summary: Check user login status
 *     description: Verifies if the user is logged in by checking the authentication token.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Login status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "60d0fe4f5311236168a109ca"
 *                     username:
 *                       type: string
 *                       example: "john_doe"
 *                     myLists:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "60d0fe4f5311236168a109ca"
 *                           title:
 *                             type: string
 *                             example: "Shopping List"
 *                           owner:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                                 example: "60d0fe4f5311236168a109ca"
 *                               username:
 *                                 type: string
 *                                 example: "john_doe"
 *                     groups:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "60d0fe4f5311236168a109ca"
 *                           name:
 *                             type: string
 *                             example: "Work Group"
 */
router.get('/checkLogin', async (req, res) => {
    const token = req.cookies.token;

    // If there's no token, the user is not logged in
    if (!token) {
        return res.json({ valid: false });
    }
    // Verify the token
    jwt.verify(token, process.env.SECRET_KEY, async (err, decoded) => {
        if (err) {
            return res.json({ valid: false });
        }



        // Fetch the user from the database
        try {
            const user = await User.findById(decoded.userId)
                .populate({
                    path: 'myLists',
                    populate: { path: 'owner' }
                })
                .populate({
                    path: 'groups',
                    populate: {
                        path: 'members.member_id',
                        model: 'User' 
                    }
                });
            if (!user) {
                return res.json({ valid: false });
            }

            return res.json({ valid: true, user });
        } catch (err) {
            // console.error(err);
            return res.json({ valid: false });
        }
    });
});


/**
 * @swagger
 * /auth/activate/{token}:
 *   get:
 *     summary: Activate user account
 *     description: Activate a user account using the activation token.
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Activation token
 *     responses:
 *       200:
 *         description: Redirect to the appropriate URL based on the environment
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html>...</html>"
 *       400:
 *         description: Invalid or expired activation link
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid or expired activation link"
 *       500:
 *         description: Activation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Activation failed"
 */
router.get('/activate/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Find the user by the activation token
        const user = await User.findOne({
            activationToken: token,
        });

        // Check if the token is valid and not expired
        if (!user || user.activationTokenExpires < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired activation link' });
        }

        // Activate the user
        user.verified = true;
        user.activationToken = undefined;
        user.__v = 1;
        await user.save();

        const redirectUrl = process.env.NODE_ENV === 'production'
            ? 'https://www.habitforge.se'
            : 'http://localhost:5173';

        res.redirect(redirectUrl);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Activation failed' });
    }
});


module.exports = router;