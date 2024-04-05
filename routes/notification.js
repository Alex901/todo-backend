const express = require('express');
const { authenticate } = require('../middlewares/auth');
const Group = require('../models/Group');
const User = require('../models/User');
const Notification = require('../models/Notification');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    console.log('User: ', req.user._id);
    try {
        const notifications = await Notification.find({ to: req.user._id });
        console.log('Notifications: ', notifications);

        if (notifications.length === 0) {
            return res.status(200).send({ message: 'No notifications found' });
        }

        res.send(notifications);
    } catch (error) {
        console.error('Error fetching notifications: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

router.post('/groupinvite', authenticate, async (req, res) => {
    const { from, to, groupId } = req.body;

    try {
        // Create a new Notification document
        const fromUser = await User.findById(from._id);
        const groupName = await Group.findById(groupId);

        const notification = new Notification({
            from,
            to,
            type: 'group',
            group: groupId,
            message: `${fromUser.username} has invited you to join their group ${groupName.name}.`,
        });

        // Save the Notification document
        await notification.save();

        // Send a success response
        res.send({ message: 'Invite sent successfully' });
    } catch (error) {
        console.error('Error sending invite: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

router.delete('/delete/:id', authenticate, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).send({ message: 'Notification not found' });
        }

        if (notification.to.toString() !== req.user._id.toString()) {
            return res.status(403).send({ message: 'You do not have permission to delete this notification' });
        }

        await Notification.findByIdAndDelete(req.params.id);

        res.send({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

module.exports = router;