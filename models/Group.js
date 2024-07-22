const mongoose = require('mongoose');
const User = require('./User');

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
                    enum: ['edit', 'observer', 'moderator'] // edit: standard and can interact with lists, observe: read-only, moderator: can add/remove members and create and remove lists
                }
            }
        ],
        required: true
    },
    groupListsModel: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'List'
        }
    ],
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

groupSchema.pre('save', async function(next) { // Notice: need to wait for add user implementation for further testing, but it looks like it works as intended
    
    if (this.isModified('members')) {
        for (let member of this.members) {
            const user = await User.findById(member.member_id);
            if (user) {
                if (!user.groups.includes(this._id)) {
                    user.groups.push(this._id);
                }
                for(let list of this.groupLists) { //TODO: change this part to get correct reference
                    if(!user.listNames.includes(list)) {
                        user.listNames.push(list);
                    }
                }
                await user.save();
            }
        }
    }
    next();
});


const Group = mongoose.model('Group', groupSchema);

module.exports = Group;