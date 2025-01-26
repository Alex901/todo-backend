const express = require('express');
const { authenticate } = require('../middlewares/auth');
const { GlobalSettings } = require('../models/GlobalSettings');
const router = express.Router();

/**
 * @swagger
 * /emoji/increment:
 *   post:
 *     summary: Increment the count for a given emoji
 *     description: Increments the count for a given emoji. If the emoji does not exist, creates a new entry with a count of 1.
 *     tags:
 *       - Emoji Settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emoji:
 *                 type: string
 *                 example: "😊"
 *     responses:
 *       200:
 *         description: Emoji count incremented successfully
 *       500:
 *         description: Internal server error
 */
router.post('/emoji/increment', authenticate, async (req, res) => {
    const { emoji } = req.body;
    try {
        let globalSettings = await GlobalSettings.findOne({});
        if (!globalSettings) {
            globalSettings = new GlobalSettings({ emojiSettings: { emojis: [] } });
        }

        const existingEmoji = globalSettings.emojiSettings.emojis.find(e => e.emoji === emoji);
        if (existingEmoji) {
            existingEmoji.count += 1;
        } else {
            globalSettings.emojiSettings.emojis.push({ emoji, count: 1 });
        }

        await globalSettings.save();
        res.status(200).json({ message: 'Emoji count incremented successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
});

/**
 * @swagger
 * /emoji/remove:
 *   delete:
 *     summary: Remove an emoji entry
 *     description: Removes an emoji entry from the global settings.
 *     tags:
 *       - Emoji Settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emoji:
 *                 type: string
 *                 example: "😊"
 *     responses:
 *       200:
 *         description: Emoji removed successfully
 *       404:
 *         description: Global settings not found
 *       500:
 *         description: Internal server error
 */
router.delete('/emoji/remove', authenticate, async (req, res) => {
    const { emoji } = req.body;
    try {
        const globalSettings = await GlobalSettings.findOne({});
        if (!globalSettings) {
            return res.status(404).json({ message: 'Global settings not found' });
        }

        globalSettings.emojiSettings.emojis = globalSettings.emojiSettings.emojis.filter(e => e.emoji !== emoji);
        await globalSettings.save();

        res.status(200).json({ message: 'Emoji removed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
});

/**
 * @swagger
 * /emoji/top/{x}:
 *   get:
 *     summary: Get top x emojis
 *     description: Returns the top x emojis based on their count.
 *     tags:
 *       - Emoji Settings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: x
 *         required: true
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: A list of top x emojis
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       404:
 *         description: Global settings not found
 *       500:
 *         description: Internal server error
 */
router.get('/emoji/top/:x', authenticate, async (req, res) => {
    const { x } = req.params;
    try {
        console.log('DEBUG: Fetching top emojis');
        const globalSettings = await GlobalSettings.findOne({});
        if (!globalSettings) {
            console.log('DEBUG: Global settings not found');
            return res.status(404).json({ message: 'Global settings not found' });
        }

        const topEmojis = globalSettings.emojiSettings.emojis
            .sort((a, b) => b.count - a.count)
            .slice(0, parseInt(x))
            .map(e => e.emoji);

        console.log('DEBUG: Top emojis fetched successfully');
        res.status(200).json(topEmojis);
    } catch (error) {
        console.error('Error fetching top emojis:', error);
        res.status(500).json({ message: 'Internal server error', error });
    }
});

/**
 * @swagger
 * /emoji/bottom/{x}:
 *   get:
 *     summary: Get bottom x emojis
 *     description: Returns the bottom x emojis based on their count.
 *     tags:
 *       - Emoji Settings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: x
 *         required: true
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: A list of bottom x emojis
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       404:
 *         description: Global settings not found
 *       500:
 *         description: Internal server error
 */
router.get('/emoji/bottom/:x', authenticate, async (req, res) => {
    const { x } = req.params;
    try {
        const globalSettings = await GlobalSettings.findOne({});
        if (!globalSettings) {
            return res.status(404).json({ message: 'Global settings not found' });
        }

        const bottomEmojis = globalSettings.emojiSettings.emojis
            .sort((a, b) => a.count - b.count)
            .slice(0, parseInt(x))
            .map(e => e.emoji);

        res.status(200).json(bottomEmojis);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
});

/**
 * @swagger
 * /emoji/all:
 *   get:
 *     summary: Get all emojis
 *     description: Returns all emojis, excluding their count.
 *     tags:
 *       - Emoji Settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of all emojis
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       404:
 *         description: Global settings not found
 *       500:
 *         description: Internal server error
 */
router.get('/emoji/all', authenticate, async (req, res) => {
    try {
        const globalSettings = await GlobalSettings.findOne({});
        if (!globalSettings) {
            return res.status(404).json({ message: 'Global settings not found' });
        }

        const allEmojis = globalSettings.emojiSettings.emojis.map(e => e.emoji);

        res.status(200).json(allEmojis);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
});

module.exports = router;