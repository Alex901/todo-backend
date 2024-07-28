const express = require('express');
const Todo = require('../models/Todo');
const List = require('../models/List');
const logger = require('../middlewares/logger');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');
const cors = require('cors');

const router = express.Router();

const corsOptions = { //This is not nice
  allowedHeaders: ['User', 'Content-Type'],
  credentials: true,
};


// Route to store a new todo entry
router.post('/', async (req, res) => {
  console.log("req.body: ", req.body);
  try {
    if (req.body.tags.length > 0) {
      const tagNames = [];
      for (tag of req.body.tags) {
        tagNames.push(tag.label);
      }
      listsToUpdate = await List.find({ _id: { $in: req.body.inListNew } });
      console.log("listsToUpdate: ", listsToUpdate);
      for (const list of listsToUpdate) {
        if (Array.isArray(list.tags)) {
          for (const tag of list.tags) {
            console.log("tag: ", tag);
            // Check if the tag's name is in tagNames before incrementing uses
            if (tagNames.includes(tag.label)) {
              console.log("tagNames includes tag.label: ", tag.label);
              tag.uses = tag.uses + 1; // Increment the uses only if the tag is in tagNames
            }
          }
        }
        await list.save();
      }
    }

    const todo = new Todo(req.body);
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
router.get('/todos', authenticate, async (req, res) => {
  //console.log("\x1b[31mDEBUG\x1b[0m: req.body: ", req.user);
  try {
    let entries;
    if (req.user) {
      // If a valid token was provided, return users entries
      entries = await Todo.find({
    $or: [
        { owner: req.user._id },
        { owner: { $in: req.user.groups } }
    ]
}).populate('inListNew'); //REMEMBER: observer and shared too
    }

    res.json(entries);
  } catch (error) {
    console.error('Error fetching entries', error);
    res.status(500).json({ message: 'Internal server error' });
  }
})

router.get('/todos/mobile', cors(corsOptions), async (req, res) => {
  console.log("mobile request works, hurray!!!");
  try {
    let entries;
    console.log("req.headers: ", req.headers.user);
    const username = req.headers['user'];

    if (username) {
      // If a username was provided, return users entries
      entries = await Todo.find({ owner: username });
    } else {
      // If no username was provided, return limited entries: guest user
      entries = await Todo.find({ inList: { $eq: [] } });
    }

    res.json(entries);
  } catch (error) {
    console.error('Error fetching entries', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/done', async (req, res) => {
  console.log(req.body)
  try {
    const { taskId } = req.body;

    const updatedTodo = await Todo.findByIdAndUpdate(taskId, {
      isDone: true,
      completed: new Date()
    }, { new: true });

    if (!updatedTodo) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(200).json({ message: 'Task marked as done successfully' });
  } catch (error) {
    console.error('Error setting task to done:', error);
    res.status(500).json({ message: 'Internal server error ' })
  }
})

router.delete('/delete/:taskId', async (req, res) => {
  const { taskId } = req.params;
  try {
    // Find the entry without deleting it first to get its tags
    const entryToDelete = await Todo.findById(taskId);
    if (!entryToDelete) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    // Assuming entryToDelete.tags is an array of tag objects with a 'label' property
    const tagLabels = entryToDelete.tags.map(tag => tag.label);

    if (tagLabels.length > 0) {
      const listsToUpdate = await List.find({ _id: { $in: entryToDelete.inListNew } });
      console.log("listsToUpdate: ", listsToUpdate);

      for (const list of listsToUpdate) {
        if (Array.isArray(list.tags)) {
          for (const tag of list.tags) {
            if (tagLabels.includes(tag.label)) {
              console.log("Decreasing uses for tag: ", tag.label);
              tag.uses = Math.max(tag.uses - 1, 0); // Ensure uses doesn't go below 0
            }
          }
          await list.save(); // Save each list after decrementing the tag uses
        }
      }
    }

    // Now delete the entry
    await Todo.findByIdAndDelete(taskId);
    return res.status(200).json({ message: 'Successfully deleted entry!' });
  } catch (error) {
    console.error("Could not delete entry", error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/start', async (req, res) => {
  try {
    const { taskId } = req.body;

    // Fetch the document first
    const todo = await Todo.findById(taskId);

    if (!todo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Update the fields
    todo.isStarted = true;
    todo.started = new Date();

    // Manually increment the __v field
    todo.__v += 1;

    // Save the document, which will increment the __v field
    await todo.save();

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
      started: null,
      $inc: { __v: 1 }
    }, { new: true });

    if (!updatedTodo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    updatedTodo.save();

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
    updatedTodo.__v += 1;

    await updatedTodo.save();

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
  // console.log("req.body: ", req.body)
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