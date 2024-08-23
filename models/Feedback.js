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
    type: {
        type: String,
        enum: ['bug', 'performance', 'feature', 'reviwe', 'issues', 'payment', 'other', ''],
        default: ''
    },
    subType: {
        type: String,
        enum: ['feedback']
    },
    score: {
        type: Number,
        min: 1,
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
            console.log('DEBUG -- type: ', this.type, ' subType: ', this.subType)
            const admins = await User.find({ role: 'admin' });

            for (const admin of admins) {
                const existingNotification = await Notification.findOne({ to: admin._id, subType: this.type });
                console.log('DEBUG -- Existing notification: ', existingNotification);

                if (existingNotification) {
                    existingNotification.count += 1;
                    existingNotification.message = `There are ${existingNotification.count} new ${this.type} reports to review.`;
                    await existingNotification.save();
                } else {
                    const newNotification = new Notification({
                        to: admin._id,
                        type: this.subType,
                        subType: this.type,
                        message: `There is 1 new ${this.type} report to review.`,
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

feedbackSchema.post('save', async function (doc, next) {
    const User = require('./User');
    const Notification = require('./Notification');

    if (doc.resolved) {
        try {
            const admins = await User.find({ role: 'admin' });

            for (const admin of admins) {
                const existingNotification = await Notification.findOne({ to: admin._id, subType: doc.subType });

                if (existingNotification) {
                    existingNotification.count -= 1;
                    if (existingNotification.count > 0) {
                        existingNotification.message = `There are ${existingNotification.count} new ${doc.type} reports to review.`;
                        await existingNotification.save();
                    } else {
                        await Notification.deleteOne({ _id: existingNotification._id });
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
