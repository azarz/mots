/**
 * Module dependencies.
 */
var express = require('express'),
    routes  = require('./routes'),
    http  = require('http'),
    path  = require('path'),
    app   = express(),
    config  = require('./conf.json'),
    mfl   = require('./game_files/motsFleches'),
    favicon = require('serve-favicon'),
    methodOverride = require('method-override'),
    errorhandler = require('errorhandler'),

    _gridNumber = 0;


const PORT = process.env.PORT || 3000

// all environments
app.set('port', PORT);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride());
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(errorhandler());
}

app.get('/', routes.index);
app.get('/conf.json', function(req, res) {
    res.json({ SOCKET_ADDR: config.SOCKET_ADDR, SOCKET_PORT: config.SOCKET_PORT });
});

// Start server
var server = http.createServer(app);



// Retreive command line arguments
if (process.argv[2]) {
  // If the user wants the default grid (debug purpose)
  if ((isNaN(process.argv[2])) && (process.argv[2].toLowerCase() == 'default'))
    _gridNumber = -1;
  // Else if the user try to retreive a special grid
  else if (!isNaN(process.argv[2]))
    _gridNumber = process.argv[2];
}

mfl.startMflServer(server, _gridNumber);

server.listen(app.get('port'), onServerReady);

/** Call when the express server has started */
async function onServerReady() {
  console.log('Express server listening on port ' + app.get('port'));

  console.log(`\n\n\tWaiting for players at ${config.SOCKET_ADDR}:${PORT}\n\n`);

  // Load desired grid in parameter.
  // -1 to retreive the day grid, 0 for the default one or any number for a special one

}
