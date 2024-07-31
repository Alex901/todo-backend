const express = require('express');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');
const Todo = require('../models/Todo');
const List = require('../models/List');
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
      const user = await User.findById(req.params.id).populate('myLists').populate('groups');
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

// GET /users/getall - Get all users
router.get('/getall', authenticate, async (req, res) => {
  try {
    const username = req.query.username;
    const users = await User.find({});
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users', error);
    res.status(500).send('Internal server error');
  }
});

// GET /users/:id - Get a specific user by their ID
router.get('/:username', async (req, res) => {
  console.log('Username: ', req.params.username);
  try {
    const user = await User.findOne({ username: req.params.username }).populate('myLists');
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
    await List.deleteMany({ owner: req.params.id, type: 'userList' }); //Delete all user's lists
    await Todo.deleteMany({ owner: req.params.id }); //delete all entries for the user
    if (!user) {
      return res.status(404).send();
    }
    res.send(user);
  } catch (error) {
    res.status(500).send();
  }
});

// PATCH /users/set-active-list - Set the active list for a user
// Updated
router.patch('/setlist/:id', async (req, res) => {
  console.log('Req body: ', req.body);
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { activeList: req.body.activeList.name }, { new: true }).populate('myLists');
    if (!user) {
      return res.status(404).send();
    }
    //console.log("active list:", req.body.activeList)
    //console.log("DEBUG -- set list: user", user.myLists)
    for (let list of user.myLists) {
      if (list.listName === req.body.activeList) {
        user.activeList = list.listName;
      }
    }

    await user.save();
    res.send(user);
  } catch (error) {
    console.error('Error setting active list', error);
    console.error('Error', error.message);
  }
});
//TODO: remember group list case!!!!
//Updated
router.patch('/addlist/:id', async (req, res) => {
  //console.log('Req body: ', req.body);
  try {
    const user = await User.findById(req.params.id).populate('myLists');
    if (!user) {
      return res.status(404).send();
    }
    const nameLowerCase = req.body.listName.toLowerCase();
    // Check if the list name already exists in the old data structure
    const isListNameExistsInOldStructure = user.listNames.some(list => list.name === nameLowerCase);
    // Check if the list name already exists in the new data structure
    const isListNameExistsInNewStructure = await List.exists({ listName: nameLowerCase, owner: user._id });

    if (isListNameExistsInOldStructure || isListNameExistsInNewStructure) {
      return res.status(400).send({ error: 'List name already exists' });
    }

    // For the old data structure
    const newListOld = {
      name: nameLowerCase,
      tags: [],
      description: '',
    };
    user.listNames.push(newListOld);

    // For the new data structure
    const newListNew = new List({
      listName: nameLowerCase,
      owner: user._id,
    });
    await newListNew.save();
    user.myLists.push(newListNew._id);
    user.activeList = newListNew.listName;
    await user.save();
    console.log("DEBUG -- AddList -- User: ", user);

    const updatedUser = await User.findById(user._id).populate('myLists').exec();

    res.send(updatedUser);
  } catch (error) {
    console.error('Error adding list', error);
    console.error('Error', error.message);
  }
});


//TODO: Remember the group case !!!
// Updated(except group) 
router.delete('/deletelist/:id', async (req, res) => {
  console.log('DEBUG -- Entering delete list:Req body.listName: ', req.body.listName);
  try {
    const user = await User.findById(req.params.id);
    //console.log("User: ", user);
    if (!user) {
      return res.status(404).send();
    }
    if (!req.body.listName || typeof req.body.listName !== 'string') {
      return res.status(400).send({ error: 'Invalid list name' });
    }

    // New functionality for the updated data model
    if (user.myLists && Array.isArray(user.myLists) && user.myLists.length > 0) {
      await user.populate('myLists');
      console.log("DEBUG -- DeleteList -- User._id: ", user._id);
      console.log("DEBUG -- DeleteList -- User.myLists: ", user.myLists);
      const listToDelete = await List.findOne({ listName: req.body.listName, owner: user._id });
      if (listToDelete) {
        console.log("DEBUG -- DeleteList --List to delete: ", listToDelete);
        await List.deleteOne({ _id: listToDelete._id });

        // Update the user's myLists by filtering out the deleted list's ID
        // Dead references will be removed here too
        user.myLists = user.myLists.filter(listId => !listId._id.equals(listToDelete._id));
        if (user.myLists.length > 0) {
          user.activeList = user.myLists[0].listName;
        } else {
          user.activeList = '';
        }
        await Todo.deleteMany({ inListNew: { $in: [listToDelete._id] } })
        await user.save();
      }
    }

    // Existing functionality for deleting entries in the list and updating listNames
    if (user.listNames && user.listNames.some(list => list.name === req.body.listName)) {
      await Todo.deleteMany({ inList: { $in: [req.body.listName] } });
      user.listNames = user.listNames.filter(list => list.name !== req.body.listName);
      await user.save();
    } else if (!user.myLists) {
      // If the list name does not exist in the old model and myLists is not used
      return res.status(400).send({ error: 'List name does not exist' });
    }

    res.send(user);
  } catch (error) {
    console.error('Error deleting list', error);
    res.status(500).send({ error: 'An error occurred while deleting the list' });
  }
});

router.patch('/toggleurgent/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('myLists').populate('groups');
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
  const user = await User.findById(req.params.id).populate('myLists');

  try {

    if (!user) {
      return res.status(404).send('User not found');
    }
    const activeList = req.body.activeList;
    const listToAddTagToo = user.myLists.find(list => list.listName === activeList);
    console.log("DEBUG -- AddTag -- list to add tag too: ", listToAddTagToo);
    if (!listToAddTagToo) {
      return res.status(404).send('List not found');
    }
    if (!listToAddTagToo) {
      return res.status(404).send('List not found');
    }

    const newTag = {
      label: req.body.tagName,
      color: req.body.tagColor,
      textColor: req.body.textColor,
      uses: 0
    };

    if (activeList !== 'all' && listToAddTagToo.type === 'userList') {
      const allList = user.myLists.find(list => list.listName === 'all');
      if (allList) {
        allList.tags.push(newTag);
        await allList.save(); // Save the "all" list with the new tag
      }
    }

    console.log("DEBUG -- AddTag -- listNew.tags: ", listToAddTagToo.tags);
    listToAddTagToo.tags.push(newTag);
    await listToAddTagToo.save();

    res.status(200).send(user);
  } catch (error) {
    console.error('Error adding tag', error);
    res.status(500).send('Internal server error');
  }
});

router.delete('/deletetag/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('myLists');
    if (!user) {
      return res.status(404).send('User not found');
    }
    console.log("\x1b[31mDEBUG\x1b[0m -- tag to delete: ", req.body.tag);
    const tagId = req.body.tag._id;

    for (const list of user.myLists) {
      for (tag of list.tags) {
        if (tag._id == tagId || (tag.label === req.body.tag.label && tag.color === req.body.tag.color && tag.textColor === req.body.tag.textColor)) { //Find base tag
          console.log("\x1b[31mDEBUG\x1b[0m -- tag found: ", tag);
          if (tag.uses > 0) {
            return res.status(409).json({ message: 'Tag is in use', uses: tag.uses });
          }
          list.tags = list.tags.filter(tag =>
            !(tag._id == tagId || (tag.label === req.body.tag.label && tag.color === req.body.tag.color && tag.textColor === req.body.tag.textColor))
          );
          console.log("DEBUG -- list.tags: ", list.tags);
        }
      }
      await list.save();
    }

    await user.save();

    res.status(200).send(user);
  } catch (error) {
    console.error('Error deleting tag', error);
    res.status(500).send('Internal server error');
  }
});

router.patch('/toggledetails/:id', async (req, res) => {
  try {
      const userId = req.params.id;
      const { "settings.todoList.showDetails": newShowDetailsStatus } = req.body;

      const user = await User.findById(userId);
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      user.settings.todoList.showListDetails = newShowDetailsStatus;
      await user.save();

      res.status(200).json(user);
  } catch (error) {
      console.error('Error toggling show details setting', error);
      res.status(500).send('Internal server error');
  }
});

module.exports = router;