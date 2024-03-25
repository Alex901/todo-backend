const express = require('express');
const Todo = require('../models/Todo'); 
const logger = require('../middlewares/logger');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');
const cors = require('cors');

const router = express.Router();

const corsOptions = {
  allowedHeaders: ['User', 'Content-Type'], 
  credentials: true,
};


// Route to store a new todo entry
router.post('/', async (req, res) => {
  try {
    // Extract data from the request body
    const { id, task, isDone, created, completed, isStarted, started, owner, steps, priority, dueDate, description, isUrgent, inList, difficulty, estimatedTime, tags } = req.body;

    // Create a new todo entry
    const todo = new Todo({
      id, 
      task,
      isDone,
      created,
      completed,
      isStarted,
      started,
      owner,
      steps,
      priority,
      dueDate,
      description,
      isUrgent, 
      tags,
      inList,
      difficulty,
      estimatedTime
    });
    // Save the todo entry to the database
    await todo.save(); 


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
router.get('/todos', authenticate, async  (req, res) => {
    try {
      let entries;
      if (req.user) {
          // If a valid token was provided, return users entries
          entries = await Todo.find({ owner: req.user.username }); //REMEMBER: observer and shared too
      } else {
          // If no token was provided, return limited entries: guest user
          entries = await Todo.find({ inList: { $eq: [] } });
      }

      //await updateData(entries);

      res.json(entries);
    } catch(error) {
        console.error('Error fetching entries', error);
        res.status(500).json({ message: 'Internal server error' });
    }
})

router.get('/todos/mobile', cors(corsOptions), async (req, res) => {
  console.log("mobile request works, hurray!!!");
  try {
      let entries;
      const username = req.headers['user'];

      if (username) {
          // If a username was provided, return users entries
          entries = await Todo.find({ owner: username });
      } else {
          // If no username was provided, return limited entries: guest user
          entries = await Todo.find({ inList: { $eq: [] } });
      }

      res.json(entries);
  } catch(error) {
      console.error('Error fetching entries', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});

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
    throw error; 
  }
};

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

router.patch('/cancel', async (req, res) => {
  try {
    // Extract taskId from the request body
    const { taskId } = req.body;
    console.log("Start: Cancel task: taskId", taskId);
    // Update the task in the database
    const updatedTodo = await Todo.findByIdAndUpdate(taskId, {
      isStarted: false, 
      started: null 
    }, { new: true }); 

    if (!updatedTodo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json({ message: 'Task canceled successfully' });
  } catch (error) {
    console.error('Error canceling task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/edit', async (req, res) => {
  try {
    const { taskId, updatedTask } = req.body;

    const updatedTodo = await Todo.findByIdAndUpdate(taskId, updatedTask, { new: true });

    if (!updatedTodo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json({ message: 'Task updated successfully', updatedTodo });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/update', async (req, res) => {
  try {
    const update = req.body;
    console.log("update: ", update);  
    // Update all documents in the Todo collection
    await Todo.updateMany({}, update);

    res.status(200).json({ message: 'All entries updated successfully' });
  } catch (error) {
    console.error('Error updating entries', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/stepComplete', async (req, res) => {
  const { taskId, stepId } = req.body;

  try {
    // Find the task by id
    const task = await Todo.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    // Find the step in the task's steps array and mark it as completed
    const step = task.steps.find(step => step.id === stepId);
    if (!step) {
      return res.status(404).json({ message: 'Step not found' });
    }

    step.isDone = true;

    // Save the updated task
    await task.save();

    res.status(200).json({ message: 'Step marked as done successfully' });
  } catch (error) {
    console.error('Error marking step as done:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/stepUncomplete', async (req, res) => {
  const { taskId, stepId } = req.body;
  console.log("req.body: ", req.body)
  try {
    // Find the task by id
    const task = await Todo.findById(taskId);
    console.log("task: ", task);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Find the step in the task's steps array and mark it as uncompleted
    const step = task.steps.find(step => step.id === stepId);
    console.log("step: ", step);
    if (!step) {
      return res.status(404).json({ message: 'Step not found' });
    }

    step.isDone = false;

    // Save the updated task
    await task.save();

    res.status(200).json({ message: 'Step marked as undone successfully' });
  } catch (error) {
    console.error('Error marking step as undone:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



module.exports = router;