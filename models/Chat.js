const mongoose = require('mongoose');
// Thumbnail, image, background, settings? 
const chatSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true, // Chat name is required
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to User model
        required: true, // Creator is required
    },
    type: {
        type: String,
        enum: ['group', 'normal', 'open'], // Can be 'group' or 'normal'
        default: 'normal', // Default to 'normal'
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to User model
    }],
    messages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message', // Reference to Message model
    }],
    lastRead: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Reference to User model
        },
        timestamp: {
            type: Date,
            default: Date.now, // Default to the current time
        },
    }],
    isOpen: {
        type: Boolean,
        default: false, // Default to false
    },
    isPrivate: {
        type: Boolean,
        default: false, // Default to false for future use
    },
}, {
    timestamps: true, // Automatically add createdAt and updatedAt fields
});

// Middleware to automatically set chat type to 'group' if participants > 2
chatSchema.pre('save', function (next) {
    if (this.participants.length > 2) {
        this.type = 'group';
    }
    next();
});

// Ensure messages are always sorted by newest on top
chatSchema.pre('save', function (next) {
    this.messages.sort((a, b) => b.createdAt - a.createdAt); // Assuming Message model has a createdAt field
    next();
});

module.exports = mongoose.model('Chat', chatSchema);