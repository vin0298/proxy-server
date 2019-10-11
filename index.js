const http = require('http');
const url = require('url');
const request = require('request');
const net = require('net');
const express = require('express');
const absolutify = require('absolutify');
const app = express();
const async = require('async');
const bodyParser = require('body-parser');

const serverPort = 5000;
const MAX_TIMESTAMP = 8640000000000000;

const redis = require('redis'),
    client = redis.createClient();
client.on('connect', ()=> console.log('Redis connected to Proxy Server'));

app.use(bodyParser.urlencoded({extended: false}))
app.listen(serverPort);

app.get('/', (req, res) => {
    console.log("Detected a get request");
    let targetURL = req.query.url;
    console.log("Target URL received: " + targetURL);
    checkCacheAndSendResponse(req, res, targetURL);
});

// CURRENT BUG: extremely sensitive
function checkCacheAndSendResponse(req, res, targetURL) {
    client.get(targetURL, (err, result) => {
        var curDate = Date.now();
        //console.log("result : " + JSON.parse(result)['test']);
        //JSON.parse(result)['expirationTime']

        // TODO: change expirationTime
        if (err == null && result != null && !checkIfStale(curDate, JSON.parse(result)['expirationTime'])) {
            console.log("sending from memory");
            res.send(JSON.parse(result)['body']);
        } else {
            console.log("TargetURL not found in cache");
            request(targetURL, function(error, response, body) {
                if (!error && parseInt(response.statusCode) == 200) { 
                    var expirationTimeToStore = MAX_TIMESTAMP;
                    if (response.headers['cache-control']) {
                        expirationTimeToStore = Date.now() + parseForMaxAge(response.headers['cache-control']);
                    }

                    body = absolutify(body, function(url, attrName) {
                        return '/?url=' + targetURL + url;
                    })

                    //console.log("Body being sent: \n" + body);

                    const urlToStore = {
                        response: response,
                        body: body,
                        expirationTime: expirationTimeToStore
                    }

                    console.log("Content-type: " + response.headers['Content-Type']);
                    res.writeHead(200);
                    res.write(body);
                    res.end();
                    console.log("Sent at " + Date.now());
                    client.set(targetURL, JSON.stringify(urlToStore), (err, reply) => {
                        if (reply == 'OK') {
                            console.log("New page cached at redis");
                        }
                    })
                } else {
                    console.log("invalid url: " + error);
                    /** TODO: Send an error response back to the client */
                }
            })
        }
    })
}

function parseForMaxAge(cacheControl) {
     var parsedArr = cacheControl.split(',');
     for(i = 0; i < parsedArr.length; i++) {
         if (parsedArr[i].includes("max-age=")) {
            return parseInt(parsedArr[i].substring(8)) * 1000;
         }
     }
 }

function checkIfStale(curTime, expirationTimeString) {
    var expirationTime = new Date(parseInt(expirationTimeString));

    if (expirationTime == MAX_TIMESTAMP) return false;

    return (curTime > expirationTime)? true : false;
}

function displayCache() {
     client.keys('*', function (err, keys) {
        if (err) return console.log(err);
        if (keys) {
            async.map(keys, function(key, callback) {
                client.get(key, function (error, value) {
                    if (error) return cb(error);
                    cached_pages[key] = value.toString().length;
                    callback(null);
                }); 
            }, function (error) {
                if (error) return console.log(error);
                res.render('test', {cached_pages: cached_pages});
            });
        }
    });
}