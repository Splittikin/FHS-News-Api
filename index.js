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
    console.log('Request for ' + req.url + ' by method ' + req.method)

    if (req.method === 'GET') {
        const request = url.parse(req.url, true)
        const request_segments = request.pathname.split('/')
        const request_arguments = request.query

        if (request_segments[1] === '') {
            res.writeHead(302, {
                'Location': 'https://splittikin.github.io/FHS-News-Docs/'
            })
            res.end()
        } else if (request_segments[1] === 'favicon.ico') {
            res.statusCode = 200
            fs.createReadStream(path.resolve('./public/bruh.png'))
        } else if (request_segments[1] === 'api') {
            if (request_segments[2] === 'article') {
                getArticle(req, res)
            } else if (request_segments[2] === 'home') {
                loadHome(request_arguments, res)
            } else if (request_segments[2] === 'feedClubs') {
                loadClubs(request_arguments, res)
            } else if (request_segments[2] === 'club') {
                getClub(req, res)
            } else if (request_segments[2] === 'search_date') {
                search_date(request_arguments, res)
            } else if (request_segments[2] === 'weather') {
                getWeather(res)
            } else {
                returnError(400, res)
            }
        } else if (request_segments[1] === 'files') {
            res.statusCode = 200
            fs.createReadStream(path.resolve('./public' + req.url.split('/files')[1])).pipe(res) // req.url.split('/files')[1] effectively trim '/files' from the start of the string
        } else {
            returnError(404, res)
        }
    }
}) // http.createServer


server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`)
})

function resolveAttachments(item) {
    if (item.clubThumbnail != null) {
        item.clubThumbnail = config.attachments_url + "clubs/" + item["clubId"] + "/" + item.clubThumbnail
    } else if (item.articleThumbnail != null) {
        item.articleThumbnail = config.attachments_url + "articles/" + item["articleId"] + "/" + item.articleThumbnail
        item.topperIcon = config.attachments_url + "articles/" + item["articleId"] + "/" + item.topperIcon
    }
    return item
}

async function returnError(errorCode, res) {
    res.statusCode = errorCode
    fs.exists('./error_pages/' + errorCode + '.html', exists => {
        if (exists) {
            fs.createReadStream('./error_pages/' + errorCode + '.html').pipe(res)
        } else {
            fs.createReadStream('./error_pages/generic.html').pipe(res)
        }
    })
}

async function loadHome(arguments, res) {
    let articlesNeeded = 3
    let articlesOffset = 0
    let includeExtras = true
    if (arguments["quantity"] != null) {
        articlesNeeded = arguments["quantity"]
    }
    if (arguments["position"] != null) {
        articlesOffset = arguments["position"]
    }
    if (arguments["extras"] === false) {
        includeExtras = false
    }
    console.log("BRUH! i need " + articlesNeeded + " articles here!!!")

    fs.readdir('./articles', (err, files) => {
        if (err) {
            throw err
        }
        /* Order should be something like this:
        Weather
        Alert (Red/Silver)
        Alert
        Articles
        Articles
        Articles
        Articles
        etc...

        Weather and alerts are grabbed first so they appear at the top of the list.
         */

        let returnData = []
        let extrasLength = 0
        if (includeExtras) {
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
                extrasLength += 1
                returnData.unshift(thisAlert)
            })

            // Get weather and add it to the top of the feed
            let thisWeather = new Promise((resolve, reject) => {
                fs.readFile('./weather/current.json', 'utf8', (err, data) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(JSON.parse(data))
                    }
                })
            })
            extrasLength += 1
            returnData.unshift(thisWeather)
        }

        // Last, get the articles and add them to the bottom
        let folders = files.filter(dirent => fs.lstatSync(path.resolve('./articles/' + dirent)).isDirectory())
        folders = folders.sort()
        let articlesFound = folders
        for (let val of articlesFound) {
            const jsonPath = path.resolve('./articles/' + val + '/article.json')
            console.log(jsonPath)
            let thisArticle = new Promise((resolve, reject) => {
                let thisArticleReturn
                fs.readFile(jsonPath, 'utf8', (err, data) => {
                    if (err) {
                        reject(err)
                    } else {
                        thisArticleReturn = JSON.parse(data)
                        thisArticleReturn = resolveAttachments(thisArticleReturn)
                        resolve(thisArticleReturn)
                    }
                })
            })
            returnData.push(thisArticle)
        }
        returnData = returnData.slice(articlesOffset, articlesOffset + articlesNeeded)
        writeHome(returnData, res)
    }) // readdir
}

async function writeHome(returnArticles, res) { // Separated into a separate function so that the server will wait until all the promises resolve before continuing
    let newJson = await Promise.all(returnArticles)
    const filePath = path.resolve('./generated/home.json')
    fs.writeFile(filePath, JSON.stringify(newJson, null, 2), function (err) {
        if (err) {
            throw err
        } else {
            res.statusCode = 200
            fs.createReadStream(filePath).pipe(res)
        }
    })
}

async function getWeather(res) {
    console.log("getting weather!!!")

    let weatherReturn
    fs.readFile('./weather/current.json', 'utf8', (err, data) => {
        if (err) {
            throw (err)
        } else {
            weatherReturn = JSON.parse(data)
            writeWeather(weatherReturn, res)
        }
    })
}

async function writeWeather(returnWeather, res) { // Separated into a separate function so that the server will wait until all the promises resolve before continuing
    console.log(returnWeather)
    const filePath = path.resolve('./generated/weather.json')
    fs.writeFile(filePath, JSON.stringify(returnWeather, null, 2), function (err) {
        if (err) {
            throw err
        } else {
            res.statusCode = 200
            fs.createReadStream(filePath).pipe(res)
        }
    })
}

async function loadClubs(arguments, res) {
    let clubsNeeded = 3
    let clubsOffset = 0
    if (arguments["quantity"] != null) {
        clubsNeeded = parseInt(arguments["quantity"], 10)
    }
    if (arguments["position"] != null) {
        clubsOffset = parseInt(arguments["position"], 10)
    }
    fs.readdir('./clubs', (err, files) => {
        if (err) {
            throw err
        }
        let folders = files.filter(dirent => fs.lstatSync(path.resolve('./clubs/' + dirent)).isDirectory())
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
                        thisClubReturn = resolveAttachments(thisClubReturn)
                        resolve(thisClubReturn)
                    }
                })
            })
            returnClubs.push(thisClub)
        }
        returnClubs = returnClubs.slice(clubsOffset, clubsNeeded + clubsOffset)
        writeClubs(returnClubs, res)
    }) // readdir

}

async function writeClubs(returnClubs, res) { // Separated into a separate function so that the server will wait until all the promises resolve before continuing
    let newJson = await Promise.all(returnClubs)
    const filePath = path.resolve('./generated/clubs.json')
    fs.writeFile(filePath, JSON.stringify(newJson, null, 2), function (err) {
        if (err) {
            throw err
        } else {
            res.statusCode = 200
            fs.createReadStream(filePath).pipe(res)
        }
    })
}

async function search_date(queries, res) {
    let range_start = parseInt(queries["range_start"], 10)
    let range_end = parseInt(queries["range_end"], 10)
    console.log("BRUH! searching for articles between " + range_start + " and " + range_end)
    if (!range_start) {
        returnError(400, res)
    } else {
        if (!range_end) {
            range_end = range_start + 86400000 // 24 hours in milliseconds
        }
        const articlesNeeded = 3
        fs.readdir('./articles', (err, files) => {
            if (err) {
                throw err
            }
            let folders = files.filter(dirent => fs.lstatSync(path.resolve('./articles/' + dirent)).isDirectory())
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
                            thisArticleReturn = resolveAttachments(thisArticleReturn)
                            if (thisArticleReturn["postedTime"] >= range_start && thisArticleReturn["postedTime"] <= range_end) {
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

async function filterAndWriteDateSearchResult(workingArticles, returnArticles, res) { // Separated into a separate function so that the server will wait until all the promises resolve before continuing
    let allJson = await Promise.all(workingArticles)
    let filteredJson = returnArticles.sort(function (a, b) {
        return a["postedTime"] < b["postedTime"]
    })
    console.log(workingArticles)
    console.log(returnArticles)
    const filePath = path.resolve('./generated/search_date.json')
    fs.writeFile(filePath, JSON.stringify(filteredJson, null, 2), function (err) {
        if (err) {
            throw err
        } else {
            res.statusCode = 200

            fs.createReadStream(filePath).pipe(res)
        }
    })
}

async function getArticle(req, res) {
    const requestedArticle = parseInt(req.url.split("/")[3], 10)
    const articlePath = path.resolve('./articles/' + requestedArticle)
    console.log("BRUH! request for article " + requestedArticle + " which is at " + articlePath)
    const jsonPath = path.resolve(articlePath + "/article.json")
    fs.exists(jsonPath, (exists) => {
        if (!exists) {
            returnError(404, res)
        } else {
            fs.readFile(jsonPath, 'utf8', (err, data) => {
                if (err) {
                    throw err
                }
                const thisArticle = resolveAttachments(JSON.parse(data))
                const outPath = path.resolve('./generated/article_' + thisArticle["articleId"] + '.json')
                fs.writeFile(outPath, JSON.stringify(thisArticle, null, 2), function (err) {
                    if (err) {
                        throw err
                    } else {
                        fs.createReadStream(outPath).pipe(res)
                    }
                }) // fs.writeFile
            })
        } // if (!exists)
    }) // fs.exists if article exists
}

async function getClub(req, res) {
    const requestedClub = parseInt(req.url.split("/")[3], 10)
    const clubPath = path.resolve('./clubs/' + requestedClub)
    console.log("BRUH! request for article " + requestedClub + " which is at " + clubPath)
    fs.exists(path.resolve(clubPath + "/club.json"), (exists) => {
        if (!exists) {
            returnError(404, res)
        } else {
            const jsonPath = path.resolve(clubPath + "/club.json")
            fs.readFile(jsonPath, 'utf8', (err, data) => {
                if (err) {
                    throw err
                }
                let thisClub = resolveAttachments(JSON.parse(data))
                const outPath = path.resolve('./generated/club_' + thisClub["clubId"] + '.json')
                fs.writeFile(outPath, JSON.stringify(thisClub, null, 2), function (err) {
                    if (err) {
                        throw err
                    } else {
                        fs.createReadStream(outPath).pipe(res)
                    }
                }) // fs.writeFile
            })
        } // if (!exists)
    }) // fs.exists if club exists
}