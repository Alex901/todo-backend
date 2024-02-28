const express = require('express');
const Todo = require('../models/Todo'); 

const router = express.Router();

// Route to store a new todo entry
router.post('/', async (req, res) => {
  try {
    // Extract data from the request body
    const { task, isDone, created, completed } = req.body;

    // Create a new todo entry
    const todo = new Todo({
      task,
      isDone,
      created,
      completed
    });

    // Save the todo entry to the database
    await todo.save();

    res.status(201).json({ message: 'Todo entry created successfully', todo });
  } catch (error) {
    console.error('Error storing todo entry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch entries from database
router.get('/todos', async (req, res) => {
    try {
        const entries = await Todo.find();

        res.json(entries);
    } catch(error) {
        console.error('Error fetching entries', error);
        res.status(500).json({ message: 'Internal server error' });
    }
})

module.exports = router;