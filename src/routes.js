const express = require('express')
const { getDbConnection } = require('./database')
const bcrypt = require('bcryptjs')

const router = express.Router()

function requireAuth(req, res, next) {
	if (!req.session?.userId) {
		return res.redirect('/login')
	}
	next()
}

async function requireAdmin(req, res, next) {
	if (!req.session?.userId) {
		return res.redirect('/login')
	}
	const db = await getDbConnection()
	const user = await db.get('SELECT role FROM users WHERE id = ?', [req.session.userId])
	if (!user || user.role !== 'admin') {
		return res.status(403).send('Forbidden')
	}
	next()
}

function normalizeInput(value) {
	return value ? value.trim() : ''
}

router.get('/', (req, res) => {
	res.render('home', { title: 'Recipe App' })
})

router.get('/register', (req, res) => {
	res.render('register', { title: 'Register' })
})

router.post('/register', async (req, res) => {
	const db = await getDbConnection()
	const username = normalizeInput(req.body.username)
	const email = normalizeInput(req.body.email)
	const password = normalizeInput(req.body.password)

	if (!username || !email || !password) {
		return res.status(400).render('register', {
			title: 'Register',
			error: '请填写所有必填字段。',
			form: { username, email },
		})
	}

	const existing = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email])
	if (existing) {
		return res.status(409).render('register', {
			title: 'Register',
			error: '用户名或邮箱已存在。',
			form: { username, email },
		})
	}

	const passwordHash = await bcrypt.hash(password, 10)
	const result = await db.run(
		'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
		[username, email, passwordHash]
	)
	req.session.userId = result.lastID
	res.redirect('/profile')
})

router.get('/login', (req, res) => {
	res.render('login', { title: 'Login' })
})

router.post('/login', async (req, res) => {
	const db = await getDbConnection()
	const identifier = normalizeInput(req.body.identifier)
	const password = normalizeInput(req.body.password)

	if (!identifier || !password) {
		return res.status(400).render('login', {
			title: 'Login',
			error: '请输入用户名/邮箱和密码。',
		})
	}

	const user = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [identifier, identifier])
	if (!user) {
		return res.status(401).render('login', {
			title: 'Login',
			error: '用户名/邮箱或密码错误。',
		})
	}

	const isValid = await bcrypt.compare(password, user.password_hash)
	if (!isValid) {
		return res.status(401).render('login', {
			title: 'Login',
			error: '用户名/邮箱或密码错误。',
		})
	}

	req.session.userId = user.id
	res.redirect('/profile')
})

router.post('/logout', (req, res) => {
	if (!req.session) {
		return res.redirect('/')
	}
	req.session.destroy(() => {
		res.redirect('/')
	})
})

router.get('/profile', requireAuth, async (req, res) => {
	const db = await getDbConnection()
	const user = await db.get('SELECT id, username, email, role FROM users WHERE id = ?', [req.session.userId])
	res.render('profile', { title: 'Profile', user })
})

router.post('/profile', requireAuth, async (req, res) => {
	const db = await getDbConnection()
	const username = normalizeInput(req.body.username)
	const email = normalizeInput(req.body.email)
	const password = normalizeInput(req.body.password)

	if (!username || !email) {
		return res.status(400).render('profile', {
			title: 'Profile',
			error: '用户名和邮箱为必填项。',
			user: { id: req.session.userId, username, email },
		})
	}

	const existing = await db.get(
		'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
		[username, email, req.session.userId]
	)
	if (existing) {
		return res.status(409).render('profile', {
			title: 'Profile',
			error: '用户名或邮箱已被占用。',
			user: { id: req.session.userId, username, email },
		})
	}

	if (password) {
		const passwordHash = await bcrypt.hash(password, 10)
		await db.run('UPDATE users SET username = ?, email = ?, password_hash = ? WHERE id = ?', [
			username,
			email,
			passwordHash,
			req.session.userId,
		])
	} else {
		await db.run('UPDATE users SET username = ?, email = ? WHERE id = ?', [
			username,
			email,
			req.session.userId,
		])
	}

	const user = await db.get('SELECT id, username, email, role FROM users WHERE id = ?', [req.session.userId])
	res.render('profile', { title: 'Profile', user, success: '资料已更新。' })
})

router.get('/admin', requireAdmin, (req, res) => {
	res.render('admin', { title: 'Admin' })
})

router.get('/recipes', async (req, res) => {
	const db = await getDbConnection()
	const recipes = await db.all('SELECT * FROM recipes')
	res.render('recipes', { recipes })
})

router.get('/recipes/:id', async (req, res) => {
	const db = await getDbConnection()
	const recipeId = req.params.id
	const recipe = await db.get('SELECT * FROM recipes WHERE id = ?', [recipeId])
	res.render('recipe', { recipe })
})

router.post('/recipes', async (req, res) => {
	const db = await getDbConnection()
	const { title, ingredients, method } = req.body
	await db.run('INSERT INTO recipes (title, ingredients, method) VALUES (?, ?, ?)', [title, ingredients, method])
	res.redirect('/recipes')
})

router.post('/recipes/:id/edit', async (req, res) => {
	const db = await getDbConnection()
	const recipeId = req.params.id
	const { title, ingredients, method } = req.body
	await db.run('UPDATE recipes SET title = ?, ingredients = ?, method = ? WHERE id = ?', [
		title,
		ingredients,
		method,
		recipeId,
	])
	res.redirect(`/recipes/${recipeId}`)
})

module.exports = router
