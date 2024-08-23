const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        default: ''
    },
    response: {
        type: String,
        default: '',
        enum: ['', 'accepted', 'declined']
    },
    type: {
        type: String,
        required: true,
        enum: ['friend', 'group', 'message', 'feedback', 'other']
    },
    subType: {
        type: String,
        enum: ['bug', 'performance', 'feature', 'review', 'issues', 'payment', 'other'],
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: function() {
            return this.type === 'group';
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 60 * 60 * 24 * 30 // This document will be removed 7 days after it's created
    },
    count: {
        type: Number,
        default: 1
    }

}, {
    timestamps: true,
    collection: 'Notifications'
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;