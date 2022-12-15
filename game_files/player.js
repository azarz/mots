class Player {
  constructor(socket, uid) {
    this._socket = socket;
    this._playerTinyObject = {
      id: uid,
      nick: '',
      monster: null,
      score: 0,
      nbWords: 0
    };
  }
  getMonster() {
    return this._playerTinyObject.monster;
  }
  getNick() { return (this._playerTinyObject.nick); }
  setNick(nick) {
    this._playerTinyObject.nick = nick;
    console.info('Please call me [' + nick + '] !');
  }
  setMonster(monster) { this._playerTinyObject.monster = monster; }
  getID() { return (this._playerTinyObject.id); }
  getScore() { return (this._playerTinyObject.score); }
  getNbWords() { return (this._playerTinyObject.nbWords); }
  getColor() { return (this._playerTinyObject.monster.color); }
  getPlayerObject() { return (this._playerTinyObject); }
  updateScore(points) {
    this._playerTinyObject.score += points;
    this._playerTinyObject.nbWords++;
  }
  resetPlayerInfos() {
    this._playerTinyObject.score = 0;
    this._playerTinyObject.nbWords = 0;
  }
};

module.exports = Player;
