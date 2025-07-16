const express = require('express');
const { authenticate } = require('../middlewares/auth');
const Group = require('../models/Group');
const User = require('../models/User');
const Notification = require('../models/Notification');

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     summary: Get notifications for the authenticated user
 *     description: Fetches all notifications for the authenticated user.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of notifications or a message indicating no notifications found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: No notifications found
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
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
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 60d0fe4f5311236168a109ca
 *         to:
 *           type: string
 *           example: 60d0fe4f5311236168a109cb
 *         message:
 *           type: string
 *           example: "You have a new message"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2021-06-21T14:48:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2021-06-21T14:48:00.000Z
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
// router.get('/', authenticate, async (req, res) => {
//     try {
//         const notifications = await Notification.find({ to: req.user._id });
//         //console.log('Notifications: ', notifications);

//         if (notifications.length === 0) {
//             return res.status(200).send({ message: 'No notifications found' });
//         }

//         res.send(notifications);
//     } catch (error) {
//         console.error('Error fetching notifications: ', error);
//         res.status(500).send({ message: 'Internal server error' });
//     }
// });

router.get('/', authenticate, async (req, res) => {
    try {
        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        console.log(`[DEBUG] SSE connection established for user: ${req.user._id}`);

        // Fetch all existing notifications for the user
        const existingNotifications = await Notification.find({ to: req.user._id });

        // Send all existing notifications as an initial batch
        res.write(`data: ${JSON.stringify(existingNotifications)}\n\n`);

        // Watch for new notifications in the database
        const notificationStream = Notification.watch([
            { $match: { 'fullDocument.to': req.user._id } }
        ]);

        notificationStream.on('change', (change) => {
            console.log(`[DEBUG] New notification for user: ${req.user._id}`);
            res.write(`data: ${JSON.stringify(change.fullDocument)}\n\n`);
        });

        // Handle client disconnect
        req.on('close', () => {
            console.log(`[DEBUG] SSE connection closed for user: ${req.user._id}`);
            notificationStream.close();
            res.end();
        });
    } catch (error) {
        console.error('Error setting up SSE for notifications: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /groupinvite:
 *   post:
 *     summary: Send a group invite notification
 *     description: Sends a notification to invite a user to a group.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               from:
 *                 type: string
 *                 example: "60d0fe4f5311236168a109ca"
 *               to:
 *                 type: string
 *                 example: "60d0fe4f5311236168a109cb"
 *               groupId:
 *                 type: string
 *                 example: "60d0fe4f5311236168a109cc"
 *     responses:
 *       200:
 *         description: Invite sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invite sent successfully
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
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
router.post('/groupinvite', authenticate, async (req, res) => {
    const { from, to, groupId } = req.body;
    console.log('From: ', from);
    console.log('To: ', to);
    console.log('Group: ', groupId);

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

/**
 * @swagger
 * /delete/{id}:
 *   delete:
 *     summary: Delete a notification
 *     description: Deletes a notification by its ID.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification to delete
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Notification deleted successfully
 *       403:
 *         description: You do not have permission to delete this notification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: You do not have permission to delete this notification
 *       404:
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Notification not found
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
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
router.delete('/delete/:id', authenticate, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).send({ message: 'Notification not found' });
        }

        console.log("DEBUG -- Notification to ", notification.to.toString());

        if (!notification.to.map(id => id.toString()).includes(req.user._id.toString())) {
            return res.status(403).send({ message: 'You do not have permission to delete this notification' });
        }

        await Notification.findByIdAndDelete(req.params.id);

        res.status(200).send({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});


//TODO: Docx
router.post('/request-to-join-group', authenticate, async (req, res) => {
    const { from, to, group } = req.body;

    if (!from || !to || !group) {
        return res.status(400).send({ message: 'Missing required fields' });
    }

    try {
        const user = await User.findById(from);
        const groupDetails = await Group.findById(group);

        if (!user || !groupDetails) {
            return res.status(404).send({ message: 'User or Group not found' });
        }

        const notification = new Notification({
            from,
            to,
            group,
            type: 'request-to-join-group',
            message: `${user.username} has requested to join your group ${groupDetails.name}`
        });

        await notification.save();

        res.status(200).send({ message: 'Request to join group sent successfully' });
    } catch (error) {
        console.error('Error creating notification: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

module.exports = router;