const mongoose = require('mongoose');
const Todo = require('./Todo');

/**
 * @swagger
 * components:
 *   schemas:
 *     Group:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the group.
 *           example: "Study Group"
 *         visibility:
 *           type: string
 *           description: The visibility of the group.
 *           enum: [private, public]
 *           example: "private"
 *         description:
 *           type: string
 *           description: The description of the group.
 *           example: "A group for study sessions"
 *         owner:
 *           type: string
 *           description: The ID of the user who owns the group.
 *           example: "60d0fe4f5311236168a109ca"
 *         members:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               member_id:
 *                 type: string
 *                 description: The ID of the member.
 *                 example: "60d0fe4f5311236168a109cb"
 *               role:
 *                 type: string
 *                 description: The role of the member in the group.
 *                 enum: [edit, observer, moderator]
 *                 example: "edit"
 *         groupListsModel:
 *           type: array
 *           items:
 *             type: string
 *             description: The ID of the list.
 *             example: "60d0fe4f5311236168a109cc"
 *         groupLists:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the list.
 *                 example: "To-Do List"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     label:
 *                       type: string
 *                       description: The label of the tag.
 *                       example: "Urgent"
 *                     color:
 *                       type: string
 *                       description: The color of the tag.
 *                       example: "#FF0000"
 *                     textColor:
 *                       type: string
 *                       description: The text color of the tag.
 *                       example: "#FFFFFF"
 *                     uses:
 *                       type: number
 *                       description: The number of times the tag has been used.
 *                       example: 5
 *               description:
 *                 type: string
 *                 description: The description of the list.
 *                 example: "Tasks to be completed"
 */
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
        console.log('Group Model pre save -- members modified');
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

groupSchema.pre('findOneAndDelete', async function(next) {
    const groupId = this.getQuery()['_id'];

    try {
        // Fetch the entire group document
        const group = await this.model.findById(groupId).populate('groupListsModel');
        //console.log('DEBUG -- middleware: Group to delete: ', group);
        if (!group) {
            return next(new Error('Group not found'));
        }

        // Perform cleanup: Remove the group and its lists from all users' lists
        const listIds = group.groupListsModel.map(list => list._id);
        console.log('DEBUG -- middleware: Lists to delete: ', listIds);

        const User = require('./User'); // to avoid circular dependency
        const users = await User.find({ myLists: { $in: listIds } });

        for (const userRecord of users) {
            if (group.groupListsModel.some(list => {
                console.log('Checking list:', list.listName, 'against active list:', userRecord.activeList);
                const isMatch = list.listName === userRecord.activeList;
                console.log('Is match:', isMatch);
                return isMatch;
            })) {
                console.log('Match found, updating user list to "all":');
                userRecord.activeList = 'all';
                console.log('Updated userRecord.activeList:', userRecord.activeList);
                await userRecord.save();
            } else {
                console.log('No match found for active list:', userRecord.activeList);
            }
        }

        await User.updateMany(
            { myLists: { $in: listIds } },
            { $pull: { myLists: { $in: listIds } } }
        );

        // Remove Todos that are only in the lists being deleted
        await Todo.deleteMany({
            inListNew: { $in: listIds },
            $expr: { $eq: [{ $size: "$inListNew" }, 1] }
        });

        const List = require('./List'); // to avoid circular dependency
        await List.deleteMany({ _id: { $in: listIds } });

        next();
    } catch (error) {
        console.error('Error during cleanup: ', error);
        next(error);
    }
});


const Group = mongoose.model('Group', groupSchema);

module.exports = Group;