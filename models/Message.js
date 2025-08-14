const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true, // Sender is required
    },
    chat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat', // Reference to the Chat model
        required: true, // Chat is required
    },
    content: {
        type: String,
        required: true, // Message content is required
    },
}, {
    timestamps: true, // Automatically add createdAt and updatedAt fields
});

module.exports = mongoose.model('Message', messageSchema);