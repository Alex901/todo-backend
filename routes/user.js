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
    const user = await User.findByIdAndUpdate(req.params.id, { activeList: req.body.activeList.name }, { new: true });
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
    if (user.listNames.some(list => list.name === req.body.listName)) {
      return res.status(400).send({ error: 'List name already exists' });
    }
    const newList = {
      name: req.body.listName,
      tags: [],
      description: '',
    };
    user.listNames.push(newList);
    user.activeList = newList.name;
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
    if (!user.listNames.some(list => list.name === req.body.listName)) {
      return res.status(400).send({ error: 'List name does not exist' });
    }
    //delete entries in the deleted list
    await Todo.deleteMany({ inList: { $in: [req.body.listName] }});

    //update the user's listNames
    user.listNames = user.listNames.filter(list => list.name !== req.body.listName);
    user.activeList = user.listNames[0] ? user.listNames[0].name : '';
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

router.patch('/addtag/:id', async (req, res) => {

  try {
      const user = await User.findById(req.params.id);
      if (!user) {
          return res.status(404).send('User not found');
      }
      const activeList = req.body.activeList;
      const list = user.listNames.find(list => list.name === activeList);
      if (!list) {
          return res.status(404).send('List not found');
      }

      const newTag = {
          label: req.body.tagName,
          color: req.body.tagColor,
          textColor: req.body.textColor,
          uses: 0
      };

      list.tags.push(newTag);

      await user.save();

      res.status(200).send(user);
  } catch (error) {
      console.error('Error adding tag', error);
      res.status(500).send('Internal server error');
  }
});

router.delete('/deletetag/:id', async (req, res) => {
  try {
      const user = await User.findById(req.params.id);
      if (!user) {
          return res.status(404).send('User not found');
      }

      const activeList = req.body.activeList;
      const tagName = req.body.tagName;

      const list = user.listNames.find(list => list.name === activeList);
      if (!list) {
          return res.status(404).send('List not found');
      }

      const tagIndex = list.tags.findIndex(tag => tag.label === tagName);
      if (tagIndex === -1) {
          return res.status(404).send('Tag not found');
      }

      list.tags.splice(tagIndex, 1);

      await user.save();

      res.status(200).send(user);
  } catch (error) {
      console.error('Error deleting tag', error);
      res.status(500).send('Internal server error');
  }
});



module.exports = router;