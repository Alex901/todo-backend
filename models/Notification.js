const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    response: {
        type: String,
        default: '',
        enum: ['', 'accepted', 'declined']
    },

}, {
    timestamps: true,
    collation: 'Notifications'
});

const Notification = mongoose.model('Notification', notificationSchema);