const mongoose = require('mongoose');
const { expect } = require('chai');
const User = require('../models/User'); // Adjust the path to your User model
const List = require('../models/List'); // Adjust the path to your List model
const Todo = require('../models/Todo'); // Adjust the path to your Todo model

describe('Database Tests', () => {
  before(async () => {
    // Connect to the test database
    await mongoose.connect(process.env.DATABASE_URI, { dbName: 'habitForgeTest' });
  });

  after(async () => {
    // Disconnect from the database
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Setup: Create necessary data before each test
    await User.create({ username: 'testuser', password: 'password' });
    await List.create({ name: 'Test List', tags: [{ label: 'urgent', uses: 0 }] });
  });

  afterEach(async () => {
    // Teardown: Clean up the database after each test
   // await User.deleteMany({});
    //await List.deleteMany({});
    //await Todo.deleteMany({});
  });

  it('should create a new todo entry with a valid user and list', async () => {
    const user = await User.findOne({ username: 'testuser' });
    const list = await List.findOne({ name: 'Test List' });

    const newTodo = {
      title: 'Test Todo with User and List',
      description: 'This is a test todo with user and list',
      tags: [{ label: 'urgent' }],
      inListNew: [list._id],
      user: user._id
    };

    const todo = await Todo.create(newTodo);

    expect(todo.title).to.equal(newTodo.title);
    expect(todo.description).to.equal(newTodo.description);
    expect(todo.user.toString()).to.equal(user._id.toString());
    expect(todo.inListNew[0].toString()).to.equal(list._id.toString());

    const updatedList = await List.findById(list._id);
    expect(updatedList.tags[0].uses).to.equal(1);
  });
});