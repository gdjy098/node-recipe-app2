const { getTestDbConnection, initializeTestDb } = require('./test-database');

describe('Database Operations', () => {
  let db;

  beforeEach(async () => {
    db = await initializeTestDb();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  test('should create recipes table', async () => {
    const tableInfo = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='recipes'");
    expect(tableInfo).toHaveLength(1);
    expect(tableInfo[0].name).toBe('recipes');
  });

  test('should create users table', async () => {
    const tableInfo = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    expect(tableInfo).toHaveLength(1);
    expect(tableInfo[0].name).toBe('users');
  });

  test('should insert a new recipe', async () => {
    const title = 'Test Recipe';
    const ingredients = 'Test ingredients';
    const method = 'Test method';

    await db.run('INSERT INTO recipes (title, ingredients, method) VALUES (?, ?, ?)', 
      [title, ingredients, method]);

    const recipe = await db.get('SELECT * FROM recipes WHERE title = ?', [title]);
    expect(recipe).toBeDefined();
    expect(recipe.title).toBe(title);
    expect(recipe.ingredients).toBe(ingredients);
    expect(recipe.method).toBe(method);
  });

  test('should insert a new user', async () => {
    const username = 'testuser';
    const email = 'test@example.com';
    const passwordHash = 'hashed-password';

    await db.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    expect(user).toBeDefined();
    expect(user.email).toBe(email);
    expect(user.password_hash).toBe(passwordHash);
  });
});
