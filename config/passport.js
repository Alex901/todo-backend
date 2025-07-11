const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User'); // Adjust the path to your User model

const callbackURL =
    process.env.NODE_ENV === 'production'
        ? 'https://api.habitforge.se/auth/login/google/callback'
        : 'http://localhost:5000/auth/login/google/callback';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL // Use the dynamically determined callback URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Fetch the email from the Google profile
        const email = profile.emails[0].value;

        console.log(`🔵 [DEBUG] Fetched email from Google profile: ${email}`);

        // Find the user in the database by email
        let user = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });

        if (!user) {
            console.log('🟡 [DEBUG] User not found, creating a new account...');

            // Create a new user if one doesn't exist
            user = new User({
                googleId: profile.id, // Save the Google ID for future logins
                username: profile.displayName,
                email,
                verified: true // Google verifies the email, so mark it as verified
            });

            await user.save();
            // console.log('🟢 [DEBUG] New user account created successfully.');
        } else {
            console.log('🟢 [DEBUG] User found in the database.');
            
            // If the user exists but doesn't have a Google ID, update it
            if (!user.googleId) {
                user.googleId = profile.id;
                await user.save();
                // console.log('🟢 [DEBUG] Google ID added to existing user.');
            }
        }
        console.log(`🟢 [DEBUG] User ID: ${user._id}`);
        // Pass the user object to the `done` callback
        return done(null, user);
    } catch (error) {
        console.error('🔴 [DEBUG] Error in Google Strategy:', error);
        return done(error, null);
    }
}));

// Serialize user for session (if using sessions)
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    });
});

module.exports = passport;