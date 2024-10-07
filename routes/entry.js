const express = require('express');
const Todo = require('../models/Todo');
const List = require('../models/List');
const logger = require('../middlewares/logger');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');
const cors = require('cors');
const listUtils = require('../utils/listUtils');

const router = express.Router();


/**
 * @swagger
 * /:
 *   post:
 *     summary: Create a new todo entry
 *     description: Creates a new todo entry and updates the usage count of associated tags in the specified lists.
 *     tags:
 *       - Todo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Buy groceries"
 *               description:
 *                 type: string
 *                 example: "Milk, Bread, Cheese"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     label:
 *                       type: string
 *                       example: "Shopping"
 *               inListNew:
 *                 type: array
 *                 items:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *     responses:
 *       201:
 *         description: Todo entry created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Todo entry created successfully"
 *                 todo:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "60d0fe4f5311236168a109ca"
 *                     title:
 *                       type: string
 *                       example: "Buy groceries"
 *                     description:
 *                       type: string
 *                       example: "Milk, Bread, Cheese"
 *                     tags:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           label:
 *                             type: string
 *                             example: "Shopping"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.post('/', async (req, res) => {
  //console.log("req.body: ", req.body);
  try {
    if (req.body.tags.length > 0) {
      const tagNames = [];
      for (tag of req.body.tags) {
        tagNames.push(tag.label);
      }
      listsToUpdate = await List.find({ _id: { $in: req.body.inListNew } });
      // console.log("listsToUpdate: ", listsToUpdate);
      for (const list of listsToUpdate) {
        if (Array.isArray(list.tags)) {
          for (const tag of list.tags) {
            // Check if the tag's name is in tagNames before incrementing uses
            if (tagNames.includes(tag.label)) {
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

/**
 * @swagger
 * /todos:
 *   get:
 *     summary: Retrieve a list of todo entries
 *     description: Fetches todo entries for the authenticated user, including entries owned by the user or shared with the user's groups.
 *     tags:
 *       - Todo
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of todo entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: "60d0fe4f5311236168a109ca"
 *                   title:
 *                     type: string
 *                     example: "Buy groceries"
 *                   description:
 *                     type: string
 *                     example: "Milk, Bread, Cheese"
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         label:
 *                           type: string
 *                           example: "Shopping"
 *                   inListNew:
 *                     type: array
 *                     items:
 *                       type: string
 *                       example: "60d0fe4f5311236168a109ca"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/todos', authenticate, async (req, res) => {
  //console.log("\x1b[31mDEBUG\x1b[0m: req.body: ", req.user);
  try {
    let entries = [];
    if (req.user) {
      //console.log("req.user: ", req.user);
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

/**
 * @swagger
 * /todos/mobile:
 *   get:
 *     summary: Retrieve a list of todo entries for mobile
 *     description: Fetches todo entries for the user specified in the request headers. If no user is specified, returns limited entries for a guest user.
 *     tags:
 *       - Todo
 *     parameters:
 *       - in: header
 *         name: user
 *         schema:
 *           type: string
 *         required: false
 *         description: The username to fetch todo entries for
 *     responses:
 *       200:
 *         description: A list of todo entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: "60d0fe4f5311236168a109ca"
 *                   title:
 *                     type: string
 *                     example: "Buy groceries"
 *                   description:
 *                     type: string
 *                     example: "Milk, Bread, Cheese"
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         label:
 *                           type: string
 *                           example: "Shopping"
 *                   inList:
 *                     type: array
 *                     items:
 *                       type: string
 *                       example: "60d0fe4f5311236168a109ca"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/todos/mobile', async (req, res) => {
  console.log("mobile request works, hurray!!!");
  try {
    let entries = [];
    console.log("req.headers: ", req.headers.user);

    const user = await User.findOne({ _id: req.headers.user });

    if (user) {
      // If a username was provided, return users entries
      entries = await Todo.find({
        $or: [
          { owner: user._id },
          { owner: { $in: user.groups } }
        ]
      }).populate('inListNew'); //REMEMBER: observer and shared too
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

/**
 * @swagger
 * /done:
 *   patch:
 *     summary: Mark a task as done
 *     description: Updates a task to mark it as done and calculates the total time spent on the task.
 *     tags:
 *       - Todo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskId:
 *                 type: string
 *                 example: "60d0fe4f5311236168a109ca"
 *     responses:
 *       200:
 *         description: Task marked as done successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task marked as done successfully"
 *                 updatedTodo:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "60d0fe4f5311236168a109ca"
 *                     title:
 *                       type: string
 *                       example: "Buy groceries"
 *                     description:
 *                       type: string
 *                       example: "Milk, Bread, Cheese"
 *                     isDone:
 *                       type: boolean
 *                       example: true
 *                     completed:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-10-01T12:34:56.789Z"
 *                     totalTimeSpent:
 *                       type: number
 *                       example: 3600000
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.patch('/done', async (req, res) => {
  console.log(req.body);
  try {
    const { taskId } = req.body;

    // Fetch the document first
    const todo = await Todo.findById(taskId);

    if (!todo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Calculate the time difference
    const currentTime = new Date().getTime();
    const timeSpent = currentTime - new Date(todo.started).getTime();
    const totalTimeSpent = todo.totalTimeSpent + timeSpent;

    // Update the fields
    const updatedTodo = await Todo.findByIdAndUpdate(taskId, {
      isDone: true,
      completed: new Date(),
      $inc: { __v: 1 },
      totalTimeSpent: totalTimeSpent
    }, { new: true });

    res.status(200).json({ message: 'Task marked as done successfully', updatedTodo });
  } catch (error) {
    console.error('Error setting task to done:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /delete/{taskId}:
 *   delete:
 *     summary: Delete a task
 *     description: Deletes a task and updates the usage count of associated tags in lists.
 *     tags:
 *       - Todo
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the task to delete
 *     responses:
 *       200:
 *         description: Successfully deleted entry
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully deleted entry!"
 *       404:
 *         description: Entry not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Entry not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
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
      // console.log("listsToUpdate: ", listsToUpdate);

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
    await Todo.findByIdAndDelete(taskId);
    return res.status(200).json({ message: 'Successfully deleted entry!' });
  } catch (error) {
    console.error("Could not delete entry", error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /start:
 *   patch:
 *     summary: Mark a task as started
 *     description: Updates a task to mark it as started and sets the start date.
 *     tags:
 *       - Todo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskId:
 *                 type: string
 *                 description: The ID of the task to mark as started
 *                 example: "60d21b4667d0d8992e610c85"
 *     responses:
 *       200:
 *         description: Task marked as started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task marked as started successfully"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
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

/**
 * @swagger
 * /cancel:
 *   patch:
 *     summary: Cancel a task and track time spent
 *     description: Updates a task to mark it as canceled and calculates the total time spent on the task.
 *     tags:
 *       - Todo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskId:
 *                 type: string
 *                 description: The ID of the task to cancel
 *                 example: "60d21b4667d0d8992e610c85"
 *     responses:
 *       200:
 *         description: Task canceled and time tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task canceled and time tracked successfully"
 *                 updatedTodo:
 *                   type: object
 *                   description: The updated task object
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.patch('/cancel', async (req, res) => {
  try {
    const { taskId } = req.body;

    // Fetch the document first
    const todo = await Todo.findById(taskId);

    if (!todo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Calculate the time difference
    const currentTime = new Date().getTime();
    const timeSpent = currentTime - new Date(todo.started).getTime();
    const totalTimeSpent = todo.totalTimeSpent + timeSpent;

    // Update the fields
    const updatedTodo = await Todo.findByIdAndUpdate(taskId, {
      isStarted: false,
      started: null,
      $inc: { __v: 1 },
      totalTimeSpent: totalTimeSpent
    }, { new: true });

    res.status(200).json({ message: 'Task canceled and time tracked successfully', updatedTodo });
  } catch (error) {
    console.error('Error canceling task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /edit:
 *   patch:
 *     summary: Edit a task
 *     description: Updates a task with the provided details.
 *     tags:
 *       - Todo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskId:
 *                 type: string
 *                 description: The ID of the task to update
 *                 example: "60d21b4667d0d8992e610c85"
 *               updatedTask:
 *                 type: object
 *                 description: The updated task details
 *                 example: { "title": "New Task Title", "description": "Updated description" }
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task updated successfully"
 *                 updatedTodo:
 *                   type: object
 *                   description: The updated task object
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.patch('/edit', async (req, res) => {
  try {
    const { taskId, updatedTask } = req.body;

    const updatedTodo = await Todo.findOneAndUpdate(
      { _id: taskId },
      updatedTask,
      { new: true, runValidators: true }
    );

    if (!updatedTodo) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json({ message: 'Task updated successfully', updatedTodo });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /update:
 *   patch:
 *     summary: Update all tasks
 *     description: Updates all tasks in the Todo collection with the provided details.
 *     tags:
 *       - Todo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: The update details to apply to all tasks
 *             example: { "status": "completed" }
 *     responses:
 *       200:
 *         description: All entries updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "All entries updated successfully"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
//This endpoint is some early stage shinanigans and should be removed at some point
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

/**
 * @swagger
 * /stepComplete:
 *   patch:
 *     summary: Mark a step as completed
 *     description: Marks a specific step in a task as completed.
 *     tags:
 *       - Todo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskId:
 *                 type: string
 *                 description: The ID of the task
 *                 example: "60d21b4667d0d8992e610c85"
 *               stepId:
 *                 type: string
 *                 description: The ID of the step to mark as completed
 *                 example: "60d21b4667d0d8992e610c86"
 *     responses:
 *       200:
 *         description: Step marked as done successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Step marked as done successfully"
 *       404:
 *         description: Task or step not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
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

/**
 * @swagger
 * /stepUncomplete:
 *   patch:
 *     summary: Mark a step as uncompleted
 *     description: Marks a specific step in a task as uncompleted.
 *     tags:
 *       - Todo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskId:
 *                 type: string
 *                 description: The ID of the task
 *                 example: "60d21b4667d0d8992e610c85"
 *               stepId:
 *                 type: string
 *                 description: The ID of the step to mark as uncompleted
 *                 example: "60d21b4667d0d8992e610c86"
 *     responses:
 *       200:
 *         description: Step marked as undone successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Step marked as undone successfully"
 *       404:
 *         description: Task or step not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
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