const express = require('express')
const exphbs = require('express-handlebars')
const session = require('express-session')
const { initializeDb, getDbConnection } = require('./src/database')
const routes = require('./src/routes')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))

app.use(
	session({
		secret: process.env.SESSION_SECRET || 'dev-session-secret',
		resave: false,
		saveUninitialized: false,
		cookie: {
			httpOnly: true,
		},
	})
)

app.use(async (req, res, next) => {
	try {
		if (req.session?.userId) {
			const db = await getDbConnection()
			const user = await db.get('SELECT id, username, email, role FROM users WHERE id = ?', [req.session.userId])
			if (user) {
				res.locals.currentUser = user
			}
		}
	} catch (error) {
		console.error('Failed to load current user', error)
	}
	next()
})

app.engine(
	'hbs',
	exphbs.engine({
		extname: '.hbs',
		defaultLayout: 'main',
		layoutsDir: './views/layouts',
		helpers: {
			truncate: function (str, len) {
				if (str && str.length > len) {
					return str.substring(0, len) + '...'
				}
				return str
			},
			split: function (str, delimiter) {
				if (str) {
					// Handle different types of newlines and normalize them
					const normalizedStr = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
					const result = normalizedStr.split(delimiter).filter(item => item.trim() !== '')
					return result
				}
				return []
			},
			add: function (a, b) {
				return a + b
			},
			newline: function() {
				return '\n'
			}
		},
	})
)
app.set('view engine', 'hbs')
app.set('views', './views')
initializeDb().catch(console.error)

app.use('/', routes)

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`)
})
