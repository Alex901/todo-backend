const mongoose = require('mongoose');
const User = require('./models/User'); // adjust the path according to your project structure
const Todo = require('./models/Todo');
const Group = require('./models/Group');
const List = require('./models/List');
const dotenv = require('dotenv');

dotenv.config();

async function updateUsers(users) {

        // Update each user
        for (const user of users) {

            let newListsIds = [];
            // update the user's lists
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
}

async function updateTodos(users, ListModel) {
    for (const user of users) {
      // Fetch user lists from the database
      const userLists = await ListModel.find({
        '_id': { $in: user.myLists }
      });
  
      // Fetch todos for the user
      const todos = await Todo.find({ owner: user.username });
  
      for (const todo of todos) {
        // Initialize inListNew as an empty array to store multiple references
        todo.inListNew = [];
  
        // Assuming inList is an array of list names. If it's a delimited string, split it into an array first.
        const listNames = Array.isArray(todo.inList) ? todo.inList : todo.inList.split(','); // Adjust the split delimiter as necessary
  
        for (const listName of listNames) {
          // Find the list reference based on the name
          const listForTodo = userLists.find(list => list.listName === listName.trim());
  
          if (listForTodo) {
            console.log(`List found for todo ${todo._id}: ${listForTodo._id}`);
            // If the list is found, add its reference to inListNew
            todo.inListNew.push(listForTodo._id);
          } else {
            // Handle cases where no corresponding list is found
            // This could involve setting a default list, logging an error, etc.
            // But, we should never get here if the data is clean and consistent - HEHE
          }
        }
  
        // Save the todo with updated inListNew
        await todo.save();
      }
    }
  }

async function main() {
    try {
        await mongoose.connect(process.env.DATABASE_URI, { dbName: 'todoDatabase' });
        console.log('Connected to the database');

        // Adjust the query as needed to fetch the desired users
        const users = await User.find({ username: 'test'}); // Empty filter to find all users

        // Call update functions
        await updateUsers(users);
        await updateTodos(users, List);
        // await updateGroups(users); // Uncomment when updateGroups is implemented

        console.log('Update process completed.');
    } catch (err) {
        console.error('Update process failed:', err);
    }
}

main().catch(err => console.error(err));