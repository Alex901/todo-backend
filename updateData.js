const mongoose = require('mongoose');
const User = require('./models/User'); // adjust the path according to your project structure
const Todo = require('./models/Todo');
const Group = require('./models/Group');
const List = require('./models/List');
const dotenv = require('dotenv');

dotenv.config();

async function updateUsers() {
    try {
        // Connect to MongoDB database
        await mongoose.connect(process.env.DATABASE_URI, {
            dbName: 'todoDatabase',
        });
        console.log('Connected to the database');

        const users = await User.find({ username: 'test' });

        // Update each user
        for (const user of users) {

            let newListsIds = [];

            for (const listNameObj of user.listNames) {
                // Check if a list with the same name and owner already exists
                let list = await List.findOne({ listName: listNameObj.name, owner: user._id });

                if (!list) {
                    // Create a new List document if it doesn't exist
                    list = new List({
                        listName: listNameObj.name,
                        description: listNameObj.description || '',
                        type: 'userList', // Assuming these are user lists. Adjust as necessary.
                        visibility: 'private', // Adjust based on your requirements
                        entries: 0, // Adjust if you have a way to calculate entries
                        owner: user._id,
                        tags: listNameObj.tags.map(tag => ({
                            label: tag.label,
                            color: tag.color,
                            textColor: tag.textColor,
                            usages: tag.uses,
                        })),
                    });

                    await list.save();
                }
                newListsIds.push(list._id);
            }
            user.myLists = newListsIds;
            await user.save();
        }
    } catch (err) {
        console.error(err);
    }
}

updateUsers()
  .then(() => console.log('Update process completed.'))
  .catch((err) => console.error('Update process failed:', err));