const express = require('express');
const Todo = require('../models/Todo'); 

const router = express.Router();

// Route to store a new todo entry
router.post('/', async (req, res) => {
  try {
    // Extract data from the request body
    const { id, task, isDone, created, completed } = req.body;

    // Create a new todo entry
    const todo = new Todo({
      id, 
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

router.patch('/done', async (req, res) => {
  console.log(req.body)
  try{
    const { taskId } = req.body;

    const updatedTodo = await Todo.findByIdAndUpdate(taskId, {
      isDone: true,
      completed: new Date()
    }, { new: true });

    if(!updatedTodo){
      return res.status(404).json({ message: 'Task not found'});
    }
    res.status(200).json({ message: 'Task marked as done successfully'});
  } catch(error) {
    console.error('Error setting task to done:', error);
    res.status(500).json({ message: 'Internal server error '})
  }
})

router.delete('/delete/:taskId', async(req, res) => {
  const { taskId } = req.params;
  console.log("taskId: ", taskId);
  try{
    const entryToDelete = await Todo.findByIdAndDelete(taskId);
    if(!entryToDelete){
      return res.status(404).json({ message: 'Entry not found'})
    }

    return res.status(200).json({ message: 'successfully deleted entry! '})
  }catch(error) {
    console.error("could not delete entry");
    return res.status(500).json({ message: 'Internal server error'})
  }
})

module.exports = router;