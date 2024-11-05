const mongoose = require('mongoose');

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
listSchema.pre('validate', function (next) {
    if (this.type === 'userList') {
        this.ownerModel = 'User';
    } else if (this.type === 'groupList') {
        this.ownerModel = 'Group';
    }
    next();
});

listSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    const list = this;
    const listId = list._id;
    console.log("DEBUG -- list being deleted: ", list);
    console.log("DEBUG -- listId: ", listId.toString());

    try {
        const Todo = require('./Todo');
        const User = require('./User');
        const Group = require('./Group');

        if (list.ownerModel === 'User') {
            // console.log("DEBUG -- User list cleanup");
            // User list cleanup
            const user = await User.findById(list.owner).populate('myLists');
            if (!user) {
                throw new Error(`User with ID ${list.owner} not found`);
            }

            // Check if the user's active list is the one being deleted
            if (user.activeList === list.listName) {
                user.activeList = user.myLists[0].listName || 'all';
                // console.log("DEBUG -- User's active list updated to 'all'");
            }

            // Remove the list from user's myLists
            user.myLists = user.myLists.filter(id => id._id.toString() !== listId.toString());
            await user.save();

            // Find and update todos
            const todos = await Todo.find({ owner: user._id });
            // console.log("DEBUG -- todos found: ", todos);
            for (const todo of todos) {
                if (todo.inListNew.includes(listId)) {
                    if (todo.inListNew.length === 2) {
                        // If it's the only reference, delete the todo
                        await todo.deleteOne();
                    } else {
                        // Otherwise, just remove the reference
                        todo.inListNew = todo.inListNew.filter(id => id.toString() !== listId.toString());
                        await todo.save();
                    }
                }
            }
        } else if (list.ownerModel === 'Group') {
            // Group list cleanup
            const group = await Group.findById(list.owner);
            if (!group) {
                throw new Error(`Group with ID ${list.owner} not found`);
            }



            // Remove the list from group's groupListsModel
            group.groupListsModel = group.groupListsModel.filter(id => id.toString() !== listId.toString());
            await group.save();

            // Remove the list from each member's myLists
            for (const member of group.members) {
                const user = await User.findById(member.member_id);
                if (!user) {
                    console.warn(`User with ID ${member.member_id} not found`);
                    continue;
                } else {
                    if (user.activeList === list.listName) {
                        user.activeList = user.myLists[0].listName || 'all';
                    }
                    user.myLists = user.myLists.filter(id => id._id.toString() !== listId.toString());
                    await user.save();
                }

                // Find and update todos
                const todos = await Todo.find({ owner: group._id });
                for (const todo of todos) {
                    if (todo.inListNew.includes(listId)) {
                        if (todo.inListNew.length === 1) {
                            // If it's the only reference, delete the todo
                            await todo.deleteOne();
                        } else {
                            // Otherwise, just remove the reference
                            todo.inListNew = todo.inListNew.filter(id => id.toString() !== listId.toString());
                            await todo.save();
                        }
                    }
                }
            }
        }
        next();
    } catch (error) {
        console.error('Error during list cleanup:', error);
        next(error);
    }
});


const List = mongoose.model('List', listSchema);

module.exports = List;