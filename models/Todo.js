const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { GlobalSettings, initializeGlobalSettings } = require('./GlobalSettings');
const { calculateTaskScore, recalculateListScores } = require('../utils/scoreUtils');

const stepSchema = new mongoose.Schema({
    id: Number,
    taskName: String,
    isDone: Boolean,
    completed: Date,
    completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

const todoSchema = new mongoose.Schema({
    id: {
        type: Number,
    },
    task: {
        type: String,
        required: true
    },
    isDone: {
        type: Boolean,
        required: true
    },
    created: {
        type: Date,
        required: true
    },
    completed: {
        type: Date
    },
    completedBy: { //for later usage
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isStarted: {
        type: Boolean,
        required: true
    },
    started: {
        type: Date
    },
    startedBy: { //for later usage
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    owner: {
        type: String, // TODO: change this at some point, use user _id instead. More robust
    },
    inListNew: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'List',
    }],
    inList: {
        type: [String],
        required: function () {
            return this.owner != null;
        },
        default: function () {
            return this.owner != null ? ['all'] : [];
        }
    },
    priority: {
        type: String,
        enum: ['', 'VERY LOW', 'LOW', 'NORMAL', 'HIGH', 'VERY HIGH'],
    },
    difficulty: {
        type: String,
        enum: ['', 'VERY EASY', 'EASY', 'NORMAL', 'HARD', 'VERY HARD'],
    },
    isUrgent: {
        type: Boolean,
    },
    dueDate: {
        type: Date
    },
    description: {
        type: String
    },
    steps: {
        type: [stepSchema],
        default: []
    },
    estimatedTime: {
        type: Number
    },
    tags: {
        type: [{}],
        default: []
    },
    totalTimeSpent: { //this is a bad name
        type: Number,
        default: 0
    },
    tasksAfter: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Todo'
    }],
    tasksBefore: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Todo'
    }],
    repeatable: {
        type: Boolean,
    },
    repeatInterval: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    repeatDays: {
        type: [String],
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    repeatMonthlyOption: {
        type: String,
        enum: ['start', 'end'],
    },
    repeatYearlyOption: {
        type: String,
        enum: ['start', 'end'],
    },
    repeatNotify: {
        type: Boolean
    },
    repeatUntil: {
        type: Date
    },
    repeatTimes: {
        type: Number
    },
    repeatCount: {
        type: Number,
        default: 0
    },
    repeatStreak: {
        type: Number,
        default: 0
    },
    repeatableLongestStreak: {
        type: Number,
        default: 0
    },
    completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    repeatableCompleted: [{
        completed: {
            type: Boolean,
            required: false
        },
        completedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        startTime: {
            type: Date,
            required: true
        },
        completionTime: {
            type: Date,
            required: true
        },
        duration: {
            type: Number, // Duration in minutes
            required: true
        },
        steps: [stepSchema]

    }],
    repeatableEmoji: {
        type: String
    },
    isToday: {
        type: Boolean,
        default: false
    },
    score: {
        type: {
            score: {
                type: Number,
                required: true,
                default: 0
            },
            currency: {
                type: Number,
                required: true,
                default: 0
            }
        },
        required: true,
        default: { score: 0, currency: 0 }
    },
},
    {
        collection: 'Entries',
        timestamps: true
    }
);

//This is a bit silly and should not be here
todoSchema.post('findOneAndUpdate', async function (doc, next) {
    if (!doc) {
        console.error(`\x1b[31mERROR: Document not found after update\x1b[0m`);
        return next(new Error('Document not found'));
    }

    // console.log(`\x1b[33mDEBUG: Full document after update - ${JSON.stringify(doc, null, 2)}\x1b[0m`);

    try {
        const Todo = require('../models/Todo'); // Lazy import to avoid circular dependency
        await calculateTaskScore(doc, this.getUpdate());
        await recalculateListScores(doc.inListNew);
        // console.log(`\x1b[33mDEBUG: Recalculated list scores for lists: ${doc.inListNew}\x1b[0m`);
    } catch (error) {
        console.error(`\x1b[31mERROR: Failed to update task or recalculate list scores: ${error.message}\x1b[0m`);
        return next(error);
    }

    next(); // Ensure next() is called
});

// Resets data between modes so that you can switch between repeatable and non-repeatable todos
// in edit task
todoSchema.pre('save', async function (next) {
    if (!this.repeatable) {
        this.repeatIntervall = undefined;
        this.repeatDays = undefined;
        this.repeatDayOfWeek = undefined;
        this.repeatMonthlyOption = undefined;
        this.repeatYearlyOption = undefined;
        this.repeatUntil = undefined;
        this.repeatTimes = undefined;
        this.repeatCount = undefined;
        this.repeatableCompletedDate = undefined;
        this.repeatableEmoji = undefined;
    } else {
        //Updates longest streak
        if (this.repeatStreak > this.repeatableLongestStreak) {
            this.repeatableLongestStreak = this.repeatStreak;
        }

        if (this.repeatableEmoji) {
            let globalSettings = await GlobalSettings.findOne({});
            if (!globalSettings) {
                initializeGlobalSettings();
            }

            const existingEmoji = globalSettings.emojiSettings.emojis.find(e => e.emoji === this.repeatableEmoji);
            if (existingEmoji) {
                existingEmoji.count += 1;
            } else {
                globalSettings.emojiSettings.emojis.push({ emoji: this.repeatableEmoji, count: 1 });
            }

            await globalSettings.save();
        }
    }
    next();
});

//Makes sure that step.id exists
todoSchema.pre('save', function (next) {
    this.steps.forEach((step, index) => {
        if (step.id === undefined || step.id === null) {
            step.id = index + 1;
        }
    });
    next();
});

todoSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    if (update.steps) {
        update.steps.forEach((step, index) => {
            if (step.id === undefined || step.id === null) {
                step.id = index + 1;
            }
        });
    }
    next();
});

const Todo = mongoose.model('Todo', todoSchema);

module.exports = Todo;