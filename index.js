var http = require('http');
var url = require('url');
var request = require('request');
var serverPort = 5000;

http.createServer(onRequest).listen(serverPort);

function onRequest(req, res) {
    console.log("I got it! " + req);
}
