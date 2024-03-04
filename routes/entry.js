const express = require('express');
const Todo = require('../models/Todo'); 
const logger = require('../middlewares/logger');

const router = express.Router();

// Route to store a new todo entry
router.post('/', async (req, res) => {
  try {
    // Extract data from the request body
    const { id, task, isDone, created, completed, isStarted, started } = req.body;

    console.log("Req body before adding to database", req.body);

    // Create a new todo entry
    const todo = new Todo({
      id, 
      task,
      isDone,
      created,
      completed,
      isStarted,
      started
    });

    console.log("Todo before adding to db: ", todo);
    // Save the todo entry to the database
    await todo.save(); //Error happens here 

    console.log("Todo after adding to db: ", todo);

    res.status(201).json({ message: 'Todo entry created successfully', todo });
  } catch (error) {
    const errorMessage = error.message;
    const stackTrace = error.stack;

    logger.error({
      level: 'error',
      message: 'Error storing todo entry: ' + errorMessage,
      stackTrace: stackTrace
    });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch entries from database
router.get('/todos', async (req, res) => {
    try {
        const entries = await Todo.find();

        await updateData(entries); //remember this one

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

router.patch('/start', async (req, res) => {
  try {
    const { taskId } = req.body;

    const updatedTodo = await Todo.findByIdAndUpdate(taskId, {
      isStarted: true,
      started: new Date()
    }, { new: true });

    if (!updatedTodo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json({ message: 'Task marked as started successfully' });
  } catch (error) {
    console.error('Error setting task as started:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//Helper to update data when needed
const updateData = async (entries) => {
  try {
    for (let entry of entries) {
      if (!entry.isStarted || !entry.started) {
        await Todo.findByIdAndUpdate(entry._id, { $set: { isStarted: false, started: null } });
        entry.isStarted = false;
        entry.started = null;
      }
    }
  } catch (error) {
    console.error('Error updating data:', error);
    throw error; // Re-throw the error to handle it in the calling function
  }
};

router.patch('/start', async (req, res) => {
  try {
    // Extract taskId from the request body
    const { taskId } = req.body;

    // Update the task in the database
    const updatedTodo = await Todo.findByIdAndUpdate(taskId, {
      isStarted: true, // Mark the task as started
      started: new Date() // Set the started timestamp
    }, { new: true }); // Return the updated document

    // Check if the task was found and updated successfully
    if (!updatedTodo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Send a success response
    res.status(200).json({ message: 'Task marked as started successfully' });
  } catch (error) {
    // Handle errors
    console.error('Error setting task as started:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/cancel', async (req, res) => {
  try {
    // Extract taskId from the request body
    const { taskId } = req.body;
    console.log("Start: Cancel task: taskId", taskId);
    // Update the task in the database
    const updatedTodo = await Todo.findByIdAndUpdate(taskId, {
      isStarted: false, // Mark the task as not started
      started: null // Reset the started timestamp
    }, { new: true }); // Return the updated document

    // Check if the task was found and updated successfully
    if (!updatedTodo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Send a success response
    res.status(200).json({ message: 'Task canceled successfully' });
  } catch (error) {
    // Handle errors
    console.error('Error canceling task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;