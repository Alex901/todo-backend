const request = require('supertest');
const { expect } = require('chai');
const app = require('../server.js'); 
const Todo = require('../models/Todo');
const List = require('../models/List'); 
const User = require('../models/User'); 

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
  });

  it('should handle errors when creating a new todo entry', async () => {
    const newTodo = {
      task: 'Test Todo with Error',
      description: 'This is a test todo that will cause an error',
      inListNew: ['invalid_id'], 
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

describe('Task Linking', () => {
  it('should create tasks with links successfully', async () => {
    const task1 = await Todo.create({ task: 'Task 1', owner: user._id, isStarted: false, created: new Date(), isDone: false });
    const task2 = await Todo.create({ task: 'Task 2', owner: user._id, isStarted: false, created: new Date(), isDone: false });
    const task3 = await Todo.create({ task: 'Task 3', owner: user._id, isStarted: false, created: new Date(), isDone: false });

    const newTodo = {
      task: 'Task 4',
      owner: user._id,
      isStarted: false,
      created: new Date(),
      isDone: false,
      tasksBefore: [task1._id, task2._id],
      tasksAfter: [task3._id]
    };

    const res = await request(app)
      .post('/api/')
      .send(newTodo);

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('message', 'Todo entry created successfully');
    const createdTodo = res.body.todo;
    expect(createdTodo.tasksBefore).to.include(task1._id.toString());
    expect(createdTodo.tasksBefore).to.include(task2._id.toString());
    expect(createdTodo.tasksAfter).to.include(task3._id.toString());

    const updatedTask1 = await Todo.findById(task1._id);
    const updatedTask2 = await Todo.findById(task2._id);
    const updatedTask3 = await Todo.findById(task3._id);

    expect(updatedTask1.tasksAfter).to.include(createdTodo._id.toString());
    expect(updatedTask2.tasksAfter).to.include(createdTodo._id.toString());
    expect(updatedTask3.tasksBefore).to.include(createdTodo._id.toString());
  });

  it('should update task links successfully', async () => {
    const task1 = await Todo.create({ task: 'Task 1', owner: user._id, isStarted: false, created: new Date(), isDone: false });
    const task2 = await Todo.create({ task: 'Task 2', owner: user._id, isStarted: false, created: new Date(), isDone: false });
    const task3 = await Todo.create({ task: 'Task 3', owner: user._id, isStarted: false, created: new Date(), isDone: false });
    const task4 = await Todo.create({ task: 'Task 4', owner: user._id, isStarted: false, created: new Date(), isDone: false, tasksBefore: [task1._id], tasksAfter: [task2._id] });

    const updatedTask = {
      tasksBefore: [task3._id],
      tasksAfter: []
    };

    const res = await request(app)
      .patch('/api/edit')
      .send({ taskId: task4._id, updatedTask });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('message', 'Task updated successfully');
    const updatedTodo = res.body.updatedTodo;
    expect(updatedTodo.tasksBefore).to.include(task3._id.toString());
    expect(updatedTodo.tasksAfter).to.be.empty;

    const updatedTask1 = await Todo.findById(task1._id);
    const updatedTask2 = await Todo.findById(task2._id);
    const updatedTask3 = await Todo.findById(task3._id);

    expect(updatedTask1.tasksAfter).to.not.include(task4._id.toString());
    expect(updatedTask2.tasksBefore).to.not.include(task4._id.toString());
    expect(updatedTask3.tasksAfter).to.include(task4._id.toString());
  });

  it('should delete task and unlink successfully', async () => {
    const task1 = await Todo.create({ task: 'Task 1', owner: user._id, isStarted: false, created: new Date(), isDone: false });
    const task2 = await Todo.create({ task: 'Task 2', owner: user._id, isStarted: false, created: new Date(), isDone: false });
    const task3 = await Todo.create({ task: 'Task 3', owner: user._id, isStarted: false, created: new Date(), isDone: false });
    const task4 = await Todo.create({ task: 'Task 4', owner: user._id, isStarted: false, created: new Date(), isDone: false, tasksBefore: [task1._id], tasksAfter: [task2._id, task3._id] });

    const res = await request(app)
      .delete(`/api/delete/${task4._id}`);

    expect(res.status).to.equal(200);

    const updatedTask1 = await Todo.findById(task1._id);
    const updatedTask2 = await Todo.findById(task2._id);
    const updatedTask3 = await Todo.findById(task3._id);

    expect(updatedTask1.tasksAfter).to.not.include(task4._id.toString());
    expect(updatedTask2.tasksBefore).to.not.include(task4._id.toString());
    expect(updatedTask3.tasksBefore).to.not.include(task4._id.toString());
  });
});

it('should clear links when updating a normal task to a repeatable task', async () => {
  const task1 = await Todo.create({ task: 'Task 1', owner: user._id, isStarted: false, created: new Date(), isDone: false });
  const task2 = await Todo.create({ task: 'Task 2', owner: user._id, isStarted: false, created: new Date(), isDone: false });
  const task3 = await Todo.create({ task: 'Task 3', owner: user._id, isStarted: false, created: new Date(), isDone: false, tasksBefore: [task1._id], tasksAfter: [task2._id] });

  const updatedTask = {
    _id: task3._id,
    task: 'Task 3',
    owner: user._id,
    isStarted: false,
    created: task3.created,
    isDone: false,
    repeatable: true,
    tasksBefore: [],
    tasksAfter: []
  };

  const res = await request(app)
    .patch('/api/edit')
    .send({ taskId: task3._id, updatedTask });

  expect(res.status).to.equal(200);
  expect(res.body).to.have.property('message', 'Task updated successfully');
  const updatedTodo = res.body.updatedTodo;
  expect(updatedTodo.tasksBefore).to.be.empty;
  expect(updatedTodo.tasksAfter).to.be.empty;

  const updatedTask1 = await Todo.findById(task1._id);
  const updatedTask2 = await Todo.findById(task2._id);

  expect(updatedTask1.tasksAfter).to.not.include(task3._id.toString());
  expect(updatedTask2.tasksBefore).to.not.include(task3._id.toString());
});

it('should add links when updating a repeatable task to a normal task', async () => {
  const task1 = await Todo.create({ task: 'Task 1', owner: user._id, isStarted: false, created: new Date(), isDone: false });
  const task2 = await Todo.create({ task: 'Task 2', owner: user._id, isStarted: false, created: new Date(), isDone: false });
  const task3 = await Todo.create({ task: 'Task 3', owner: user._id, isStarted: false, created: new Date(), isDone: false, repeatable: true });

  const updatedTask = {
    repeatable: false,
    tasksBefore: [task1._id],
    tasksAfter: [task2._id]
  };

  const res = await request(app)
    .patch('/api/edit')
    .send({ taskId: task3._id, updatedTask });

  expect(res.status).to.equal(200);
  expect(res.body).to.have.property('message', 'Task updated successfully');
  const updatedTodo = res.body.updatedTodo;
  expect(updatedTodo.tasksBefore).to.include(task1._id.toString());
  expect(updatedTodo.tasksAfter).to.include(task2._id.toString());

  const updatedTask1 = await Todo.findById(task1._id);
  const updatedTask2 = await Todo.findById(task2._id);

  expect(updatedTask1.tasksAfter).to.include(task3._id.toString());
  expect(updatedTask2.tasksBefore).to.include(task3._id.toString());
});