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
        required: true
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
    isStarted: {
        type: Boolean,
        required: true
    },
    started: {
        type: Date
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
    }
}, {
    collection: 'Offline-entries',
    timestamps: true
}
);

const Todo = mongoose.model('Todo', todoSchema);

module.exports = Todo;