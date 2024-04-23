const request = require('supertest');
const expect = require('chai').expect;
const app = require('../server.js');
const User = require('../models/User');
const Todo = require('../models/Todo');
const { authenticate } = require('../middlewares/auth');

describe('POST /users/create', () => {
    it('should create a new user if username is unique', async () => {
      const user = { username: 'testUser', password: 'testPassword',  email: 'testUser@example.com' };
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
    it('should return a user if the username exists', async () => {
      const username = 'testUser';
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

describe('GET /todos', () => {
  it('should return no entries for a new user', async () => {
    const testUser = await User.findOne({ username: 'testUser' });

    const token = generateToken(testUser);
  
    const res = await request(app)
      .get('/todos')
      .set('Authorization', `Bearer ${token}`);
    console.log("res body:", res.body);
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array').that.is.empty;
  });

  it('should return 500 if there is an internal server error', async () => {

  });
});

describe('DELETE /users/:id', () => {
  it('should delete a user if the user exists', async () => {
    // Find the testUser that was created in previous tests
    const testUser = await User.findOne({ username: 'testUser' });

    const res = await request(app).delete(`/users/${testUser._id}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('_id', String(testUser._id));
  });

  it('should return 404 if the user does not exist', async () => {
    const nonExistentUserId = '5f8d04f5b54764421b715f3d'; // This should be an ID that doesn't exist in the database
    const res = await request(app).delete(`/users/${nonExistentUserId}`);

    expect(res.status).to.equal(404);
  });

  it('should return 500 if there is an internal server error', async () => {
  });
});

