const express = require('express');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');
const Todo = require('../models/Todo');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
require('dotenv').config({ path: './config/.env' });

const router = express.Router();


const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multer.memoryStorage() });

const base64Key = process.env.GOOGLE_CLOUD_KEYFILE;
const decodedKey = Buffer.from(base64Key, 'base64').toString();

const serviceAccount = JSON.parse(decodedKey);

const storage = new Storage({
  projectId: serviceAccount.project_id,
  credentials: serviceAccount,
});

const bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET_NAME);


router.get('/auth', authenticate, (req, res) => {
  res.json({ message: `Welcome ${req.user.username}` });
});

//Update profile picture
router.patch('/updateprofilepicture/:id', authenticate, upload.single('avatar'), async (req, res) => {
  console.log("Service Account ", serviceAccount);
  if (!req.file) {
    res.status(400).send('No file uploaded.');
    return;
  }

  // Create a new blob in the bucket and upload the file data to the blob
  const blob = bucket.file(req.file.originalname);
  const blobStream = blob.createWriteStream();

  blobStream.on('error', err => {
    console.error('Error uploading file', err);
    res.status(500).send('Internal server error');
  });

  blobStream.on('finish', async () => {
    // The file upload is complete
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).send('User not found');
      }

      user.profilePicture = publicUrl;

      await user.save();

      res.status(200).send(user);
    } catch (error) {
      console.error('Error updating profile picture', error);
      res.status(500).send('Internal server error');
    }
  });

  blobStream.end(req.file.buffer);
});

// POST /users/create - Create a new user
router.post('/create', async (req, res) => {
//  console.log("Req body: ", req.body);
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
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      console.log('User not found');
      return res.status(404).send({ message: 'User not found' });
    }
   // console.log('User found: ', user);
    res.status(200).send(user);
  } catch (error) {
    res.status(500).send();
  }
});

// PATCH /users/edituser/:id - Update a specific user by their ID
router.patch('/edituser/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send();
    }
    const { userData, oldPassword, newPassword } = req.body;

    // If oldPassword and newPassword are provided, authenticate the old password
    if (oldPassword && newPassword) {
      const isMatch = await user.comparePassword(oldPassword);
      console.log("isMatch: ", isMatch);
      if (!isMatch) {
        return res.status(401).send({ message: 'Old password is incorrect' });
      }
      // Set the password to the new password
      user.set({ password: newPassword });
      userData.password = newPassword;
      console.log("newPassword: ", user.password);
    }

    // console.log("userData: ", userData);
    console.log("User pre: ", user);
    console.log("User data pre: ", userData);
    // Update the user data
    Object.assign(user, userData);
    console.log("User post: ", user);
    console.log("User data post: ", userData);

    // Save the updated user
    const updatedUser = await user.save();

    res.send(updatedUser);
  } catch (error) {
    res.status(500).send();
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
    console.log("active list", req.body.activeList)
    user.activeList = req.body.activeList;
    await user.save();
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
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send();
    }
    if (!user.listNames.some(list => list.name === req.body.listName)) {
      return res.status(400).send({ error: 'List name does not exist' });
    }
    //delete entries in the deleted list
    await Todo.deleteMany({ inList: { $in: [req.body.listName] } });

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
    user.activeList = activeList;

    //IF i want to add all tags to "all" too, this is where i do it. 

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