const express = require('express');
const { authenticate } = require('../middlewares/auth');
const User = require('../models/User');
const Todo = require('../models/Todo');
const List = require('../models/List');
const Group = require('../models/Group');
const Notification = require('../models/Notification');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const jwt = require('jsonwebtoken');
const sendMail = require('../utils/mailer');
const { ensureLatestRequest, validateLatestRequest } = require('../middlewares/latestRequestMiddleware');

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
  // console.log("Service Account ", serviceAccount);
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
  // console.log("Req body: ", req.body);
  try {
    // Check if username is null
    if (!req.body.username) {
      // console.log(req.body.username);
      return res.status(400).send({ error: 'Username is required' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: req.body.username });
    if (existingUser) {
      return res.status(400).send({ error: 'Username already exists' });
    }

    const existingEmail = await User.findOne({ email: req.body.email });
    if (existingEmail) {
      return res.status(409).send({ error: 'Email already exists' });
    }

    const user = new User(req.body);
    await user.save();

    let token;

    if (!user.verified) {
      // console.log('User not verified, sending activation email');
      // console.log('Key components: ', user._id, process.env.SECRET_KEY);
      token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: '24h' });
      user.activationToken = token;
      await user.save();
    }

    const activationLink = `${req.protocol}://${req.get('host')}/auth/activate/${token}`;
    const activationHtmlLink = `<a href="${activationLink}">activate your account</a>`;

    if (req.body.isInvite) {
      // Send invitation email
      await sendMail(user.email, 'You are invited!', `You have been invited to https://habitforge.se. <br> Your <strong> username </strong> is <u> ${user.username} </u> and your <strong> password </strong> is <u> ${req.body.password}. </u> <hr> Upon first login you are able to change your credentials!`);
    } else {
      if (user.verified === false || user.verified === undefined) {
        // console.log('Activation link: ', activationLink);
        await sendMail(
    user.email,
    'Welcome to Habitforge! Activate your account',
    `Welcome to Habitforge! <br><br> We're thrilled to have you join our community. <br><br> Here comes your link to activate your account: <br> ${activationHtmlLink} <br><br> We hope you'll enjoy your stay and achieve great things with us!`
);
      }
    }

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
    let user = null;

    if (req.params.username.includes('@')) {
      user = await User.findOne({ email: req.params.username }).populate({
        path: 'myLists',
        populate: { path: 'owner' }
      })
        .populate({
          path: 'groups',
          populate: {
            path: 'members.member_id',
            model: 'User'
          }
        });
    } else {
      user = await User.findOne({ username: req.params.username }).populate({
        path: 'myLists',
        populate: { path: 'owner' }
      })
        .populate({
          path: 'groups',
          populate: {
            path: 'members.member_id',
            model: 'User'
          }
        });
    }

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

    if (!user.googleRegistration && user.__v === 0) {
      if (oldPassword && newPassword) {
        const isMatch = await user.comparePassword(oldPassword);
        console.log("isMatch: ", isMatch);
        if (!isMatch) {
          return res.status(401).send({ message: 'Old password is incorrect' });
        }
        // Set the password to the new password
        user.set({ password: newPassword });
        user.__v++;
        userData.password = newPassword;
        console.log("newPassword: ", user.password);
      }
    } else {
      user.set({ password: newPassword });
      userData.password = newPassword;
      user.__v++;
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
 * /delete-user/{id}:
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
 *                 error:
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
router.delete('/delete-user/:id', async (req, res) => {
  try {
    // console.log('DEBUG -- Delete user:', req.params);
    const userId = req.params.id;
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    await List.deleteMany({ owner: req.params.id, type: 'userList' }); //Delete all user's lists
    await Todo.deleteMany({ owner: req.params.id }); //delete all entries for the user

    const groups = await Group.find({ 'members.member_id': userId });
    //console.log('DEBUG -- Groups in delete user: ', groups);
    for (const group of groups) {
      if (group.members.length === 1) {
        // Find and delete all Todos where owner === group._id
        await Todo.deleteMany({ owner: group._id });

        // If the user is the only member, remove the group
        await Group.findByIdAndDelete(group._id);
      } else {
        // Otherwise, remove the user from the group
        group.members = group.members.filter(member => member.member_id.toString() !== userId.toString());
        await group.save();
      }
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


    // Check if the list name already exists in the new data structure
    const isListNameExistsInNewStructure = await List.exists({ listName: nameLowerCase, owner: user._id });

    if (isListNameExistsInNewStructure) {
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
 *                 message:
 *                   type: string
 *                   example: "List deleted successfully"
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
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "An error occurred while deleting the list"
 */
router.delete('/deletelist/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    if (!req.body.listName || typeof req.body.listName !== 'string') {
      return res.status(400).send({ error: 'Invalid list name' });
    }

    // Find the list to delete
    const listToDelete = await List.findOne({ listName: req.body.listName, owner: user._id });
    // console.log("List to delete: ", listToDelete);  
    if (!listToDelete) {
      return res.status(404).send({ error: 'List not found' });
    }

    // Delete the list (middleware will handle the cleanup)
    await listToDelete.deleteOne();

    res.status(200).send({ message: 'List deleted successfully' });
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
router.patch('/update-todo-settings/:id', ensureLatestRequest, validateLatestRequest, async (req, res) => {
  try {
    const userId = req.params.id;
    const { settingName, value } = req.body;
    console.log('Setting name:', settingName);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let settingFound = false;

    // Iterate through all settings and their categories
    for (const category in user.settings) {
      if (typeof user.settings[category] === 'object' && user.settings[category] !== null) {
        if (user.settings[category].hasOwnProperty(settingName)) {
          user.settings[category][settingName] = value;
          settingFound = true;
          break;
        }
      } else if (category === settingName) {
        user.settings[category] = value;
        settingFound = true;
        break;
      }
    }

    if (!settingFound) {
      return res.status(400).json({ message: 'Invalid setting name' });
    }

    await user.save();

    res.status(200).json(user);
  } catch (error) {
    console.error('Error updating settings', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * @swagger
 * /edit-user-list/{userId}:
 *   patch:
 *     summary: Edit a user's list
 *     description: Update a specific list for a user with new data.
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               listToEdit:
 *                 type: string
 *                 description: ID of the list to edit
 *                 example: "60d0fe4f5311236168a109cb"
 *               editedListData:
 *                 type: object
 *                 description: New data for the list
 *                 example: { "title": "Updated List Title", "items": ["item1", "item2"] }
 *     responses:
 *       200:
 *         description: List edited successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "List edited successfully"
 *                 list:
 *                   type: object
 *                   description: The updated list
 *                   example: { "_id": "60d0fe4f5311236168a109cb", "title": "Updated List Title", "items": ["item1", "item2"] }
 *       404:
 *         description: User or List not found
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
router.patch('/edit-user-list/:userId', async (req, res) => {
  const { userId } = req.params;
  const { listToEdit, editedListData } = req.body;
  console.log("DEBUG -- listToEdit: ", listToEdit);
  console.log("DEBUG -- editedListData: ", editedListData);

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const listExists = user.myLists.some(listId => listId.toString() === listToEdit);
    if (!listExists) {
      return res.status(404).json({ message: 'List not found in user\'s lists' });
    }

    const list = await List.findById(listToEdit);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    // Update the list with the new data
    list.set(editedListData);
    await list.save();

    if (user.settings.activeView === 'list') {
      user.activeList = editedListData.listName || list.listName; // Update active list if listName is provided
      await user.save();
    }

    res.status(200).json({ message: 'List edited successfully', list });
  } catch (error) {
    console.error('Error editing list', error);
    res.status(500).send('Internal server error');
  }
});

router.patch('/complete-project/:userId', async (req, res) => {
  const { userId } = req.params;
  const { projectId } = req.body;

  try {
    // Step 1: Find the project
    const project = await List.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Step 2: Check if the project is personal or group
    if (project.type === 'userList') {
      // Handle personal project
      if (project.owner.toString() !== userId) {
        return res.status(403).json({ message: 'You are not authorized to complete this project' });
      }

      // Save scores for later use
      const { score, currency } = project.score;
      console.log('Score:', score, 'Currency:', currency);

      // Mark project as completed
      project.completed = true;
      await project.save();

      // Reward the user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      user.settings.score += score;
      user.settings.currency += currency;
      await user.save();

      // Notify the user
      const notification = new Notification({
        to: [userId],
        type: 'award',
        message: `You have completed a project. You have been awarded ${score.toFixed(1)} points and ${currency} coins for your efforts.                 well done`
      });
      await notification.save();

      return res.status(200).json({ message: 'Project completed successfully', project });
    } else if (project.type === 'groupList') {
      // Handle group project
      const group = await Group.findById(project.owner).populate('members.member_id');
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Check if the user is a member with sufficient permissions
      const member = group.members.find(m => m.member_id._id.toString() === userId);
      if (!member || (member.role !== 'edit' && member.role !== 'moderator')) {
        return res.status(403).json({ message: 'You do not have permission to complete this project' });
      }

      // Save scores for later use
      const { score, currency } = project.score;
      console.log('Score:', score, 'Currency:', currency);

      // Mark project as completed
      project.completed = true;
      await project.save();

      // Reward each group member
      for (const groupMember of group.members) {
        const user = groupMember.member_id;
        user.settings.score += score;
        user.settings.score += currency;
        await user.save();

        // Notify each member
        const notification = new Notification({
          to: [user._id],
          type: 'award',
          message: `The group as completed "**${project.listName}**". has been completed. You have been awarded ${score.toFixed(1)} points and ${currency} coins.`
        });
        await notification.save();
      }

      return res.status(200).json({ message: 'Group project completed successfully', project });
    } else {
      return res.status(400).json({ message: 'Invalid project type' });
    }
  } catch (error) {
    console.error('Error completing project', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/revive-project/:userId', async (req, res) => {
  const { userId } = req.params;
  const { projectId, reviveCost } = req.body;

  try {
    // Step 1: Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Step 2: Check if the user has enough currency
    if (user.settings.currency < reviveCost) {
      return res.status(400).json({ message: 'Not enough currency to revive the project' });
    }

    // Step 3: Find the project
    const project = await List.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Step 4: Mark the project as not completed
    project.completed = false;
    await project.save();

    // Step 5: Deduct the revive cost from the user's currency
    user.settings.currency -= reviveCost;
    await user.save();

    // Step 6: Notify the user about the revival
    const notification = new Notification({
      to: [userId],
      type: 'info',
      message: `You have successfully revived the project ${project.listName}.`
    });
    await notification.save();

    return res.status(200).json({ message: 'Project revived successfully', project });
  } catch (error) {
    console.error('Error reviving project', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;