const request = require('supertest');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const routes = require('../src/routes');
const { initializeTestDb } = require('./test-database');

// Mock the database module to use test database
jest.mock('../src/database', () => ({
  getDbConnection: () => require('./test-database').getTestDbConnection()
}));

// Simple app setup for testing
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      secret: 'test-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
      },
    })
  );
  
  // Simple mock for res.render
  app.use((req, res, next) => {
    res.render = (view, locals) => res.json({ view, locals });
    next();
  });
  
  app.use('/', routes);
  return app;
}

describe('Routes', () => {
  let app;
  let db;

  beforeEach(async () => {
    app = createTestApp();
    db = await initializeTestDb();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  test('GET / should return 200', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.view).toBe('home');
  });

  test('POST /recipes should create a new recipe', async () => {
    const newRecipe = {
      title: 'New Test Recipe',
      ingredients: 'New test ingredients',
      method: 'New test method'
    };

    const response = await request(app)
      .post('/recipes')
      .send(newRecipe);

    expect(response.status).toBe(302); // Redirect status
    expect(response.headers.location).toBe('/recipes');

    // Verify recipe was created
    const recipe = await db.get('SELECT * FROM recipes WHERE title = ?', [newRecipe.title]);
    expect(recipe).toBeDefined();
    expect(recipe.title).toBe(newRecipe.title);
  });

  test('GET /profile should redirect when not authenticated', async () => {
    const response = await request(app).get('/profile');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/login');
  });

  test('POST /register should create a new user and login', async () => {
    const agent = request.agent(app);
    const response = await agent.post('/register').send({
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'Password123',
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/profile');

    const user = await db.get('SELECT * FROM users WHERE username = ?', ['testuser']);
    expect(user).toBeDefined();
    expect(user.email).toBe('testuser@example.com');
  });

  test('POST /login should authenticate an existing user', async () => {
    const passwordHash = await bcrypt.hash('Password123', 10);
    await db.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      ['existing', 'existing@example.com', passwordHash]
    );

    const agent = request.agent(app);
    const response = await agent.post('/login').send({
      identifier: 'existing',
      password: 'Password123',
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/profile');
  });

  test('POST /profile should update user profile', async () => {
    const agent = request.agent(app);
    await agent.post('/register').send({
      username: 'profileuser',
      email: 'profile@example.com',
      password: 'Password123',
    });

    const response = await agent.post('/profile').send({
      username: 'updateduser',
      email: 'updated@example.com',
      password: '',
    });

    expect(response.status).toBe(200);
    expect(response.body.view).toBe('profile');

    const user = await db.get('SELECT * FROM users WHERE username = ?', ['updateduser']);
    expect(user).toBeDefined();
    expect(user.email).toBe('updated@example.com');
  });

  test('GET /admin should allow admin users', async () => {
    const agent = request.agent(app);
    await agent.post('/register').send({
      username: 'adminuser',
      email: 'admin@example.com',
      password: 'Password123',
    });

    await db.run("UPDATE users SET role = 'admin' WHERE username = ?", ['adminuser']);

    const response = await agent.get('/admin');
    expect(response.status).toBe(200);
    expect(response.body.view).toBe('admin');
  });
});