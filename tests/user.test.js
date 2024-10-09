const request = require('supertest');
const expect = require('chai').expect;
const app = require('../server.js');
const User = require('../models/User');
const Todo = require('../models/Todo');
const List = require('../models/List');
const Group = require('../models/Group');
const { authenticate } = require('../middlewares/auth');

describe('POST /users/create', () => {
  after(async () => {
    await User.deleteMany();
    await List.deleteMany();
    await Todo.deleteMany();
    await Group.deleteMany();
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

describe('DELETE /users/delete-user/:id', () => {
  let testUser, userLists, userTodos, group, groupList;

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
  
    // Create a group with the user as the owner
    group = new Group({
      name: 'Test Group',
      owner: testUser._id,
      groupLists: [],
      members: [
        {
          member_id: testUser._id,
          role: 'moderator'
        }
      ]
    });
    await group.save();
  
    // Create a list for the group and add todos
    groupList = new List({ owner: group._id, type: 'groupList', listName: 'Group Test List' });
    await groupList.save();
  
    group.groupListsModel.push(groupList._id);
    await group.save();
  
    const groupTodos = [
      new Todo({ owner: group._id, description: 'Group Todo 1', list: groupList._id, isStarted: false, created: new Date(), isDone: false, task: 'Group Task' }),
      new Todo({ owner: group._id, description: 'Group Todo 2', list: groupList._id, isStarted: false, created: new Date(), isDone: false, task: 'Group Task2' }),
    ];
    await Todo.insertMany(groupTodos);
  });
  afterEach(async () => {
    await User.deleteMany();
    await List.deleteMany();
    await Todo.deleteMany();
    await Group.deleteMany();
  });

  it('Delete user and cleanup, single group member', async () => {
    // Call the Delete user endpoint
    await request(app)
      .delete(`/users/delete-user/${testUser._id}`)
      .expect(200);
  
    // Verify that all lists, todos, and the group are deleted
    const user = await User.findById(testUser._id);
    expect(user).to.be.null;
  
    const lists = await List.find({ owner: testUser._id });
    expect(lists.length).to.equal(0);
  
    const groupAfterDelete = await Group.findById(group._id);
    expect(groupAfterDelete).to.be.null;
  
    const groupTodosAfterDelete = await Todo.find({ owner: group._id });
    expect(groupTodosAfterDelete.length).to.equal(0);
  });

  it('Delete user and cleanup when there are other members in the group', async () => {
    const anotherUser = new User({ username: 'anotherUser', email:'test2.test@test.te', password: 'password' });
    await anotherUser.save();
  
    group.members.push({ member_id: anotherUser._id, role: 'edit' });
    await group.save();
    // console.log('DEBUG -- Groups in delete user test before delete: ', group);
  
    // Call the Delete user endpoint
    await request(app)
      .delete(`/users/delete-user/${testUser._id}`)
      .expect(200);
  
    // Verify that all lists and todos for the user are deleted
    const user = await User.findById(testUser._id);
    expect(user).to.be.null;
  
    const lists = await List.find({ owner: testUser._id });
    expect(lists.length).to.equal(0);
  
    const todos = await Todo.find({ owner: testUser._id });
    // console.log('Todos after user deletion:', todos); // Add logging here
    expect(todos.length).to.equal(0);
  
    // Verify that the group is not deleted
    const groupAfterDelete = await Group.findById(group._id);
    // console.log('DEBUG -- Groups in delete user test: ', groupAfterDelete);
    // console.log('Group after delete:', groupAfterDelete); // Add logging here
    expect(groupAfterDelete).to.not.be.null;
  
    // Verify that the initial user is removed from the group
    const updatedGroup = await Group.findById(group._id);
    const memberIds = updatedGroup.members.map(member => member.member_id.toString());
    expect(memberIds.length).to.equal(1); // Ensure only the other user is in the group
  
    // Verify that the todos for the group are not deleted
    const groupTodosAfterDelete = await Todo.find({ owner: group._id });
    // console.log('Group todos after delete:', groupTodosAfterDelete); // Add logging here
    expect(groupTodosAfterDelete.length).to.equal(2); // Ensure group todos are not deleted
  });

  it('should delete a user and his lists and todos if the user exists', async () => {
    const res = await request(app).delete(`/users/delete-user/${testUser._id}`);

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
    const res = await request(app).delete(`/users/delete-user/${nonExistentUserId}`);

    expect(res.status).to.equal(404);
  });

  it('should return 500 if there is an internal server error', async () => {
    // Simulate an internal server error by passing an invalid ID
    const invalidUserId = 'invalid-id';
    const res = await request(app).delete(`/users/delete-user/${invalidUserId}`);

    expect(res.status).to.equal(500);
  });
});