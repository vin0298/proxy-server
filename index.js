const http = require('http');
const url = require('url');
const request = require('request');
const net = require('net');
const express = require('express');
const absolutify = require('absolutify');
const app = express();
const async = require('async');

const serverPort = 5000;
const MAX_TIMESTAMP = 8640000000000000;

const redis = require('redis'),
    client = redis.createClient();
client.on('connect', ()=> console.log('Redis connected to Proxy Server'));

app.listen(serverPort);

app.get('/', function(request, response) {
    let targetURL = request.query;

});

function checkCacheAndSendResponse(req, res, targetURL) {
    client.get(targetURL, (err, result) => {
        var curDate = Date.now();
        
        // TODO: change expirationTime
        if (err == null && result != null && !checkIfStale(curDate, JSON.parse(result).expirationTime)) {
            console.log("sending from memory");
            res.send(JSON.parse(result).response);
        } else {
            request(targetURL, function(error, response, body) {
                if (!error && parseInt(response.statusCode) == 200) { 
                    var expirationTimeToStore = MAX_TIMESTAMP;
                    if (response.headers['cache-control']) {
                        expirationTimeToStore = Date.now() + parseForMaxAge(response.headers['cache-control']);
                    }

                    body = absolutify(body, function(url, attrName) {
                        return '/?url=' + targetURL + url;
                    })

                    const urlToStore = {
                        response: response,
                        body: body,
                        expirationTime: expirationTimeToStore;
                    }

                    client.set(targetURL, JSON.stringify(urlToStore), (err, reply) => {
                        if (reply == 'OK') {
                            res.send(body);
                        }
                    })
                } else {
                    console.log("invalid url: " + error);
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

}