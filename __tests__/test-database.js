const sqlite3 = require('sqlite3')
const { open } = require('sqlite')

async function getTestDbConnection() {
	return open({
		filename: './test-database.sqlite',
		driver: sqlite3.Database,
	})
}

async function initializeTestDb() {
	const db = await getTestDbConnection()
	await createTables(db)
	return db
}

async function createTables(db) {
	// Create the 'recipes' table to store recipe information
	await db.exec(`CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    ingredients TEXT,
    method TEXT
  )`)

	// Create the 'users' table to store user information
	await db.exec(`CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
		username TEXT NOT NULL UNIQUE,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'user',
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	)`)
}

module.exports = { getTestDbConnection, initializeTestDb }
