const request = require('supertest');
const expect = require('chai').expect;
const app = require('../server.js');
const User = require('../models/User');
const Todo = require('../models/Todo');
const List = require('../models/List');
const { authenticate } = require('../middlewares/auth');

describe('POST /users/create', () => {
  afterEach(async () => {
    await User.deleteMany();
    await List.deleteMany();
  }
  );
  it('should create a new user if username is unique', async () => {
    const user = { username: 'testUser', password: 'testPassword', email: 'testUser@example.com' };
    const res = await request(app)
      .post('/users/create')
      .send(user);

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('username', user.username);
  });

  it('should return 400 if username already exists', async () => {
    const user = { username: 'testUser', password: 'testPassword' };
    const res = await request(app)
      .post('/users/create')
      .send(user);

    expect(res.status).to.equal(400);
  });
});

describe('GET /users/:username', () => {
  beforeEach(async () => {
    await User.create({ username: 'testUser3', password: 'testPassword', email: 'testUser@example.com' });
  });
  afterEach(async () => {
    await User.deleteMany();
  });

  it('should return a user if the username exists', async () => {
    const username = 'testUser3';
    const res = await request(app).get(`/users/${username}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('username', username);
  });

  it('should return 404 if the username does not exist', async () => {
    const username = 'nonexistentUser';
    const res = await request(app).get(`/users/${username}`);

    expect(res.status).to.equal(404);
  });
});

describe('DELETE /users/:id', () => {
  let testUser;
  let userLists;
  let userTodos;

  beforeEach(async () => {
    // Create a test user
    testUser = new User({ username: 'testUser2', password: 'testPassword', email: 'test.test@test.te', myLists: [] });
    await testUser.save();

    // Create a list owned by the test user
    const list = new List({ owner: testUser._id, type: 'userList', listName: 'Test List' });
    await list.save();

    // Add the list to the user's lists
    testUser.myLists.push(list._id);
    await testUser.save();

    // Create some todos owned by the test user
    userTodos = [
      new Todo({ owner: testUser._id, description: 'Test Todo 1', list: list._id, isStarted: false, created: new Date(), isDone: false, task: 'Test Task' }),
      new Todo({ owner: testUser._id, description: 'Test Todo 2', list: list._id, isStarted: false, created: new Date(), isDone: false, task: 'Test Task2' }),
    ];
    await Todo.insertMany(userTodos);

    // Refresh the testUser and userLists
    testUser = await User.findOne({ username: 'testUser2' });
    userLists = testUser.myLists;
  });
  afterEach(async () => {
    await User.deleteMany();
    await List.deleteMany();
    await Todo.deleteMany();
  });

  it('should delete a user and his lists and todos if the user exists', async () => {
    const res = await request(app).delete(`/users/${testUser._id}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('_id', String(testUser._id));

    // Verify the lists are deleted
    for (const listId of userLists) {
      const list = await List.findById(listId);
      expect(list).to.be.null;
    }

    // Verify the todos are deleted
    for (const todo of userTodos) {
      const deletedTodo = await Todo.findById(todo._id);
      expect(deletedTodo).to.be.null;
    }
  });

  it('should return 404 if the user does not exist', async () => {
    const nonExistentUserId = '5f8d04f5b54764421b715f3d'; // This should be an ID that doesn't exist in the database
    const res = await request(app).delete(`/users/${nonExistentUserId}`);

    expect(res.status).to.equal(404);
  });

  it('should return 500 if there is an internal server error', async () => {
    // Simulate an internal server error by passing an invalid ID
    const invalidUserId = 'invalid-id';
    const res = await request(app).delete(`/users/${invalidUserId}`);

    expect(res.status).to.equal(500);
  });
});