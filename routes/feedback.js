const express = require('express');
const { authenticate } = require('../middlewares/auth');
const Feedback = require('../models/Feedback');

const router = express.Router();

router.post('/post-feedback', async (req, res) => {
    //console.log('Feedback received: ', req.body);
    try {
        console.log("DEBUG -- req.body in create feedback -- pre change: ", req.body)
        const { subType, type, ...otherFields } = req.body;

        const tmp = req.body.type;
        req.body.type = req.body.subType;
        req.subType = type;
        req.body.subType = tmp;
        console.log("DEBUG -- req.body in create feedback: ", req.body)
        const feedback = new Feedback(req.body);
      
        console.log('DEBUG -- type in route: ', feedback.type, ' subType: ', req.body.subType);

        await feedback.save();
        res.status(201).send(feedback);
    } catch (error) {
        console.error('Error submitting feedback: ', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});



module.exports = router;