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

module.exports = router;