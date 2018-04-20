'use strict';

const colors = {
  background:    '#d8d89a',
  boardbg1:      '#8bc34a',
  boardbg2:      '#d6af5c',
  boardlines:    '#795548',

  invader:       '#ff1744',
  invaderhp:     '#00ff00',
  invaderdmg:    '#ff0000',
  invaderstun:   '#00bcd4',

  turret:        '#673ab7',
  stunner:       '#82b1ff',
  bomb:          '#263238',
  towercooldown: '#00bcd4',

  text:          '#000000'
}

const BUILD_TIME = 10;
const DEFENDER_INITIAL_LIFE = 10;
const BOMB_COOLDOWN = 5;

class Invader {
  constructor(hp) {
    this.pos      = 0;
    this.hp       = hp;
    this.maxhp    = hp;
    this.stunTime = 0;
  }

  damage(amount) {
    this.hp -= amount;
    return this.hp <= 0; // return true if it should die
  }
}

class Tower {
  constructor(type, pos) {
    this.pos      = pos;
    this.power    = 1;
    this.range    = 1;
    this.cooldown = BUILD_TIME;
    this.type     = type;
    switch (type) {
      case 'bomb':
        this.range = 2;
        break;
      case 'stunner':
        this.range = 0;
        break;
    }
  }
}

class Game {
  constructor(invaderAI, defenderAI) {
    this.invaderSlots     = new Array(100);
    this.towerSlots       = new Array(100);
    this.invaderAI        = invaderAI;
    this.invaderPoints    = 0;
    this.invaderPointRate = 10;
    this.defenderAI       = defenderAI;
    this.defenderPoints   = 1;
    this.defenderLife     = DEFENDER_INITIAL_LIFE;
    this.turnNumber       = 0;
  }

  spawnInvader(strength) {
    if (!this.invaderSlots[0]) {
      var invader = new Invader(strength);
      this.invaderSlots[0] = invader;
      this.invaderPoints -= strength;
      return invader;
    }
  }

  buildTower(type, pos) {
    if (!this.towerSlots[pos]) {
      var tower = new Tower(type, pos);
      this.towerSlots[pos] = tower;
      return tower;
    }
  }

  takeTurn() {
    // Attack invaders
    for (let j = 99; j >= 0; j--) {
      let tower = this.towerSlots[j];
      if (!tower) continue;
      if (tower.cooldown) {
        tower.cooldown--;
        continue;
      }
      switch (tower.type) {
        case 'turret':
          for (let i = tower.pos + tower.range; i >= tower.pos - tower.range; i--) {
            if (this.invaderSlots[i]) {
              if (this.invaderSlots[i].damage(tower.power)) {
                this.invaderSlots[i] = null;
              }
              break;
            }
          }
          break;
        case 'stunner':
          for (let i = tower.pos + tower.range; i >= tower.pos - tower.range; i--) {
            if (this.invaderSlots[i] && this.invaderSlots[i].stunTime === 0) {
              this.invaderSlots[i].stunTime = tower.power;
              tower.cooldown = tower.power * 2;
              break;
            }
          }
          break;
        case 'bomb':
          if (this.invaderSlots[tower.pos]) { // Only explodes if there is an invader immediately in front of it
            for (let i = tower.pos - tower.range; i <= tower.pos + tower.range; i++) {
              if (this.invaderSlots[i]) {
                if (this.invaderSlots[i].damage(tower.power)) {
                  this.invaderSlots[i] = null;
                }
                tower.cooldown = BOMB_COOLDOWN;
              }
            }
          }
          break;
      }
    }
    // Move invaders
    for (let i = 99; i >= 0; i--) {
      let invader = this.invaderSlots[i];
      if (invader) {
        if (invader.stunTime > 0) {
          invader.stunTime--;
          continue;
        }
        if (!this.invaderSlots[i + 1]) {
          this.invaderSlots[i] = null;
          if (i === 99) {
            this.defenderLife--;
          }
          else {
            this.invaderSlots[++invader.pos] = invader;
          }
        }
      }
    }

    this.turnNumber++;
    if (this.turnNumber % 10 === 0) {
      this.invaderPoints += this.invaderPointRate;
    }
    if (this.turnNumber % 100 == 0) {
      this.invaderPointRate++;
    }

    if (this.invaderPoints >= 10) {
      this.spawnInvader(10);
    }

    return this.defenderLife > 0
  }

  draw() {
    var canvas = document.getElementById('viewport');
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colors.boardbg1;
    for (var i = 0; i < 10; i += 2) {
      ctx.fillRect(40 + 120 * i, 120, 120, 12);
    }
    ctx.fillStyle = colors.boardbg2;
    for (var i = 1; i < 10; i += 2) {
      ctx.fillRect(40 + 120 * i, 120, 120, 12);
    }
    ctx.strokeStyle = colors.boardlines;
    for (var i = 0; i < 100; i ++) {
      ctx.strokeRect(40 + 12 * i, 120, 12, 12)
    }

    for (var i = 0; i < 100; i ++) {
      let invader = this.invaderSlots[i];
      if (invader) {
        ctx.fillStyle = colors.invader;
        ctx.beginPath();
        ctx.arc(46 + 12 * i, 126, 4, 0, 2*Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = colors.invaderdmg;
        ctx.fillRect(42 + 12 * i, 96, 4, 20);
        ctx.fillStyle = colors.invaderhp;
        let pixhp = 20 * (invader.hp / invader.maxhp);
        ctx.fillRect(42 + 12 * i, 116 - pixhp, 4, pixhp);
        ctx.fillStyle = colors.invaderstun;
        ctx.fillRect(46 + 12 * i, 116 - invader.stunTime * 4, 4, invader.stunTime * 4);
      }
    }

    for (var i = 0; i < 100; i ++) {
      let tower = this.towerSlots[i];
      if (tower) {
        ctx.fillStyle = colors[this.towerSlots[i].type]
        ctx.beginPath();
        ctx.arc(46 + 12 * i, 138, 4, 0, 2*Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = colors.towercooldown;
        ctx.fillRect(44 + 12 * i, 148, 4, tower.cooldown * 2);
      }
    }

    ctx.fillStyle = colors.text;
    ctx.font = "32px sans-serif";
    ctx.fillText(`Turn ${this.turnNumber}`, 20, 50);
    ctx.fillText(`Invader Points: ${this.invaderPoints}`, 20, 300);
    ctx.fillText(`Defender Points ${this.defenderPoints}`, 20, 350);
    ctx.fillText(`Defender Life ${this.defenderLife}`, 20, 400);
  }
}

function newGame() {
  var game = new Game();
  game.buildTower('turret', 25);
  game.buildTower('turret', 30);
  game.buildTower('bomb', 60);
  game.buildTower('turret', 61);
  game.buildTower('stunner', 62);
  game.buildTower('turret', 63);
  game.buildTower('turret', 90);
  game.spawnInvader(10);
  let doTurn = function() {
    if (game.takeTurn()) {
      window.setTimeout(doTurn, 100);
    }
    game.draw();
  }
  doTurn();
}
