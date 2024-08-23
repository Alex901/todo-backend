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
        enum: ['feedback', 'bug','performance', 'feature',  'reviwe', 'issues', 'payment', 'other'],
        default: 'other'
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
        type: Boolean,
        default: false
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

const Feedback = mongoose.model('Feedback', feedbackSchema);
