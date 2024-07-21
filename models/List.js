const mongoose = require('mongoose');
const User = require('./User');
const Group = require('./Group')

const listSchema = new mongoose.Schema({
    listName: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['userList', 'groupList'],
    },
    visibility: {
        type: String,
        required: true,
        enum: ['public', 'private'],
    },
    entries: {
        type: int, 
        required: true,
        default: 0,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tags: {
        type: [
            {
                label: {
                    type: String,
                    required: true
                },
                color: {
                    type: String,
                    required: true,
                    default: '#FFFFFF' // Default color is white
                },
                textColor: {
                    type: String,
                    required: true,
                    default: '#000000' // Default text color is black
                },
                usages: {
                    type: Number,
                    required: true,
                    default: 0
            }
        },
        ],
        default: []
    }

}, {
    timestamps: true,
    collection: 'Lists'
});

const List = mongoose.model('List', listSchema);

module.exports = List;