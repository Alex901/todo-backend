const request = require('supertest');
const { expect } = require('chai');
const app = require('../server.js'); // Adjust the path to your app
const Todo = require('../models/Todo'); // Adjust the path to your Todo model
const List = require('../models/List'); // Adjust the path to your List model
const User = require('../models/User'); // Adjust the path to your User model

let user;
let list;

beforeEach(async () => {
  // Setup: Create necessary data before each test
  user = await User.create({ username: 'testuser', email: 'test@test.te', password: 'password' });
  list = await List.create({ listName: 'Test List', owner: user._id });
});

afterEach(async () => {
  // Cleanup: Remove all data after each test
  await User.deleteMany();
  await List.deleteMany();
  await Todo.deleteMany();
});

describe('POST /api/', () => {
  it('should create a new todo entry successfully', async () => {
    const newTodo = {
      task: 'Test Todo',
      description: 'This is a test todo',
      inListNew: [list._id],
      owner: user._id,
      isStarted: false,
      created: new Date(),
      isDone: false
    };

    const res = await request(app)
      .post('/api/')
      .send(newTodo);

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('message', 'Todo entry created successfully');
    expect(res.body).to.have.property('todo');
    expect(res.body.todo).to.include(newTodo);
  });

  it('should handle errors when creating a new todo entry', async () => {
    const newTodo = {
      task: 'Test Todo with Error',
      description: 'This is a test todo that will cause an error',
      inListNew: ['invalid_id'], // Invalid list ID to cause an error
      owner: user._id,
      isStarted: false,
      created: new Date(),
      isDone: false
    };

    const res = await request(app)
      .post('/api/')
      .send(newTodo);

    expect(res.status).to.equal(500);
    expect(res.body).to.have.property('message', 'Internal server error');
  });
});

describe('PATCH /api/edit', () => {
  let todo;

  beforeEach(async () => {
    // Create a todo entry before each test
    todo = await Todo.create({
      task: 'Test Todo',
      description: 'This is a test todo',
      inListNew: [list._id],
      owner: user._id,
      isStarted: false,
      created: new Date(),
      isDone: false
    });
  });

  it('should update a todo entry successfully', async () => {
    const updatedTask = {
      task: 'Updated Test Todo',
      description: 'This is an updated test todo'
    };

    const res = await request(app)
      .patch('/api/edit')
      .send({ taskId: todo._id, updatedTask });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('message', 'Task updated successfully');
    expect(res.body.updatedTodo).to.include(updatedTask);
  });

  it('should handle errors when updating a todo entry', async () => {
    const updatedTask = {
      task: 'Updated Test Todo with Error',
      description: 'This is an updated test todo that will cause an error'
    };

    const res = await request(app)
      .patch('/api/edit')
      .send({ taskId: 'invalid_id', updatedTask });

    expect(res.status).to.equal(500);
    expect(res.body).to.have.property('message', 'Internal server error');
  });
});

describe('DELETE /api/delete/:taskId', () => {
  let todo;

  beforeEach(async () => {
    // Create a todo entry before each test
    todo = await Todo.create({
      task: 'Test Todo',
      description: 'This is a test todo',
      inListNew: [list._id],
      owner: user._id,
      isStarted: false,
      created: new Date(),
      isDone: false
    });
  });

  it('should delete a todo entry successfully', async () => {
    const res = await request(app)
      .delete(`/api/delete/${todo._id}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('message', 'Successfully deleted entry!');

    const deletedTodo = await Todo.findById(todo._id);
    expect(deletedTodo).to.be.null;
  });

  it('should handle errors when deleting a todo entry', async () => {
    const res = await request(app)
      .delete('/api/delete/invalid_id');

    expect(res.status).to.equal(500);
    expect(res.body).to.have.property('message', 'Internal server error');
  });
});