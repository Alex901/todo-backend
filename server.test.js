const request = require('supertest');
const app = require('./server'); // Replace with the path to your main server file

describe('Test Express server is running', () => {
  it('should respond with "server is running" on / GET', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('server is running');
  });


});