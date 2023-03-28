const http = require('http')
const fs = require('fs')
const path = require('path')
const config = require('./config.json')
const url = require('url')

const hostname = config.hostname
const port = config.port

// Check if the ./generated folder exists, and if not, make one
if (!fs.existsSync(path.resolve("./generated"))) {
	fs.mkdir(path.resolve("./generated"), function (e) {
		if (e) {
			throw e
		}
	})
}

const server = http.createServer((req, res) => {
	console.log(req.connection.remoteAddress + ' requested for ' + req.url + ' by method ' + req.method)

	if (req.method === 'GET') {
		const request = url.parse(req.url, true)
		const request_segments = request.pathname.split('/')
		const request_arguments = request.query

		if (request_segments[1] === '') { // If no path is specified
			res.writeHead(302, {
				'Location': 'https://splittikin.github.io/FHS-News-Docs/'
			})
			res.end()
		} else if (request_segments[1] === 'favicon.ico') {
			console.log('getting favicon')
			res.statusCode = 200
			fs.createReadStream(path.resolve('./pages/bruh.png')).pipe(res)
		} else if (request_segments[1] === 'api') {
			if (request_segments[2] === 'article') {
				getArticle(request_arguments, req, res)
			} else if (request_segments[2] === 'home') {
				loadHome(request_arguments, res)
			} else if (request_segments[2] === 'feedClubs') {
				loadClubs(request_arguments, res)
			} else if (request_segments[2] === 'club') {
				getClub(request_arguments, req, res)
			} else if (request_segments[2] === 'search_date') {
				search_date(request_arguments, res)
			} else if (request_segments[2] === 'weather') {
				getWeather(res)
			} else if (request_segments[2] === 'lunch') {
				getLunch(res)
			} else {
				returnError(400, res)
			}
		} else if (request_segments[1] === 'files') {
			res.statusCode = 200
			fs.createReadStream(path.resolve('./pages' + req.url.split('/files')[1])).pipe(res) // req.url.split('/files')[1] effectively trim '/files' from the start of the string
		} else {
			returnError(404, res)
		}
	}
}) // http.createServer


server.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/
http://${hostname}:${port}/api/home`)
})

function processItem(item) {
	if (item.itemType === "Club") {
		item.clubThumbnail = config.attachments_url + "clubs/" + 0 + "/" + item.clubThumbnail
	} else if (item.itemType === "Article") {
		item.articleThumbnail = config.attachments_url + "articles/" + item["articleId"] + "/" + item.articleThumbnail
		item.topperIcon = config.attachments_url + "articles/" + item["articleId"] + "/" + item.topperIcon
	}
	return item
}

async function returnError(errorCode, res) {
	res.statusCode = errorCode
	if (fs.existsSync('./pages/error/' + errorCode + '.html')) {
		fs.createReadStream('./pages/error/' + errorCode + '.html').pipe(res)
	} else {
		fs.createReadStream('./pages/error/generic.html').pipe(res)
	}
}

async function loadHome(arguments, res) {
	let articlesNeeded = 5
	let articlesOffset = 0
	if (arguments["quantity"] != null) {
		articlesNeeded = arguments["quantity"]
	}
	if (arguments["position"] != null) {
		articlesOffset = arguments["position"]
	}
	console.log("BRUH! i need " + articlesNeeded + " articles here!!!")

	let files = fs.readdirSync('./articles')
	/* Order should be something like this:
	Weather
	Alert (Red/Silver)
	Alert
	Lunch
	Articles
	Articles
	Articles
	Articles
	etc...

	Extras are grabbed in reverse order and added to the top of the list, so they appear in order.
	 */

	let returnData = []
	// Get lunch and add it to the top of the list
	let thisLunch = new Promise((resolve, reject) => {
		fs.readFile('./extras/lunch.json', 'utf8', (err, data) => {
			if (err) {
				reject(err)
			} else {
				resolve(JSON.parse(data))
			}
		})
	})
	returnData.unshift(thisLunch)

	// Get alerts and add them to the top of the feed
	fs.readdirSync('./alerts/').sort().reverse().forEach(file => {
		let thisAlert = new Promise((resolve, reject) => {
			fs.readFile('./alerts/' + file, 'utf8', (err, data) => {
				if (err) {
					reject(err)
				} else {
					resolve(JSON.parse(data))
				}
			})
		})
		returnData.unshift(thisAlert)
	})

	// Get weather and add it to the top of the feed
	let thisWeather = new Promise((resolve, reject) => {
		fs.readFile('./extras/weather.json', 'utf8', (err, data) => {
			if (err) {
				reject(err)
			} else {
				resolve(JSON.parse(data))
			}
		})
	})
	returnData.unshift(thisWeather)

	// Last, get the articles and add them to the bottom
	let folders = files.filter(dirent => fs.lstatSync(path.resolve('./articles/' + dirent)).isDirectory())
	folders = folders.sort()
	let articlesFound = folders
	for (let val of articlesFound) {
		const jsonPath = path.resolve('./articles/' + val + '/article.json')
		console.log(jsonPath)
		let thisArticle = new Promise((resolve, _) => {
			resolve(processItem(JSON.parse(fs.readFileSync(jsonPath, 'utf8'))))
		})
		returnData.push(thisArticle)
	}
	returnData = returnData.slice(articlesOffset, articlesOffset + articlesNeeded)
	await Promise.all(returnData).then(returnArticles => {
		res.json(returnArticles)
	})
}

async function getWeather(res) {
	console.log("getting weather!!!")
	fs.createReadStream('./extras/weather.json').pipe(res)
}

async function getLunch(res) {
	//  In the future, more than one lunch may be specified in lunch.json with a time range for each.
	//  So, just directly reading lunch.json shouldn't be done as later on the server will have to figure
	// out which lunch to return first.
	fs.readFile('./extras/lunch.json', 'utf8', (err, data) => {
		if (err) {
			throw (err)
		} else {
			let lunchReturn = JSON.parse(data)

			// blah blah blah

			res.json(lunchReturn)
		}
	})
}

async function loadClubs(arguments, res) {
	let clubsNeeded = 5
	let clubsOffset = 0
	if (arguments["quantity"] != null) {
		clubsNeeded = parseInt(arguments["quantity"], 10)
	}
	if (arguments["position"] != null) {
		clubsOffset = parseInt(arguments["position"], 10)
	}
	let folders = fs.readdirSync('./clubs').filter(dirent => fs.lstatSync(path.resolve('./clubs/' + dirent)).isDirectory())
	console.log("BRUH! i need " + clubsNeeded + " clubs here starting from position " + clubsOffset + "!!!")
	console.log(`Clubs position ${clubsOffset} through ${clubsNeeded + clubsOffset}`)
	folders.sort(function (a, b) {
		return a - b
	})
	let returnClubs = []
	for (let val of folders) {
		const jsonPath = path.resolve('./clubs/' + val + '/club.json')
		let thisClub = new Promise((resolve, reject) => {
			let thisClubReturn
			fs.readFile(jsonPath, 'utf8', (err, data) => {
				if (err) {
					reject(err)
				} else {
					thisClubReturn = JSON.parse(data)
					thisClubReturn = processItem(thisClubReturn)
					resolve(thisClubReturn)
				}
			})
		})
		returnClubs.push(thisClub)
	}
	returnClubs = returnClubs.slice(clubsOffset, clubsNeeded + clubsOffset)
	await Promise.all(returnClubs).then(returnClubs => {
		res.json(returnClubs)
	})
}

async function search_date(queries, res) {
	let range_start = parseInt(queries["range_start"], 10)
	let range_end
	if (queries["range_end"] != null) {
		range_end = parseInt(queries["range_end"], 10)
	} else {
		range_end = range_start + 86400
	}
	console.log("BRUH! searching for articles between " + range_start + " and " + range_end)
	if (!range_start) {
		await returnError(400, res)
	} else {
		if (!range_end) {
			range_end = range_start + 86400000 // 24 hours in milliseconds
		}
		let folders = fs.readdirSync('./articles').filter(dirent => fs.lstatSync(path.resolve('./articles/' + dirent)).isDirectory())
		let workingArticles = []
		let returnArticles = []
		for (let val of folders) {
			const jsonPath = path.resolve('./articles/' + val + '/article.json')
			console.log(jsonPath)
			let thisArticle = new Promise((resolve, reject) => {
				let thisArticleReturn
				fs.readFile(jsonPath, 'utf8', (err, data) => {
					if (err) {
						reject(err)
					} else {
						thisArticleReturn = JSON.parse(data)
						thisArticleReturn = processItem(thisArticleReturn)
						if (thisArticleReturn["postedTime"] >= range_start && thisArticleReturn["postedTime"] <= range_end) {
							returnArticles.push(thisArticleReturn)
						}
						resolve(thisArticleReturn)
					}
				})
			})
			workingArticles.push(thisArticle)
		}
		await Promise.all(workingArticles).then(_ => {
			let filteredJson = returnArticles.sort(function (a, b) {
				return a["postedTime"] - b["postedTime"]
			})
			res.json(filteredJson)
		})
	}
}

async function getArticle(arguments, req, res) {
	let requestedArticle
	if (arguments["id"] != null) {
		requestedArticle = arguments["id"]
	} else {
		requestedArticle = parseInt(req.url.split("/")[3], 10)
	}
	const articlePath = path.resolve('./articles/' + requestedArticle)
	console.log("BRUH! request for article " + requestedArticle + " which is at " + articlePath)
	const jsonPath = path.resolve(articlePath + "/article.json")
	if (fs.existsSync(jsonPath)) {
		fs.readFile(jsonPath, 'utf8', (err, data) => {
			if (err) {
				throw err
			}
			const thisArticle = processItem(JSON.parse(data))
			res.json(thisArticle)
		})
	} else {
		await returnError(404, res)
	}
}

async function getClub(arguments, req, res) {
	let requestedClub
	if (arguments["id"] != null) {
		requestedClub = arguments["id"]
	} else {
		requestedClub = parseInt(req.url.split("/")[3], 10)
	}
	const clubPath = path.resolve('./clubs/' + requestedClub)
	console.log("BRUH! request for article " + requestedClub + " which is at " + clubPath)
	if (fs.existsSync(path.resolve(clubPath + "/club.json"))) {

		const jsonPath = path.resolve(clubPath + "/club.json")
		fs.readFile(jsonPath, 'utf8', (err, data) => {
			if (err) {
				throw err
			}
			let thisClub = processItem(JSON.parse(data))
			res.json(thisClub)
		})
	} else {
		await returnError(404, res)
	}
}