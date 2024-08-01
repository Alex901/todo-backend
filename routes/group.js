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
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Study Group"
 *               owner:
 *                 type: string
 *                 example: "60d0fe4f5311236168a109ca"
 *               listName:
 *                 type: string
 *                 example: "Group Tasks"
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 name:
 *                   type: string
 *                   example: "Study Group"
 *                 owner:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 groupListsModel:
 *                   type: array
 *                   items:
 *                     type: string
 *                     example: "60d0fe4f5311236168a109ca"
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       member_id:
 *                         type: string
 *                         example: "60d0fe4f5311236168a109ca"
 *                       role:
 *                         type: string
 *                         example: "moderator"
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

module.exports = router;