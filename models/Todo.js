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
    }
}, {
    collection: 'Offline-entries' 
});

const Todo = mongoose.model('Todo', todoSchema);

module.exports = Todo;