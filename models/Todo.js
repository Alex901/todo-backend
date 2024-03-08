const mongoose = require('mongoose');

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
        type: String, // TODO: use user _id instead
    },
    inList: {
        type: [String],
        required: function() {
          return this.owner != null;
        },
        default: function() {
          return this.owner != null ? ['all'] : [];
        }
      },
    priority: {
        type: String,
        required: true,
        enum: ['VERY LOW', 'LOW', 'NORMAL', 'HIGH', 'VERY HIGH'],
        default: 'NORMAL'
    },
    iSUrgent: {
        type: Boolean,
        required: true,
        default: false
    },
    dueDate: {
        type: Date
    },
    description: {
        type: String
    },
    steps: {
        type: [String],
        default: []
    },
}, {
    collection: 'Offline-entries',
    timestamps: true
});

const Todo = mongoose.model('Todo', todoSchema);

module.exports = Todo;