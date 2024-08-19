const express = require('express');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');
const Group = require('../models/Group');
const List = require('../models/List');

const router = express.Router();

/**
 * @swagger
 * /group/create:
 *   post:
 *     summary: Create a new group
 *     description: Creates a new group and an associated list with the group's ID as the owner.
 *     tags:
 *       - Group
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Group'
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.post('/create', authenticate, async (req, res) => {
    try {
        const groupData = req.body;

        // Create a new group
        const newGroup = new Group(groupData);


        // Save the new group to get its _id
        const savedGroup = await newGroup.save();

        // Create a new list with the group's _id as the owner
        const newList = new List({
            listName: req.body.listName,
            description: "",
            type: "groupList",
            visibility: "private",
            owner: savedGroup._id,
            ownerModel: "Group",
            tags: []
        });

        // Save the new list
        const savedList = await newList.save();

        newGroup.members.push({ member_id: groupData.owner, role: "moderator" });
        // Update the group with the list's _id
        savedGroup.groupListsModel.push(savedList._id);
        await savedGroup.save();

        res.status(201).json(savedGroup);
    } catch (error) {
        console.error('Error creating group', error);
        res.status(500).send('Internal server error');
    }
});

/**
 * @swagger
 * /group/getGroups/{userId}:
 *   get:
 *     summary: Get groups for a user
 *     description: Fetches all groups that a user is a member of.
 *     tags:
 *       - Group
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     responses:
 *       200:
 *         description: A list of groups
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: "60d0fe4f5311236168a109ca"
 *                   name:
 *                     type: string
 *                     example: "Study Group"
 *                   owner:
 *                     type: string
 *                     example: "60d0fe4f5311236168a109ca"
 *                   groupListsModel:
 *                     type: array
 *                     items:
 *                       type: string
 *                       example: "60d0fe4f5311236168a109ca"
 *                   members:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         member_id:
 *                           type: string
 *                           example: "60d0fe4f5311236168a109ca"
 *                         role:
 *                           type: string
 *                           example: "member"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/getGroups/:userId', authenticate, async (req, res) => {
    try {
        const userId = req.params.userId;
        const groups = await Group.find({ 'members.member_id': userId }).populate("groupListsModel");
        res.status(200).json(groups);
    } catch (error) {
        console.error('Error fetching groups', error);
        res.status(500).send('Internal server error');
    }
});

/**
 * @swagger
 * /group/addUser/{groupId}:
 *   put:
 *     summary: Add a user to a group
 *     description: Adds a user to a specified group.
 *     tags:
 *       - Group
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the group
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: "60d0fe4f5311236168a109ca"
 *     responses:
 *       200:
 *         description: User added to group
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "User added to group"
 *       400:
 *         description: User is already a member of the group
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "User is already a member of the group"
 *       404:
 *         description: Group not found
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Group not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.put('/addUser/:groupId', authenticate, async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const user = req.body.user;
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).send('Group not found');
        }

        // Check if user is already a member
        const isMember = group.members.some(member => member.member_id.toString() === user._id);
        if (isMember) {
            return res.status(400).send('User is already a member of the group');
        }

        group.members.push({ member_id: user, role: 'edit' });
        await group.save();

        res.status(200).send('User added to group');
    } catch (error) {
        console.error('Error adding user to group', error);
        res.status(500).send('Internal server error');
    }
});

/**
 * @swagger
 * /fetchAllGroups:
 *   get:
 *     summary: Fetch all groups
 *     description: Retrieves all groups with their owners and members' emails.
 *     tags:
 *       - Group
 *     responses:
 *       200:
 *         description: A list of groups
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: The ID of the group.
 *                   name:
 *                     type: string
 *                     description: The name of the group.
 *                   description:
 *                     type: string
 *                     description: The description of the group.
 *                   visibility:
 *                     type: string
 *                     description: The visibility of the group.
 *                     enum: [private, public]
 *                   owner:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: The ID of the owner.
 *                       name:
 *                         type: string
 *                         description: The name of the owner.
 *                   members:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         member_id:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                               description: The ID of the member.
 *                             email:
 *                               type: string
 *                               description: The email of the member.
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/fetchAllGroups', async (req, res) => {
    try {
        const groups = await Group.find().populate("owner").populate({
            path: 'members.member_id',
            select: 'email'
        });
        res.status(200).send(groups);
    } catch (error) {
        console.error('Error fetching all groups: ', error);
        if (error.stack) {
            console.error(error.stack);
        }
        res.status(500).send({ message: 'Internal server error' });
    }
});


/**
 * @swagger
 * /updateGroupInfo/{id}:
 *   put:
 *     summary: Update group information
 *     description: Updates the information of a group by its ID.
 *     tags:
 *       - Group
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the group to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the group.
 *                 example: "New Group Name"
 *               description:
 *                 type: string
 *                 description: The description of the group.
 *                 example: "Updated Description"
 *               visibility:
 *                 type: string
 *                 description: The visibility of the group.
 *                 enum: [private, public]
 *                 example: "public"
 *     responses:
 *       200:
 *         description: Group updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: The ID of the group.
 *                 name:
 *                   type: string
 *                   description: The name of the group.
 *                 description:
 *                   type: string
 *                   description: The description of the group.
 *                 visibility:
 *                   type: string
 *                   description: The visibility of the group.
 *                   enum: [private, public]
 *       404:
 *         description: Group not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Group not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.put('/updateGroupInfo/:id', async (req, res) => {
    const groupId = req.params.id;
    const { name, description, visibility } = req.body;

    try {
        const updatedGroup = await Group.findByIdAndUpdate(
            groupId,
            { name, description, visibility },
            { new: true, runValidators: true }
        );

        if (!updatedGroup) {
            return res.status(404).send({ message: 'Group not found' });
        }

        res.status(200).send(updatedGroup);
    } catch (error) {
        console.error('Error updating group: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /groups/removeMember/{groupId}:
 *   put:
 *     summary: Remove a member from a group or allow a member to leave a group
 *     tags: [Group]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the group
 *       - in: body
 *         name: user
 *         description: The user ID of the member to be removed or who wants to leave
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - userId
 *               properties:
 *                 userId:
 *                   type: string
 *                   description: The ID of the user
 *     responses:
 *       200:
 *         description: Left group successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Left group successfully"
 *       404:
 *         description: Group or user not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Group not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.put('/removeMember/:groupId', async (req, res) => {
    const groupId = req.params.groupId;
    const { userId } = req.body;

    try {
        // Find the group and remove the member
        const group = await Group.findById(groupId).populate('groupListsModel');
        if (!group) {
            return res.status(404).send({ message: 'Group not found' });
        }

        group.members = group.members.filter(member => member.member_id.toString() !== userId);
        await group.save();

        // Find the user and remove the lists from the group
        const userRecord = await User.findById(userId);
        if (!userRecord) {
            return res.status(404).send({ message: 'User not found' });
        }

        if (Array.isArray(userRecord.myLists) && Array.isArray(group.groupListsModel)) {
            userRecord.myLists = userRecord.myLists.filter(list => {
                return !group.groupListsModel.some(groupList => {
                    //console.log('Comparing:', { groupList: groupList._id.toString(), list: list.toString() });
                    return groupList._id.toString() === list.toString();
                });
            });

            if (group.groupListsModel.some(list => {
                console.log('Checking list:', list.listName, 'against active list:', userRecord.activeList);
                const isMatch = list.listName === userRecord.activeList;
                console.log('Is match:', isMatch);
                return isMatch;
            })) {
                console.log('Match found, updating user list to "all":');
                userRecord.activeList = 'all';
                console.log('Updated userRecord.activeList:', userRecord.activeList);
            } else {
                console.log('No match found for active list:', userRecord.activeList);
            }
        }


        await userRecord.save();

        res.status(200).send({ message: 'Left group successfully' });
    } catch (error) {
        console.error('Error leaving group: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /groups/updateRole/{groupId}:
 *   put:
 *     summary: Update the role of a member in a group
 *     tags: [Group]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the group
 *       - in: body
 *         name: member
 *         description: The member ID and new role
 *         schema:
 *           type: object
 *           required:
 *             - memberId
 *             - role
 *           properties:
 *             memberId:
 *               type: string
 *               description: The ID of the member
 *             role:
 *               type: string
 *               description: The new role of the member
 *               enum: [edit, observer, moderator]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       404:
 *         description: Group or user not found
 *       500:
 *         description: Internal server error
 */
router.put('/updateRole/:groupId', async (req, res) => {
    const { groupId } = req.params;
    const { memberId, role } = req.body;

    try {
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).send({ message: 'Group not found' });
        }

        const member = group.members.find(member => member.member_id.toString() === memberId);
        if (!member) {
            return res.status(404).send({ message: 'Member not found in group' });
        }

        member.role = role;
        await group.save();

        res.status(200).send({ message: 'Role updated successfully' });
    } catch (error) {
        console.error('Error updating role: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /deleteGroup/{groupId}:
 *   delete:
 *     summary: Delete a group by ID
 *     tags: [Group]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the group to delete
 *     responses:
 *       200:
 *         description: Group deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Group deleted successfully
 *       404:
 *         description: Group not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Group not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */
router.delete('/deleteGroup/:groupId', async (req, res) => {
    const groupId = req.params.groupId;

    try {
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).send({ message: 'Group not found' });
        }

        await Group.findByIdAndDelete(groupId);

        res.status(200).send({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Error deleting group: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

router.post('/createGroupList/:groupId', async (req, res) => {
    const groupId = req.params.groupId;
    console.log('Creating group list for group:', groupId);
    const { listName, description, visibility } = req.body;

    try {
        // Fetch the group and populate members
        const group = await Group.findById(groupId).populate('members').populate('groupListsModel');
        if (!group) {
            return res.status(404).send({ message: 'Group not found' });
        }

        // Convert listName to lowercase
        const listNameLowerCase = listName.toLowerCase();

        let existingList = null;
        for (const list of group.groupListsModel) {
            if (list.listName === listNameLowerCase) {
                existingList = list;
                break;
            }
        }

        if (existingList) {
            // Handle the case where the list already exists
            return res.status(400).json({ error: 'A list with this name already exists.' });
        } else {

            // Create a new list
            const newList = new List({
                listName: listNameLowerCase,
                description: description || '',
                visibility: visibility || 'private', // Default to 'private' if not provided
                owner: groupId,
                type: 'groupList',
                ownerModel: 'Group'
            });
            await newList.save();


            // Fetch the _id of the newly created list
            const listId = newList._id;

            group.groupListsModel.push(listId);
            await group.save();

            // Update the list references for all members
            const memberUpdates = group.members.map(async (member) => {
                const user = await User.findById(member.member_id);
                if (!user) {
                    throw new Error(`User with id ${member.member_id} not found`);
                }
                if (!user.myLists.includes(listId)) {
                    user.myLists.push(listId);
                    await user.save();
                }
            });
            await Promise.all(memberUpdates);

            res.status(200).send({ message: 'List created successfully', listId });
        }
    } catch (error) {
        console.error('Error creating group list: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

router.delete('/group/deleteGroupList/:groupId/:listId', async (req, res) => {
    const { listId } = req.params;

    try {
        // Find the list
        const list = await List.findById(listId);
        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        // Delete the list (middleware will handle the cleanup)
        await list.remove();

        res.status(200).json({ message: 'List deleted successfully' });
    } catch (error) {
        console.error('Error deleting list', error);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;


module.exports = router;