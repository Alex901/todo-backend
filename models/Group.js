const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: {
        type: [
            {
                member_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true
                },
                role: {
                    type: String,
                    default: 'edit',
                    enum: ['edit', 'observe', 'moderator']
                }
            }
        ],
        required: true
    },
    groupLists: {
        type: [{
            name: {
                type: String,
                required: true,
            },
            tags: {
                type: [
                    {
                        label: {
                            type: String,
                            required: true,
                        },
                        color: {
                            type: String,
                            default: '#FFFFFF', // Default color is white
                        },
                        textColor: {
                            type: String,
                            default: '#000000', // Default text color is black
                        },
                        uses: {
                            type: Number,
                            default: 0,
                        },
                    },
                ],
                default: [],
            },
            description: {
                type: String,
                default: '',
            },
        }],
    }
}, 
{
    collection: 'Groups',
    timestamps: true
});

const Group = mongoose.model('Group', groupSchema);

module.exports = mongoose.model('Group', groupSchema);