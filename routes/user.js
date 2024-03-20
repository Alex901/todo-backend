const express = require('express');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');
const Todo = require('../models/Todo');

const router = express.Router();

router.get('/auth', authenticate, (req, res) => {
  res.json({ message: `Welcome ${req.user.username}` });
});


// POST /users/create - Create a new user
router.post('/create', async (req, res) => {
  console.log("Req body: ", req.body);
  try {
    // Check if username is null
    if (!req.body.username) {
      console.log(req.body.username);
      return res.status(400).send({ error: 'Username is required' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: req.body.username });
    if (existingUser) {
      return res.status(400).send({ error: 'Username already exists' });
    }

    const user = new User(req.body);
    await user.save();
    res.status(201).send(user);
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: error.toString() });
  }
});

// GET /users/:id - Get a specific user by their ID
router.get('/:username', async (req, res) => {
  console.log('Username: ', req.params.username);
  try {
    const user = await User.findOne({ username: req.params.username } );
    if (!user) {
      console.log('User not found');
      return res.status(404).send({ message: 'User not found' });
    }
    console.log('User found: ', user);
    res.status(200).send(user);
  } catch (error) {
    res.status(500).send();
  }
});

// PATCH /users/:id - Update a specific user by their ID
router.patch('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!user) {
      return res.status(404).send();
    }
    res.send(user);
  } catch (error) {
    res.status(400).send(error);
  }
});

// DELETE /users/:id - Delete a specific user by their ID
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).send();
    }
    res.send(user);
  } catch (error) {
    res.status(500).send();
  }
});

// PATCH /users/set-active-list - Set the active list for a user
router.patch('/setlist/:id', async (req, res) => {
  console.log('Req body: ', req.body);
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { activeList: req.body.activeList }, { new: true });
    if (!user) {
      return res.status(404).send();
    }
    res.send(user);
  } catch (error) {
    console.error('Error setting active list', error);
    console.error('Error', error.message);
  }
});

router.patch('/addlist/:id', async (req, res) => {
  console.log('Req body: ', req.body);
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send();
    }
    if (user.listNames.includes(req.body.listName)) {
      return res.status(400).send({ error: 'List name already exists' });
    }
    user.listNames.push(req.body.listName);
    user.activeList = req.body.listName;
    await user.save();
    res.send(user);
  } catch (error) {
    console.error('Error adding list', error);
    console.error('Error', error.message);
  }
});

router.delete('/deletelist/:id', async (req, res) => {
  console.log('Req body: ', req.body);
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send();
    } 
    if (!user.listNames.includes(req.body.listName)) {
      return res.status(400).send({ error: 'List name does not exist' });
    }
    //delete entries in the deleted list
    await Todo.deleteMany({ inList: { $in: [req.body.listName] }});

    //update the user's listNames
    user.listNames = user.listNames.filter(listName => listName !== req.body.listName);
    user.activeList = user.listNames[0];
    await user.save();

    res.send(user);
  } catch (error) {
    console.error('Error deleting list', error);
    console.error('Error', error.message);
  }
});

router.patch('/toggleurgent/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    // Update the 'urgentOnly' field
    user.settings.todoList.urgentOnly = req.body['settings.todoList.urgentOnly'];
    await user.save();

    res.status(200).send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.toString() });
  }
});



module.exports = router;