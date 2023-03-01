const http = require('http')
const fs = require('fs')
const path = require('path')
const config = require('./config.json')
const url = require('url')

const hostname = config.hostname
const port = config.port

const server = http.createServer((req, res) => {
	console.log('Request for ' + req.url + ' by method ' + req.method)
	var not404links = ["/api"]
	// List of articles that should not return 404 despite not having a file at the path
	// Is recursive, any path that starts with any of the strings here are counted

	if (req.method == 'GET') {
		const request = url.parse(req.url, true)
		const request_segments = request.pathname.split('/')
		const request_arguments = request.query
		console.log(request_segments)


		if (request_segments[1] == '') {
			res.statusCode = 200
			fs.createReadStream('./public/index.html').pipe(res)
		} else if (request_segments[1] = 'api') {
			if (request_segments[2] == 'article') {
				getArticle(req, res)
			} else if (request_segments[2] == 'home') {
				loadHome(res)
			} else if (request_segments[2] == 'club') {
				loadClub(req, res)
			}
		} else {
			returnError(404, res)
		}

		/*
		var fileUrl
		if (req.url == '/') fileUrl = '/index.html'
		else fileUrl = req.url

		var filePath = path.resolve('./public' + fileUrl)
		const fileExt = path.extname(filePath).toLowerCase()

		const queries = url.parse(req.url, true).query
		console.log(queries)

		var not404 = false
		for (let val of not404links) {
			if (fileUrl.startsWith(val)) {not404 = true}
		}

		fs.exists(filePath, (exists) => { // bool exists = wether or not the file exists in folder public with the path requested
			if ((!exists || !fs.lstatSync(filePath).isFile())) { // If the url does not point to a file or if the file being pointed at is a folder
				return404(res, fileExt)
				return
			}
		})

		// THIS IS THE IMPORTANT PART
		if (req.url.startsWith("/api/article")) {
			getArticle(req, res)
		} else if (req.url.startsWith("/api/home")) {
			loadHome(res)
		} else if (req.url.startsWith("/api/club")) {
			loadClub(req, res)
		} else if (req.url.startsWith("/api/feedClubs")) {
			loadClubs(res)
		} else if (req.url.startsWith("/api/search_date")) {
			search_date(queries, res)
		} else if (req.url.startsWith("/api/weather")) {
			getWeather(res)
		} else {
			res.statusCode = 200
			fs.createReadStream(filePath).pipe(res)
		}
		*/

	} // if req.method is GET
}) // http.createServer



server.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/`);
});

function resolveArticleAttachments(article) {
	article.articleThumbnail = config.attachments_url + "articles/" + article.articleId + "/" + article.articleThumbnail
	article.topperIcon = config.attachments_url + "articles/" + article.articleId + "/" + article.topperIcon
	return article
}
function resolveClubAttachments(club) {
	club.clubThumbnail = config.attachments_url + "clubs/" + club.clubId + "/" + club.clubThumbnail
	return club
}


function return404(res, fileExt = ".html") {
	res.statusCode = 404
	fs.exists('./public/404'+fileExt, (exists) => {
		if (exists) {
			filePath = path.resolve('./public/404'+fileExt)
			fs.createReadStream(filePath).pipe(res)
		} else {
			filePath = path.resolve('./public/404.html');
			fs.createReadStream(filePath).pipe(res);
		}
	})
	return
}

async function returnError(errorCode, res) {
	res.statusCode = errorCode
	fs.exists('./error_pages/'+errorCode+'.html', exists => {
		if (exists) {
			fs.createReadStream('./error_pages/'+errorCode+'.html').pipe(res)
		} else {
			fs.createReadStream('./error_pages/generic.html').pipe(res)
		}
	})
}

async function writeHome(returnArticles, res) { // THIS SUCKS
	newJson = await Promise.all(returnArticles)
	fs.writeFile('./generated/home.json', JSON.stringify(newJson, null, 2), function(err) {
		if (err) {
			throw err
		} else {
			res.statusCode = 200
			filePath = path.resolve('./generated/home.json');
			fs.createReadStream(filePath).pipe(res);
		}
	})
}

async function loadHome(res) {
	const articlesNeeded = 3
	console.log("BRUH! i need " + articlesNeeded + " articles here!!!")
	
	fs.readdir('./articles', (err, files) => {
		if (err) {
			throw err
		}
		var folders = files.filter(dirent => fs.lstatSync(path.resolve('./articles/'+dirent)).isDirectory())
		folders = folders.sort()
		var articlesFound = [folders[0], folders[1], folders[2]]
		var returnArticles = []
		for (let val of articlesFound) {
			const jsonPath = path.resolve('./articles/'+val+'/article.json')
			console.log(jsonPath)
			var thisArticle = new Promise((resolve, reject) => {
				var thisArticleReturn
				fs.readFile(jsonPath, 'utf8', (err, data) => {
					if (err) {
						reject(err)
					} else {
						thisArticleReturn = JSON.parse(data)
						thisArticleReturn = resolveArticleAttachments(thisArticleReturn)
						resolve(thisArticleReturn)
					}
				})
			})
			returnArticles.push(thisArticle)
		}
		fs.readdirSync('./alerts/').sort().reverse().forEach(file => {
			var thisAlert = new Promise((resolve, reject) => {
				fs.readFile('./alerts/'+file, 'utf8', (err, data) => {
					if (err) {
						reject(err)
					} else {
						thisAlertReturn = JSON.parse(data)
						resolve(thisAlertReturn)
					}
				})
			})
			returnArticles.unshift(thisAlert)
		})
		var thisWeather = new Promise((resolve, reject) => {
			fs.readFile('./weather/current.json', 'utf8', (err, data) => {
				if (err) {
					reject (err)
				} else {
					resolve (JSON.parse(data))
				}
			})
		})
		returnArticles.unshift(thisWeather)
		writeHome(returnArticles, res)
	}) // readdir
}

async function getWeather(res) {
	console.log("getting weather!!!")
	
	var weatherReturn
	fs.readFile('./weather/current.json', 'utf8', (err, data) => {
		if (err) {
			throw (err)
		} else {
			weatherReturn = JSON.parse(data)
			writeWeather(weatherReturn, res)
		}
	})
}

async function loadClubs(res) {
	const clubsNeeded = 3
	fs.readdir('./clubs', (err, files) => {
		if (err) {
			throw err
		}
		var folders = files.filter(dirent => fs.lstatSync(path.resolve('./clubs/'+dirent)).isDirectory())
		console.log("BRUH! i need " + clubsNeeded + " clubs here!!!")
		folders.sort(function(a, b) {
			return a - b
		})
		var returnClubs = []
		for (let val of folders) {
			const jsonPath = path.resolve('./clubs/'+val+'/club.json')
			console.log(jsonPath)
			var thisClub = new Promise((resolve, reject) => {
				var thisClubReturn
				fs.readFile(jsonPath, 'utf8', (err, data) => {
					if (err) {
						reject(err)
					} else {
						thisClubReturn = JSON.parse(data)
						thisClubReturn = resolveClubAttachments(thisClubReturn)
						console.log(thisClubReturn)
						resolve(thisClubReturn)
					}
				})
			})
			returnClubs.push(thisClub)
		}
		writeClubs(returnClubs, res)
	}) // readdir

}

async function writeClubs(returnClubs, res) { // THIS STILL SUCKS
	newJson = await Promise.all(returnClubs)
	fs.writeFile('./generated/clubs.json', JSON.stringify(newJson, null, 2), function(err) {
		if (err) {
			throw err
		} else {
			res.statusCode = 200
			filePath = path.resolve('./generated/clubs.json');
			fs.createReadStream(filePath).pipe(res);
		}
	})
}

async function writeWeather(returnWeather, res) { // THIS STILL SUCKS
	console.log(returnWeather)
	fs.writeFile('./generated/weather.json', JSON.stringify(returnWeather, null, 2), function(err) {
		if (err) {
			throw err
		} else {
			res.statusCode = 200
			filePath = path.resolve('./generated/weather.json');
			console.log(filePath)
			fs.createReadStream(filePath).pipe(res);
		}
	})
}

async function loadClub(req, res) {
	const requestedClub = parseInt(req.url.split("/")[3], 10)
	const clubPath = path.resolve('./clubs/' + requestedClub)
	console.log("BRUH! request for article " + requestedClub + " which is at " + clubPath)
	fs.exists(path.resolve(clubPath + "/club.json"), (exists) => {
		if (!exists) {
			return404(res)
		} else {
			jsonPath = path.resolve(clubPath + "/club.json")
			fs.readFile(jsonPath, 'utf8', (err, data) => {
				if (err) {
					throw err
				}
				thisClub = JSON.parse(data)
				thisClub = resolveClubAttachments(thisClub)
				fs.writeFile('./generated/club_'+ thisClub.clubId +'.json', JSON.stringify(thisClub, null, 2), function(err) {
					if (err) {
						throw err
					} else {
						outPath = path.resolve('./generated/club_'+ thisClub.clubId +'.json');
						fs.createReadStream(outPath).pipe(res);
					}
				}) // fs.writeFile
			})
		} // if (!exists)
	}) // fs.exists if club exists
}

async function search_date(queries, res) {
	var range_start = parseInt(queries.range_start, 10)
	var range_end = parseInt(queries.range_end, 10)
	console.log("BRUH! searching for articles between "+range_start+ " and "+range_end)
	if (!range_start) {
		return404(res)
		return
	} else {
		if (!range_end){
			range_end = range_start + 86400000 // 24 hours in milliseconds
		}
		const articlesNeeded = 3
		fs.readdir('./articles', (err, files) => {
			if (err) {
				throw err
			}
			var folders = files.filter(dirent => fs.lstatSync(path.resolve('./articles/'+dirent)).isDirectory())
			var workingArticles = []
			var returnArticles = []
			for (let val of folders) {
				const jsonPath = path.resolve('./articles/'+val+'/article.json')
				console.log(jsonPath)
				var thisArticle = new Promise((resolve, reject) => {
					var thisArticleReturn
					fs.readFile(jsonPath, 'utf8', (err, data) => {
						if (err) {
							reject(err)
						} else {
							thisArticleReturn = JSON.parse(data)
							thisArticleReturn = resolveArticleAttachments(thisArticleReturn)
							if (thisArticleReturn.postedTime >= range_start && thisArticleReturn.postedTime <= range_end) {
								returnArticles.push(thisArticleReturn)
							}
							resolve(thisArticleReturn)
						}
					})
				})
				workingArticles.push(thisArticle)
			}
			filterAndWriteDateSearchResult(workingArticles, returnArticles, res)
		}) // readdir
	}
}

async function filterAndWriteDateSearchResult(workingArticles, returnArticles, res) { // THIS ALSO SUCKS TODO: MAKE THE FILENAME DIFFER BASED ON SEARCH BEING MADE
	allJson = await Promise.all(workingArticles)
	filteredJson = returnArticles.sort(function(a, b) { return a.postedTime < b.postedTime; });
	console.log(workingArticles)
	console.log(returnArticles)
	fs.writeFile('./generated/search_date.json', JSON.stringify(filteredJson, null, 2), function(err) {
		if (err) {
			throw err
		} else {
			res.statusCode = 200
			filePath = path.resolve('./generated/search_date.json');
			fs.createReadStream(filePath).pipe(res);
		}
	})
}

async function getArticle(req, res) {
	const requestedArticle = parseInt(req.url.split("/")[3], 10)
	const articlePath = path.resolve('./articles/' + requestedArticle)
	console.log("BRUH! request for article " + requestedArticle + " which is at " + articlePath)
	fs.exists(path.resolve(articlePath + "/article.json"), (exists) => {
		if (!exists) {
			return404(res)
		} else {
			jsonPath = path.resolve(articlePath + "/article.json")
			fs.readFile(jsonPath, 'utf8', (err, data) => {
				if (err) {
					throw err
				}
				thisArticle = JSON.parse(data)
				thisArticle = resolveArticleAttachments(thisArticle)

				fs.writeFile('./generated/article_'+ thisArticle.articleId +'.json', JSON.stringify(thisArticle, null, 2), function(err) {
					if (err) {
						throw err
					} else {
						outPath = path.resolve('./generated/article_'+ thisArticle.articleId +'.json');
						fs.createReadStream(outPath).pipe(res);
					}
				}) // fs.writeFile
			})
		} // if (!exists)
	}) // fs.exists if article exists
}
