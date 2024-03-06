const express = require('express');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');

const router = express.Router();

router.get('/auth', authenticate, (req, res) => {
  res.json({ message: `Welcome ${req.user.username}` });
});


// POST /users/create - Create a new user
router.post('/create', async (req, res) => {
  console.log("Req body: ", req.body);
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).send(user);
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: error.toString() });
  }
});

// GET /users/:id - Get a specific user by their ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send();
    }
    res.send(user);
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

module.exports = router;