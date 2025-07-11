const User = require('../models/User'); // Adjust the path to your User model

/**
 * Generates a unique username by appending a number if the base username is taken.
 * @param {string} baseUsername - The base username to start with.
 * @returns {Promise<string>} - A unique username.
 */
const generateUniqueUsername = async (baseUsername) => {
    let username = baseUsername;
    let counter = 1;

    // Check if the username already exists in the database
    while (await User.findOne({ username: new RegExp(`^${username}$`, 'i') })) {
        username = `${baseUsername}${counter}`; // Append a number to the username
        counter++;
    }

    return username; // Return the unique username
};

module.exports = {
    generateUniqueUsername
};