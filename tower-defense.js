'use strict';

let colors = {
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

const BASE_HP                            = 10;
const BASE_COST                          = 10;
const DEF_COST                           = 10;
const RES_COST                           = 10;
const INVADER_INITIAL_GOLD               = 0;
const INVADER_INITIAL_INCOME             = 10;
const INVADER_INITIAL_MAXBOOST           = 5;
const INVADER_MAXBOOST_UPGRADE_COST      = 50;
const INVADER_MAXBOOST_UPGRADE_INCREMENT = 5;

const BUILD_COST            = 10;
const BUILD_TIME            = 10;
const UPGRADE_COST          = 10;
const UPGRADE_TIME          = 10;
const BOMB_COOLDOWN         = 5;
const DEFENDER_INITIAL_GOLD = 50;
const DEFENDER_INITIAL_LIFE = 10;
const VALID_TOWER_TYPES     = ['turret', 'bomb', 'stunner'];

class Invader {
  constructor(hp, defense, stunRes) {
    this.pos      = 0;
    this.hp       = hp;
    this.maxhp    = hp;
    this.defense  = defense || 0;
    this.stunRes  = stunRes || 0;
    this.stunTime = 0;
  }

  damage(power) {
    this.hp -= Math.max(power - this.defense, 1);
    return this.hp <= 0; // return true if it should die
  }

  stun(power) {
    this.stunTime = Math.max(power - this.stunRes, 0);
  }
}

class Tower {
  constructor(type, pos) {
    this.level    = 0;
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

  upgrade(stat) {
    switch (stat) {
      case 'power':
      case 'range':
        this.level++;
        this[stat]++;
        this.cooldown = UPGRADE_TIME;
      default:
    }
  }
}

class Game {
  constructor(invaderAI, defenderAI) {
    this.invaderSlots     = new Array(100);
    this.towerSlots       = new Array(100);
    this.turnNumber       = 0;

    this.invaderAI        = invaderAI || (game => ({action: 'spawn'}));
    this.invaderGold      = INVADER_INITIAL_GOLD;
    this.invaderIncome    = INVADER_INITIAL_INCOME;
    this.invaderBoostMax  = INVADER_INITIAL_MAXBOOST;

    this.defenderAI       = defenderAI || (game => null);
    this.defenderGold     = DEFENDER_INITIAL_GOLD;
    this.defenderLife     = DEFENDER_INITIAL_LIFE;
  }

  spawnInvader({hp, defense, stunRes, ..._}) {
    hp = Math.max(hp || 0, 0);
    defense = Math.max(defense || 0, 0);
    stunRes = Math.max(stunRes || 0, 0);
    let cost = BASE_COST + hp + defense * DEF_COST + stunRes * RES_COST;
    let totalBoost = hp + defense + stunRes;
    if (
      !this.invaderSlots[0]
      && this.invaderGold >= cost
      && totalBoost <= this.invaderBoostMax
    ) {
      let invader = new Invader(BASE_HP + hp, defense, stunRes);
      this.invaderSlots[0] = invader;
      this.invaderGold -= cost;
      return invader;
    }
  }

  upgradeInvaders() {
    if (this.invaderGold >= INVADER_MAXBOOST_UPGRADE_COST) {
      this.invaderBoostMax += INVADER_MAXBOOST_UPGRADE_INCREMENT;
      this.invaderGold -= INVADER_MAXBOOST_UPGRADE_COST;
    }
  }

  buildTower({type, pos, ..._}) {
    if (
      pos != null && pos >= 0 && pos < 100 && !this.towerSlots[pos]
      && type && VALID_TOWER_TYPES.includes(type)
      && this.defenderGold >= BUILD_COST
    ) {
      let tower = new Tower(type, pos);
      this.towerSlots[pos] = tower;
      this.defenderGold -= BUILD_COST;
      return tower;
    }
  }

  upgradeTower({pos, stat, ..._}) {
    if (
      this.towerSlots[pos]
      && (stat === 'power' || stat === 'range')
      && this.defenderGold >= UPGRADE_COST
    ) {
      this.towerSlots[pos].upgrade(stat);
      this.defenderGold -= UPGRADE_COST;
    }
  }

  destroyTower({pos, ..._}) {
    if (this.towerSlots[pos]) {
      let tower = this.towerSlots[pos];
      this.towerSlots[pos] = null;
      this.defenderGold += (BUILD_COST + UPGRADE_COST * tower.level) / 2 | 0;
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
                this.defenderGold += 1;
              }
              break;
            }
          }
          break;
        case 'stunner':
          for (let i = tower.pos + tower.range; i >= tower.pos - tower.range; i--) {
            if (this.invaderSlots[i] && this.invaderSlots[i].stunTime === 0) {
              this.invaderSlots[i].stun(tower.power);
              tower.cooldown = tower.power + 1;
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
                  this.defenderGold += 1;
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
      this.invaderGold += this.invaderIncome;
      this.defenderGold += 1;
    }
    if (this.turnNumber % 100 == 0) {
      this.invaderIncome += this.turnNumber / 100 | 0;
    }

    let invaderAction  = this.invaderAI(this);
    let defenderAction = this.defenderAI(this);

    if (invaderAction) {
      switch (invaderAction.action) {
        case 'spawn':
          this.spawnInvader(invaderAction);
          break;
        case 'upgrade':
          this.upgradeInvaders();
          break;
        default:
          break;
      }
    }

    if (defenderAction) {
      switch (defenderAction.action) {
        case 'build':
          this.buildTower(defenderAction);
          break;
        case 'upgrade':
          this.upgradeTower(defenderAction);
          break;
        case 'destroy':
          this.destroyTower(defenderAction);
          break;
        default:
          break;
      }
    }

    return this.defenderLife > 0
  }

  draw() {
    let canvas = document.getElementById('viewport');
    let ctx = canvas.getContext('2d');

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colors.boardbg1;
    for (let i = 0; i < 10; i += 2) {
      ctx.fillRect(40 + 120 * i, 120, 120, 12);
    }
    ctx.fillStyle = colors.boardbg2;
    for (let i = 1; i < 10; i += 2) {
      ctx.fillRect(40 + 120 * i, 120, 120, 12);
    }
    ctx.strokeStyle = colors.boardlines;
    for (let i = 0; i < 100; i ++) {
      ctx.strokeRect(40 + 12 * i, 120, 12, 12)
    }

    for (let i = 0; i < 100; i ++) {
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

    for (let i = 0; i < 100; i ++) {
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
    ctx.fillText(`Invader Gold: ${this.invaderGold}`, 20, 300);
    ctx.fillText(`Invader Income: ${this.invaderIncome}`, 20, 350);
    ctx.fillText(`Defender Gold ${this.defenderGold}`, 660, 300);
    ctx.fillText(`Defender Life ${this.defenderLife}`, 660, 350);
  }

  run() {
  }
}

function simpleTurretBuilder() {
  let pos = 10;
  let built = 0;
  return function decideAction(game) {
    if (built < 100) {
      if (game.defenderGold >= BUILD_COST) {
        let action = {action: 'build', pos: pos, type: 'turret'};
        pos = (pos + 1) % 100;
        built ++;
        if (built == 100) {
          pos = 0;
        }
        return action;
      }
    }
    else {
      if (game.defenderGold >= UPGRADE_COST) {
        let action = {action: 'upgrade', pos: pos, stat: 'power'};
        pos = (pos + 1) % 100;
        return action;
      }
    }
  }
}


function newGame() {
  let game = new Game(null, simpleTurretBuilder());
  let doTurn = function() {
    if (game.takeTurn()) {
      window.setTimeout(doTurn, 100);
    }
    game.draw();
  }
  doTurn();
}
