var enums           = require('./enums'),
    config          = require('../conf.json'),
    GridManager     = require('./gridManager'),
    PlayersManager  = require('./playersManager');

// Defines
var MAX_PLAYERS   = 9;
var SERVER_CHAT_COLOR = '#c0392b';
var TIME_BEFORE_START = 5;

// History
var _foundWords = [];
var _scoreUpdates = [];

// Parameters
var _playersManager,
    _gridManager,
    _io,
    _gameState,
    _lastWordFoudTimestamp;

function startGame() {

  var Grid;
  var delay;

  try {
    Grid = _gridManager.getGrid();
    delay = (_playersManager.getNumberOfPlayers() > 1) ? TIME_BEFORE_START : 0;

    // Change game state
    _scoreUpdates = [];
    _foundWords = [];
    _gameState = enums.ServerState.OnGame;

    // Send grid to clients
    _io.sockets.emit('grid_event', { grid: Grid, timer: delay } );
  } catch (error) {
    console.error('\t[ERROR]: No grid loaded. Not starting.');
  }
}

function resetGame(gridID) {
  var infos;

  // Reset game state
  _gameState = enums.ServerState.WaitingForPlayers;

  // Reset players
  _playersManager.resetPlayersForNewGame();

  // Reset the grid
  _gridManager.resetGrid(gridID, function (grid) {
    if (grid == null) {
      // If an error occurs, exit
      console.error('[ERROR] Cannot retreive requested grid [' + gridID + ']');
      sendChatMessage('Oups, impossible de récupérer la grille ' + gridID + '!');
    }
    else {
      infos = _gridManager.getGridInfos();
      sendChatMessage('Grille ' + infos.provider + ' ' + infos.id + ' (Niveau ' + infos.level + ') prête !');

      // Send reset order to clients
      _io.sockets.emit('grid_reset');
    }
  });
}

function playerLog (socket, nick, monsterId) {
  var gridInfos = _gridManager.getGridInfos();

  // Retreive PlayerInstance
  var player = socket.PlayerInstance;
  // Set new player parameters
  player.setNick(nick);
  _playersManager.setMonsterToPlayer(player, monsterId);
  // Refresh monster list for unready players
  _io.sockets.emit('logos', _playersManager.getAvailableMonsters());

  // Bind found word event
  socket.on('wordValidation', function (wordObj) {
    checkWord(player, wordObj);
  });

  // Notify everyone about the new client
  sendChatMessage( nick + ' a rejoint la partie !<br/>' + _playersManager.getNumberOfPlayers() + ' joueurs connectés', undefined, undefined, _playersManager.getPlayerList());

  // Send grid informations to the player
  sendPlayerMessage(socket, 'Grille actuelle: ' + gridInfos.provider + ' ' + gridInfos.id + ' (Niveau ' + gridInfos.level + ')');
}

function bonusChecker(playerPoints, nbWordsRemaining) {
  var bonus = {
    points: 0,
    bonusList: []
  },
  now = new Date().getTime();

  // If it's the first word, add 4 bonus points
  if (_lastWordFoudTimestamp == null) {
    bonus.bonusList.push( { title: "Preum's !", points: 4 } );
    bonus.points += 4;
  }

  // If it's the last word
  if (nbWordsRemaining <= 0) {
    bonus.bonusList.push( { title: 'Finish him !', points: 4 } );
    bonus.points += 4;
  }

  // If it's the first word since the last 2 minutes, 5 points
  if ((now - _lastWordFoudTimestamp) > 120000) {
    bonus.bonusList.push( { title: 'Débloqueur', points: 5 } );
    bonus.points += 5;
  }

  // If it's a big word, add 3 points
  if (playerPoints >= 6) {
    bonus.bonusList.push( { title: 'Gros mot !', points: 3 } );
    bonus.points += 3;
  }

  return (bonus);
}

function checkWord(player, wordObj) {
  var points,
      bonuses;

  // Check word
  points = _gridManager.checkPlayerWord(wordObj);

  // If the players has some points, it's mean it's the right word ! Notify players about it
  if (points >= 0) {

    // Notify all clients about this word
    wordObj.color = player.getColor();
    _io.sockets.emit('word_founded', wordObj);
    _foundWords.push(wordObj);

    // Check for bonuses
    bonuses = bonusChecker(points, _gridManager.getNbRemainingWords());

    // Remember time this last word had been found
    _lastWordFoudTimestamp = new Date().getTime();

    // Update player score and notify clients
    player.updateScore(points + bonuses.points);
    var scoreUpdate = {
      playerID: player.getID(),
      score: player.getScore(),
      words: player.getNbWords(),
      progress: _gridManager.getAccomplishmentRate(
        player.getScore(),
        _playersManager.getNumberOfPlayers()
      ),
      bonus: bonuses.bonusList
    };
    _io.sockets.emit("score_update", scoreUpdate);
    _scoreUpdates.push(scoreUpdate);

    if (_gridManager.getNbRemainingWords() <= 0) {
      console.log('[SERVER] Game over ! Sending player\'s notification...');
      _io.sockets.emit('game_over', _playersManager.getWinner().getPlayerObject());
    }
  }
}

function checkServerCommand(message) {
  var number;

  // If it's not a server command
  if (message[0] != '!')
    return (false);

  // Check the start command
  if ((_gameState == enums.ServerState.WaitingForPlayers) && (message == '!start')) {
    startGame();
    return (true);
  }

  // Check the change grid command
  if (message.indexOf('!grid') >= 0) {
    // Retreive grid number and reset game parameters
    number = message.substr(6);
    resetGame(number);
    return (true);
  }

  // Check the change grid command
  if (message.indexOf('!stop') >= 0) {
    resetGame(0);
    return (true);
  }

  return (false);
}

function sendChatMessage(Message, sender, color, playerList) {
  if (sender === undefined) {
    sender = 'server';
    color = SERVER_CHAT_COLOR;
  }

  _io.sockets.emit('chat', { message: Message, from: sender, color: color, players: playerList } );
}

function sendPlayerMessage(socket, Message) {
  socket.emit('chat', { message: Message, from: 'server', color: SERVER_CHAT_COLOR });
}


/**
 *  Start mfl server.
 */
exports.startMflServer = function (server, desiredGrid) {
  // Instanciiate io module with proper parameters
  _io = require('socket.io')(server);

  // Retreive the grid
  _gridManager = new GridManager();
  _gridManager.retreiveAndParseGrid(desiredGrid, function (grid) {
    if (grid == null) {
      // If an error occurs, exit
      console.error('[ERROR] Cannot retreive grid. Abort server.');
      process.exit(1);
    }
  });

  // Create playersManager instance and register events
  _playersManager = new PlayersManager();
  _playersManager.on('players-ready', function () {
});


  // On new client connection
  _io.on('connection', function (socket) {
    // If it remains slots in the room, add player and bind events
    if (_playersManager.getNumberOfPlayers() < MAX_PLAYERS) {

      // Add new player
      var player = _playersManager.addNewPlayer(socket);

      // Register to socket events
      socket.on('disconnect', function () {
        // When a player disconnect, retreive player instance
        var player = socket.PlayerInstance
        sendChatMessage( player.getNick() + ' a quitté la partie');
        _playersManager.removePlayer(player);
        player = null;
      });

      socket.on('userIsReady', function (infos) {
        // Log player, bind events and notify everyone
        playerLog(socket, infos.nick, infos.monster);

        // If the player joined during a game, send them the history
        if (_gameState == enums.ServerState.OnGame) {
          socket.emit("grid_event", { grid: _gridManager.getGrid(), timer: 0 });
          _foundWords.forEach(event => {
            socket.emit("word_founded", event);
          });
          _scoreUpdates.forEach(scoreUpdate => {
            socket.emit("score_update", scoreUpdate);
            _io.sockets.emit("score_update", scoreUpdate);
          });
        }
      });

      socket.on('chat', function (message) {
        // If it's a message for the server, treat it
        // Else broadcast the message to everyone
        if (checkServerCommand(message) == false) {
          sendChatMessage(message, socket.PlayerInstance.getNick(), socket.PlayerInstance.getColor());
        }
      });

      // Remember PlayerInstance and push it to the player list
      socket.PlayerInstance= player;

      // Send to the player availables logos
      socket.emit('logos', _playersManager.getAvailableMonsters());
    }
    // Else notify players he can't play for the moment
    else {
      // To do it, returns an empty list of available logos == null
      socket.emit('logos', null);
    }

  });


  // Set game state and print ready message
  _gameState = enums.ServerState.WaitingForPlayers;
  console.log('Game started and waiting for players on port ' + config.SOCKET_PORT);
};
