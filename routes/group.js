const express = require('express');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');
const Group = require('../models/Group');

const router = express.Router();

router.post('/create', authenticate, async (req, res) => {
    try {
        const groupData = req.body;
        const newGroup = new Group(groupData);
        newGroup.members.push({ member_id: groupData.owner, role: "moderator" });
        newGroup.groupLists.push({ name: req.body.listName, tags: [], description: "" });
        await newGroup.save();
        res.status(201).json(newGroup);
    } catch (error) {
        console.error('Error creating group', error);
        res.status(500).send('Internal server error');
    }
});

router.get('/getGroups/:userId', authenticate, async (req, res) => {
    try {
        const userId = req.params.userId;
        const groups = await Group.find({ 'members.member_id': userId });
        res.status(200).json(groups);
    } catch (error) {
        console.error('Error fetching groups', error);
        res.status(500).send('Internal server error');
    }
});

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