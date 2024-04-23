const mongoose = require('mongoose');
const User = require('./User');
const Group = require('./Group')

const listSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

}, {
    timestamps: true,
    collection: 'Lists'
});