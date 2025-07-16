const express = require('express');
const { authenticate } = require('../middlewares/auth');
const Feedback = require('../models/Feedback');
const { calculateReward } = require('../utils/voteUtils');
const User = require('../models/User');

const router = express.Router();

/**
 * @swagger
 * /feedback/fetchOfflineFeedback:
 *   get:
 *     summary: Fetch filtered feedback entries
 *     description: Retrieves a list of feedback entries where type is either 'review' or 'feature', and resolved is 'accepted'.
 *     tags:
 *       - Feedback
 *     responses:
 *       200:
 *         description: Successfully fetched the feedback entries.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   from:
 *                     type: string
 *                   mailingList:
 *                     type: boolean
 *                   message:
 *                     type: string
 *                   type:
 *                     type: string
 *                   subType:
 *                     type: string
 *                   score:
 *                     type: number
 *                   resolved:
 *                     type: string
 *                   resolvedAt:
 *                     type: string
 *                     format: date-time
 *                   source:
 *                     type: string
 *                   upvotes:
 *                     type: number
 *                   downvotes:
 *                     type: number
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.get('/fetchOfflineFeedback', async (req, res) => {
    try {
        const feedbacks = await Feedback.find({
            type: { $in: ['review', 'feature'] },
            resolved: 'accepted'
        });
        res.status(200).send(feedbacks);
    } catch (error) {
        console.error('Error fetching filtered feedback:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});


/**
 * @swagger
 * /post-feedback:
 *   post:
 *     summary: Submit feedback
 *     description: Endpoint to submit feedback.
 *     tags:
 *       - Feedback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 description: The type of feedback.
 *                 example: bug
 *               subType:
 *                 type: string
 *                 description: The subtype of feedback.
 *                 example: UI
 *               otherFields:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Other fields related to the feedback.
 *     responses:
 *       '201':
 *         description: Feedback created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: The ID of the created feedback.
 *                 type:
 *                   type: string
 *                   description: The type of feedback.
 *                 subType:
 *                   type: string
 *                   description: The subtype of feedback.
 *                 otherFields:
 *                   type: object
 *                   additionalProperties: true
 *                   description: Other fields related to the feedback.
 *       '500':
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
router.post('/post-feedback', async (req, res) => {
    //console.log('Feedback received: ', req.body);
    try {
        const { subType, type, ...otherFields } = req.body;

        const tmp = req.body.type;
        req.body.type = req.body.subType;
        req.subType = type;
        req.body.subType = tmp;
        console.log("DEBUG -- req.body in create feedback: ", req.body)
        const feedback = new Feedback(req.body);
      
        // console.log('DEBUG -- type in route: ', feedback.type, ' subType: ', req.body.subType);

        await feedback.save();
        res.status(201).send(feedback);
    } catch (error) {
        console.error('Error submitting feedback: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /getAll:
 *   get:
 *     summary: Fetch all feedback entries
 *     description: Retrieves a list of all feedback entries from the database.
 *     tags:
 *       - Feedback
 *     responses:
 *       '200':
 *         description: A list of feedback entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: The ID of the feedback entry.
 *                   type:
 *                     type: string
 *                     description: The type of feedback.
 *                   subType:
 *                     type: string
 *                     description: The subtype of feedback.
 *                   otherFields:
 *                     type: object
 *                     additionalProperties: true
 *                     description: Other fields related to the feedback.
 *       '500':
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
router.get('/getAll', async (req, res) => {
    try {
        const feedbackList = await Feedback.find();
        res.status(200).send(feedbackList);
    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /resolveFeedback/{feedbackId}:
 *   put:
 *     summary: Resolve a feedback entry
 *     description: Updates the resolved status of a specific feedback entry.
 *     tags:
 *       - Feedback
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         description: The ID of the feedback entry to update.
 *         schema:
 *           type: string
 *       - in: body
 *         name: resolved
 *         required: true
 *         description: The new resolved status of the feedback entry.
 *         schema:
 *           type: object
 *           properties:
 *             resolved:
 *               type: boolean
 *     responses:
 *       200:
 *         description: Successfully updated the feedback entry.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 from:
 *                   type: string
 *                 mailingList:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 type:
 *                   type: string
 *                 subType:
 *                   type: string
 *                 score:
 *                   type: number
 *                 resolved:
 *                   type: boolean
 *                 resolvedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Feedback not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.put('/resolveFeedback/:feedbackId', async (req, res) => {
    const { feedbackId } = req.params;
    const { resolved } = req.body;

    try {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            return res.status(404).send({ message: 'Feedback not found' });
        }

        feedback.resolved = resolved;
        await feedback.save();

        res.status(200).send(feedback);
    } catch (error) {
        console.error('Error changing resolved status:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /feedback/upvote/{feedbackId}:
 *   put:
 *     summary: Upvote a feedback feature
 *     description: Increases the upvotes of a feedback feature by one and adds the userId to the hasVoted array.
 *     tags:
 *       - Feedback
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the feedback to upvote
 *       - in: body
 *         name: userId
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             userId:
 *               type: string
 *         description: The ID of the user who is upvoting
 *     responses:
 *       200:
 *         description: Successfully upvoted the feedback feature.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 feedback:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     upvotes:
 *                       type: number
 *                     hasVoted:
 *                       type: array
 *                       items:
 *                         type: string
 *       404:
 *         description: Feedback not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.put('/upvote/:feedbackId', async (req, res) => {
    const { feedbackId } = req.params;
    const { userId } = req.body;

    try {
        const feedback = await Feedback.findById(feedbackId);

        if (!feedback) {
            return res.status(404).send({ message: 'Feedback not found' });
        }

        // Check if the user has already voted
        if (!feedback.hasVoted.includes(userId)) {
            const votingUser = await User.findById(userId);
            if(votingUser){
                votingUser.settings.currency += feedback.reward;
                await votingUser.save();
            }   

            feedback.upvotes += 1;
            feedback.hasVoted.push(userId);

            const totalVotes = feedback.upvotes + feedback.downvotes;
            feedback.reward = calculateReward(totalVotes);

            await feedback.save();  
        }

        res.status(200).send({ message: 'Successfully upvoted the feedback feature', feedback });
    } catch (error) {
        console.error('Error upvoting feedback feature:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /feedback/downvote/{feedbackId}:
 *   put:
 *     summary: Downvote a feedback feature
 *     description: Decreases the upvotes of a feedback feature by one and removes the userId from the hasVoted array.
 *     tags:
 *       - Feedback
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the feedback to downvote
 *       - in: body
 *         name: userId
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             userId:
 *               type: string
 *         description: The ID of the user who is downvoting
 *     responses:
 *       200:
 *         description: Successfully downvoted the feedback feature.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 feedback:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     upvotes:
 *                       type: number
 *                     hasVoted:
 *                       type: array
 *                       items:
 *                         type: string
 *       404:
 *         description: Feedback not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.put('/downvote/:feedbackId', async (req, res) => {
    const { feedbackId } = req.params;
    const { userId } = req.body;

    try {
        const feedback = await Feedback.findById(feedbackId);

        if (!feedback) {
            return res.status(404).send({ message: 'Feedback not found' });
        }

        if (!feedback.hasVoted.includes(userId)) {
            const votingUser = await User.findById(userId);
            if(votingUser){
                votingUser.settings.currency += feedback.reward;
                await votingUser.save();
            }

            feedback.downvotes += 1;
            feedback.hasVoted.push(userId);

            const totalVotes = feedback.upvotes + feedback.downvotes;
            feedback.reward = calculateReward(totalVotes);

            await feedback.save();
        }

        res.status(200).send({ message: 'Successfully downvoted the feedback feature', feedback });
    } catch (error) {
        console.error('Error downvoting feedback feature:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});


module.exports = router;