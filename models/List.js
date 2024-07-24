const mongoose = require('mongoose');
const User = require('./User');
const Group = require('./Group')

const listSchema = new mongoose.Schema({
    listName: { //Name of the list
        type: String,
        required: true
    },
    description: { //List description
        type: String,
        default: ''
    },
    type: {  //Is it at group List or a user created list
        type: String,
        required: true,
        enum: ['userList', 'groupList'],
        default: 'userList',
    },
    visibility: { //Is the list public or private
        type: String,
        required: true,
        enum: ['public', 'private'],
        default: 'private',
    },
    entries: { //List entries
        type: Number, 
        required: true,
        default: 0,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'ownerModel'
    },
    ownerModel: {
        type: String,
        required: true,
        enum: ['User', 'Group'], 
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
                    default: '#FFFFFF' // Default color is white
                },
                textColor: {
                    type: String,
                    default: '#000000' // Default text color is black
                },
                uses: {
                    type: Number,
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

// Pre-save middleware to set ownerModel based on type
listSchema.pre('validate', function(next) {
    if (this.type === 'userList') {
        this.ownerModel = 'User';
    } else if (this.type === 'groupList') {
        this.ownerModel = 'Group';
    }
    next();
});

const List = mongoose.model('List', listSchema);

module.exports = List;