const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const stepSchema = new mongoose.Schema({
    id: Number,
    taskName: String,
    isDone: Boolean
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
    daily: {
        type: Boolean,
        default : false
    },
    repeat: {
        type: String,
        enum: ['', 'daily', 'weekly', 'monthly', 'yearly']
    },
    repeatDays: {
        type: [Boolean],
        validate: {
            validator: function(v) {
                return v.length === 7;
            },
            message: props => `${props.value} must be an array of length 7`
        },
        default: [false, false, false, false, false, false, false]
    },
    repeatDayOfWeek: {
        type: Number,
        min: 1,
        max: 7,
        validate: {
            validator: function(v) {
                return Number.isInteger(v);
            },
            message: props => `${props.value} is not an integer`
        }
    },
    repeatMonthlyOption: {
        type: String,
        enum: ['start', 'end'],
        default: ''
    },
    repeatYearlyOption: {
        type: String,
        enum: ['start', 'end'],
        default: ''
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
    repeatableEmoji: {
        type: String
    },
    repeatableHelperText: {
        type: String
    },
    isToday: {
        type: Boolean,
        default: false
    }
}, {
    collection: 'Entries',
    timestamps: true
}
);

//Makes sure that step.id exists
todoSchema.pre('save', function(next) {
  this.steps.forEach((step, index) => {
    if (step.id === undefined || step.id === null) {
      step.id = index+1;
    }
  });
  next();
});

todoSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    if (update.steps) {
      update.steps.forEach((step, index) => {
        if (step.id === undefined || step.id === null) {
          step.id = index+1;
        }
      });
    }
    next();
  });

const Todo = mongoose.model('Todo', todoSchema);

module.exports = Todo;