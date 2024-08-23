// const request = require('supertest');
// const { expect } = require('chai');
// const app = require('../server.js'); // Adjust the path to your app
// const Todo = require('../models/Todo'); // Adjust the path to your Todo model
// const List = require('../models/List'); // Adjust the path to your List model
// const User = require('../models/User'); // Adjust the path to your User model

// let user;
// let list;

// beforeEach(async () => {

//   // Setup: Create necessary data before each test
//   user = await User.create({ username: 'testuser', email: 'test@test.te', password: 'password' });
//   list = await List.create({ listName: 'Test List', owner: user._id });
// });

// after(async () => {
//   await User.deleteMany();
//   await List.deleteMany();
//   await Todo.deleteMany(); 
// });

// describe('POST /', () => {
//   it('should create a new todo entry successfully', async () => {
//     const newTodo = {
//       title: 'Test Todo',
//       description: 'This is a test todo',
//       tags: [],
//       inListNew: [],
//       owner: user._id
//     };

//     const res = await request(app)
//       .post('/')
//       .send(newTodo);

//     expect(res.status).to.equal(201);
//     expect(res.body).to.have.property('message', 'Todo entry created successfully');
//     expect(res.body).to.have.property('todo');
//     expect(res.body.todo).to.include(newTodo);
//   });

//   it('should create a new todo entry with tags and increment tag uses', async () => {
//     const list = new List({
//       name: 'Test List',
//       tags: [{ label: 'urgent', uses: 0 }]
//     });
//     await list.save();

//     const newTodo = {
//       title: 'Test Todo with Tags',
//       description: 'This is a test todo with tags',
//       tags: [{ label: 'urgent' }],
//       inListNew: [list._id]
//     };

//     const res = await request(app)
//       .post('/')
//       .send(newTodo);

//     expect(res.status).to.equal(201);
//     expect(res.body).to.have.property('message', 'Todo entry created successfully');
//     expect(res.body).to.have.property('todo');
//     expect(res.body.todo).to.include(newTodo);

//     const updatedList = await List.findById(list._id);
//     expect(updatedList.tags[0].uses).to.equal(1);
//   });

//   it('should handle errors when creating a new todo entry', async () => {
//     const newTodo = {
//       title: 'Test Todo with Error',
//       description: 'This is a test todo that will cause an error',
//       tags: [],
//       inListNew: ['invalid_id'] // Invalid list ID to cause an error
//     };

//     const res = await request(app)
//       .post('/')
//       .send(newTodo);

//     expect(res.status).to.equal(500);
//     expect(res.body).to.have.property('message', 'Internal server error');
//   });
// });