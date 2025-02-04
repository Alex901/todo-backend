const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        validate: {
            validator: function (value) {
                // Check if value is a valid ObjectId or a string
                return mongoose.Types.ObjectId.isValid(value) || typeof value === 'string';
            },
            message: props => `${props.value} is not a valid ObjectId or string!`
        }
    },
    mailingList: {
        type: Boolean,
    },
    message: {
        type: String,
        required: true
    },
    reward: {
        type: Number,
        default: 2
    },
    type: {
        type: String,
        enum: ['bug', 'performance', 'feature', 'review', 'issues', 'payment', 'other', ''],
        default: ''
    },
    subType: {
        type: String,
        enum: ['feedback']
    },
    score: {
        type: Number,
        min: 0,
        max: 5,
        required: function () {
            return this.type === 'review';
        }
    },
    resolved: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    source: {
        type: String,
        enum: ['web', 'mobile', 'desktop', 'other']
    },
    upvotes: {
        type: Number,
        default: 0
    },
    downvotes: {
        type: Number,
        default: 0
    },
    resolvedAt: {
        type: Date,
        default: null,
        index: { expires: '7d' }
    },
    hasVoted: [{
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }],
},
    {
        collection: 'Feedback',
        timestamps: true
    }
);

feedbackSchema.pre('save', async function (next) {
    const User = require('./User');
    const Notification = require('./Notification');
    if (this.isNew) {
        try {
            // console.log('DEBUG -- type: ', this.type, ' subType: ', this.subType)
            // const admins = await User.find({ role: 'admin' });

            for (const admin of admins) {
                const existingNotification = await Notification.findOne({ to: admin._id, subType: this.type });
                // console.log('DEBUG -- Existing notification: ', existingNotification);

                if (existingNotification) {
                    existingNotification.count += 1;
                    existingNotification.message = `There are ${existingNotification.count} new ${this.type} reports to review.`;
                    await existingNotification.save();
                } else {
                    const newNotification = new Notification({
                        to: admin._id,
                        type: this.subType,
                        subType: this.type,
                        message: `There is 1 new ${this.type} report to review.`, //TODO: Crappy message
                        count: 1
                    });
                    await newNotification.save();
                }
            }
        } catch (error) {
            console.error('Error notifying admins: ', error);
            next(error);
        }
    }
    next();
});

feedbackSchema.pre('save', function (next) {
    if (this.isModified('resolved') && this.resolved !== null && this.resolved !== 'accepted') {
        this.resolvedAt = new Date();
    } else if (this.isModified('resolved') && (this.resolved === null || this.resolved === 'accepted')) {
        this.resolvedAt = null; // Ensure resolvedAt is null if resolved is null or accepted
    }
    next();
});

feedbackSchema.post('save', async function (doc, next) {
    const User = require('./User');
    const Notification = require('./Notification');

    if (doc.resolved) {
        // console.log('DEBUG -- Feedback resolved: ', doc.resolved);
        try {
            const admins = await User.find({ role: 'admin' });
            // console.log('DEBUG -- doc type: ', doc.type);

            for (const admin of admins) {
                const existingNotification = await Notification.findOne({ to: admin._id, subType: doc.type });
                // console.log('DEBUG -- Existing notification: ', existingNotification);
                if (existingNotification) {
                    try {
                        // Query the database to get the count of feedback entries with the specified type and resolved !== null
                        const feedbackCount = await Feedback.countDocuments({ type: doc.type, resolved: null });
                        // console.log('DEBUG -- feedbackCount: ', feedbackCount);

                        if (feedbackCount > 0) {
                            existingNotification.count = feedbackCount;
                            existingNotification.message = `There are ${feedbackCount} new ${doc.type} reports to review.`;
                            await existingNotification.save();
                        } else {
                            await Notification.deleteOne({ _id: existingNotification._id });
                        }
                    } catch (error) {
                        console.error('Error getting feedback count: ', error);
                        next(error);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating notifications for admins: ', error);
            next(error);
        }
    }
    next();
});


const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
