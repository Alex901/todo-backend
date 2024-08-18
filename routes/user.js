const express = require('express');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');
const Todo = require('../models/Todo');
const List = require('../models/List');
const Group = require('../models/Group');
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

/**
 * @swagger
 * /auth:
 *   get:
 *     summary: Authenticate user
 *     description: Returns a welcome message for the authenticated user.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Welcome message for the authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Welcome johndoe"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 */
router.get('/auth', authenticate, (req, res) => {
  res.json({ message: `Welcome ${req.user.username}` });
});

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

/**
 * @swagger
 * /create:
 *   post:
 *     summary: Create a new user
 *     description: Creates a new user with the provided username and other details.
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "johndoe"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               email:
 *                 type: string
 *                 example: "johndoe@example.com"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *                 email:
 *                   type: string
 *                   example: "johndoe@example.com"
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Username is required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
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

/**
 * @swagger
 * /getall:
 *   get:
 *     summary: Get all users
 *     description: Retrieves a list of all users.
 *     tags:
 *       - User
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         description: Optional username to filter users (currently not used in the implementation)
 *     responses:
 *       200:
 *         description: A list of users
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
 *                   username:
 *                     type: string
 *                     example: "johndoe"
 *                   email:
 *                     type: string
 *                     example: "johndoe@example.com"
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
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

/**
 * @swagger
 * /{username}:
 *   get:
 *     summary: Get user by username
 *     description: Retrieves a user by their username and populates their lists.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: The username of the user
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *                 email:
 *                   type: string
 *                   example: "johndoe@example.com"
 *                 myLists:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "60d0fe4f5311236168a109cb"
 *                       name:
 *                         type: string
 *                         example: "Shopping List"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
router.get('/:username', async (req, res) => {
  console.log('Username: ', req.params.username);
  try {
    const user = await User.findOne({ username: req.params.username }).populate({
      path: 'myLists',
      populate: { path: 'owner' }
  })
  .populate({
      path: 'groups',
      populate: {
          path: 'members.member_id',
          model: 'User' // Replace 'User' with the actual model name if different
      }
  });
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

/**
 * @swagger
 * /edituser/{id}:
 *   patch:
 *     summary: Edit user details
 *     description: Updates user details including password if old and new passwords are provided.
 *     tags:
 *       - User
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userData:
 *                 type: object
 *                 description: The user data to update
 *                 example: 
 *                   email: "newemail@example.com"
 *                   username: "newusername"
 *               oldPassword:
 *                 type: string
 *                 description: The current password of the user
 *                 example: "oldpassword123"
 *               newPassword:
 *                 type: string
 *                 description: The new password for the user
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "newusername"
 *                 email:
 *                   type: string
 *                   example: "newemail@example.com"
 *       401:
 *         description: Old password is incorrect
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Old password is incorrect"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
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
    // Update the user data
    Object.assign(user, userData);


    // Save the updated user
    const updatedUser = await user.save();

    res.send(updatedUser);
  } catch (error) {
    res.status(500).send();
  }
});

/**
 * @swagger
 * /{id}:
 *   delete:
 *     summary: Delete a user and their associated data
 *     description: Deletes a user, their lists, todos, and handles group membership. If the user is the only member of a group, the group is deleted. Otherwise, the user is removed from the group.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to delete
 *     responses:
 *       200:
 *         description: User and associated data deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByIdAndDelete(userId);
    await List.deleteMany({ owner: req.params.id, type: 'userList' }); //Delete all user's lists
    await Todo.deleteMany({ owner: req.params.id }); //delete all entries for the user

    const groups = await Group.find({ members: userId });
    for (const group of groups) {
      if (group.members.length === 1) {
        // If the user is the only member, remove the group
        await Group.findByIdAndDelete(group._id);
      } else {
        // Otherwise, remove the user from the group
        group.members = group.members.filter(member => member.toString() !== userId);
        await group.save();
      }
    }

    if (!user) {
      return res.status(404).send();
    }
    res.send(user);
  } catch (error) {
    res.status(500).send();
  }
});

/**
 * @swagger
 * /setlist/{id}:
 *   patch:
 *     summary: Set active list for user
 *     description: Updates the active list for the user by their ID.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               activeList:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Shopping List"
 *     responses:
 *       200:
 *         description: Active list set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *                 activeList:
 *                   type: string
 *                   example: "Shopping List"
 *                 myLists:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "60d0fe4f5311236168a109cb"
 *                       listName:
 *                         type: string
 *                         example: "Shopping List"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
router.patch('/setlist/:id', async (req, res) => {
  //console.log('Req body: ', req.body);
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

/**
 * @swagger
 * /addlist/{id}:
 *   patch:
 *     summary: Add a new list to the user
 *     description: Adds a new list to the user's lists and sets it as the active list.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newListData:
 *                 type: object
 *                 properties:
 *                   listName:
 *                     type: string
 *                     example: "Shopping List"
 *                   description:
 *                     type: string
 *                     example: "A list for shopping items"
 *                   visibility:
 *                     type: string
 *                     example: "private"
 *     responses:
 *       200:
 *         description: List added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *                 activeList:
 *                   type: string
 *                   example: "shopping list"
 *                 myLists:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "60d0fe4f5311236168a109cb"
 *                       listName:
 *                         type: string
 *                         example: "shopping list"
 *                       description:
 *                         type: string
 *                         example: "A list for shopping items"
 *                       visibility:
 *                         type: string
 *                         example: "private"
 *       400:
 *         description: List name already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "List name already exists"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
router.patch('/addlist/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('myLists');
    if (!user) {
      return res.status(404).send();
    }

    const { listName, description, visibility } = req.body.newListData;
    const nameLowerCase = listName.toLowerCase();

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
      description: description || '',
    };
    user.listNames.push(newListOld);

    // For the new data structure
    const newListNew = new List({
      listName: nameLowerCase,
      owner: user._id,
      description: description || '',
      visibility: visibility || 'private', // Default to 'private' if not provided
    });
    await newListNew.save();
    user.myLists.push(newListNew._id);
    user.activeList = newListNew.listName;
    await user.save();

    const updatedUser = await User.findById(user._id).populate('myLists').exec();

    res.send(updatedUser);
  } catch (error) {
    console.error('Error adding list', error);
    console.error('Error', error.message);
    res.status(500).send('Internal server error');
  }
});


//TODO: Remember the group case !!!
/**
 * @swagger
 * /deletelist/{id}:
 *   delete:
 *     summary: Delete a list from the user
 *     description: Deletes a list from the user's lists and updates the active list.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               listName:
 *                 type: string
 *                 example: "Shopping List"
 *     responses:
 *       200:
 *         description: List deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *                 activeList:
 *                   type: string
 *                   example: "shopping list"
 *                 myLists:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "60d0fe4f5311236168a109cb"
 *                       listName:
 *                         type: string
 *                         example: "shopping list"
 *       400:
 *         description: Invalid list name or list name does not exist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid list name"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
router.delete('/deletelist/:id', async (req, res) => {
  // console.log('DEBUG -- Entering delete list:Req body.listName: ', req.body.listName);
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
      // console.log("DEBUG -- DeleteList -- User._id: ", user._id);
      // console.log("DEBUG -- DeleteList -- User.myLists: ", user.myLists);
      const listToDelete = await List.findOne({ listName: req.body.listName, owner: user._id });
      if (listToDelete) {
        // console.log("DEBUG -- DeleteList --List to delete: ", listToDelete);
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

/**
 * @swagger
 * /toggleurgent/{id}:
 *   patch:
 *     summary: Toggle urgent only setting for user's todo list
 *     description: Updates the 'urgentOnly' setting for the user's todo list.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings.todoList.urgentOnly:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Urgent only setting updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *                 settings:
 *                   type: object
 *                   properties:
 *                     todoList:
 *                       type: object
 *                       properties:
 *                         urgentOnly:
 *                           type: boolean
 *                           example: true
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
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

/**
 * @swagger
 * /addtag/{id}:
 *   patch:
 *     summary: Add a tag to a user's list
 *     description: Adds a new tag to the specified list in the user's lists.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               activeList:
 *                 type: string
 *                 example: "Shopping List"
 *               tagName:
 *                 type: string
 *                 example: "Urgent"
 *               tagColor:
 *                 type: string
 *                 example: "#FF0000"
 *               textColor:
 *                 type: string
 *                 example: "#FFFFFF"
 *     responses:
 *       200:
 *         description: Tag added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *                 myLists:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "60d0fe4f5311236168a109cb"
 *                       listName:
 *                         type: string
 *                         example: "Shopping List"
 *                       tags:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             label:
 *                               type: string
 *                               example: "Urgent"
 *                             color:
 *                               type: string
 *                               example: "#FF0000"
 *                             textColor:
 *                               type: string
 *                               example: "#FFFFFF"
 *                             uses:
 *                               type: number
 *                               example: 0
 *       404:
 *         description: User or list not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
router.patch('/addtag/:id', async (req, res) => {
  const user = await User.findById(req.params.id).populate('myLists');

  try {

    if (!user) {
      return res.status(404).send('User not found');
    }
    const activeList = req.body.activeList;
    const listToAddTagToo = user.myLists.find(list => list.listName === activeList);
    // console.log("DEBUG -- AddTag -- list to add tag too: ", listToAddTagToo);
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
        await allList.save(); // Save the "all" list to generate the _id for the new tag

        // Fetch the tag from the "all" list to ensure the _id is consistent
        const addedTag = allList.tags.find(tag => tag.label === newTag.label && tag.color === newTag.color && tag.textColor === newTag.textColor);
        if (addedTag) {
          listToAddTagToo.tags.push(addedTag);
          await listToAddTagToo.save(); // Save the specific user list with the new tag
        }
      }
    } else {
      // Add the new tag to the specific user list directly if it's the "all" list
      listToAddTagToo.tags.push(newTag);
      await listToAddTagToo.save();
    }

    res.status(200).send(user);
  } catch (error) {
    console.error('Error adding tag', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * @swagger
 * /deletetag/{id}:
 *   delete:
 *     summary: Delete a tag from a user's lists
 *     description: Deletes a tag from all lists in the user's lists if it is not in use.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tag:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: "60d0fe4f5311236168a109cb"
 *                   label:
 *                     type: string
 *                     example: "Urgent"
 *                   color:
 *                     type: string
 *                     example: "#FF0000"
 *                   textColor:
 *                     type: string
 *                     example: "#FFFFFF"
 *     responses:
 *       200:
 *         description: Tag deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *                 myLists:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "60d0fe4f5311236168a109cb"
 *                       listName:
 *                         type: string
 *                         example: "Shopping List"
 *                       tags:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             label:
 *                               type: string
 *                               example: "Urgent"
 *                             color:
 *                               type: string
 *                               example: "#FF0000"
 *                             textColor:
 *                               type: string
 *                               example: "#FFFFFF"
 *                             uses:
 *                               type: number
 *                               example: 0
 *       404:
 *         description: User or list not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not found"
 *       409:
 *         description: Tag is in use
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Tag is in use"
 *                 uses:
 *                   type: number
 *                   example: 5
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
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
          // console.log("DEBUG -- list.tags: ", list.tags);
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

/**
 * @swagger
 * /toggledetails/{id}:
 *   patch:
 *     summary: Toggle show details setting for user's todo list
 *     description: Updates the 'showListDetails' setting for the user's todo list.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings.todoList.showDetails:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Show details setting updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *                 settings:
 *                   type: object
 *                   properties:
 *                     todoList:
 *                       type: object
 *                       properties:
 *                         showListDetails:
 *                           type: boolean
 *                           example: true
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
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

/**
 * @swagger
 * /update-todo-settings/{id}:
 *   patch:
 *     summary: Update a specific setting in the user's todo list settings
 *     description: Updates a specific setting in the user's todo list settings.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settingName:
 *                 type: string
 *                 example: "showListDetails"
 *               value:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Setting updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *                 settings:
 *                   type: object
 *                   properties:
 *                     todoList:
 *                       type: object
 *                       properties:
 *                         showListDetails:
 *                           type: boolean
 *                           example: true
 *       400:
 *         description: Invalid setting name
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid setting name"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
router.patch('/update-todo-settings/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { settingName, value } = req.body;
    console.log('Setting name:', settingName);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update the specified setting
    if (user.settings.todoList.hasOwnProperty(settingName)) {
      user.settings.todoList[settingName] = value;
    } else {
      return res.status(400).json({ message: 'Invalid setting name' });
    }

    await user.save();

    res.status(200).json(user);
  } catch (error) {
    console.error('Error updating settings', error);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;