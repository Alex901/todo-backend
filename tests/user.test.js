const request = require('supertest');
const expect = require('chai').expect;
const app = require('../server.js');

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