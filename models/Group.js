const mongoose = require('mongoose');
const List = require('./List');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    visibility: {
        type: String,
        default: 'private',
        enum: ['private', 'public']
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

groupSchema.pre('save', async function (next) {
    // Lazy load User model to avoid circular dependency
    console.log('Group Model pre save -- updating lists for users in group');
    const User = require('./User');

    if (this.isModified('members')) {
        for (let member of this.members) {
            const user = await User.findById(member.member_id);
            if (user) {
                //console.log(user); 
                // Log the user to inspect its contents
                if (!user.groups.includes(this._id)) {
                    user.groups.push(this._id);
                }
                for (let list of this.groupListsModel) {
                    //console.log(list); // Log the list to inspect its contents
                    if (!user.myLists.includes(list._id ? list._id : list)) {
                        user.myLists.push(list._id ? list._id : list);
                    }
                }
                await user.save();
            }
        }
    }
    next();
});


groupSchema.pre('remove', async function (next) {
    const List = require('./List');
    await List.deleteMany({ owner: this._id });
    next();
});


const Group = mongoose.model('Group', groupSchema);

module.exports = Group;