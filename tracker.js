// Global variables
let pages = [];
let currentPage;

let game;
let mainMenu;
let playbackPage;

let images = [];
let ball = [];
let paused;
let rugbyPaused;
let goalImg;
let homePng;
let awayPng;

let appWidth = 1200;
let appHeight = 800;
let connectionLost = false;
let selectedMode = 'live';

// Constants
const MILLI_SEC_DELAY = 100;
const START_LABEL = 'Start';
const LIST_LABEL = 'Stadium Selector:';

// State Enum
const State = {
  PAUSED: 'PAUSED',
  ONGOING: 'ONGOING',
  FINISHED: 'FINISHED',
};

// Stadiums array
const stadiums = [
  'Demonstration',
  'Marvel Stadium',
  'Dalymount Park',
  'Dublin'
];

// WebSocket URLs
const DALYMOUNT_PARK = "wss://cxgmjito89.execute-api.eu-west-1.amazonaws.com/production";
const MARVEL_STADIUM = "wss://tgh899snfl.execute-api.ap-southeast-2.amazonaws.com/production";
const DUBLIN = "wss://fu6ntwe8cc.execute-api.eu-west-1.amazonaws.com/production";

// Possession constants
const POSSESSION_NEUTRAL = 66;
const POSSESSION_HOME = 1;
const POSSESSION_HOME_COLOUR = [255, 0, 0];
const POSSESSION_AWAY = 0;
const POSSESSION_AWAY_COLOUR = [0, 0, 255];

// Font and images
let myFont;
let backgroundImg;

function preload() {
  myFont = loadFont('assets/arial.ttf');
  backgroundImg = loadImage('images/New Background.png');

  images[0] = loadImage('images/Australia.png');
  images[1] = loadImage('images/Australia.png');
  images[2] = loadImage('images/Australia.png');
  images[3] = loadImage('images/Australia.png');

  paused = loadImage('images/New Pause.png');
  rugbyPaused = loadImage('images/Pause.png');
  goalImg = loadImage('images/goal.gif');

  ball[0] = loadImage('images/AFLBall.png');
  ball[1] = loadImage('images/AFLBall.png');
  ball[2] = loadImage('images/AFLBall.png');

  homePng = loadImage('images/irfu.png');  // home image (Ireland)
  awayPng = loadImage('images/england.png');   // away image (England)
}

class Page {
  constructor() {
    this.controllers = [];
    this.background = null;
    this.font = null;
    this.visible = true;
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    for (let p of pages) {
      if (p === this) continue;
      p.hide();
    }
    if (this.background) background(this.background);
    for (let c of this.controllers) c.show();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    for (let c of this.controllers) c.hide();
  }
}

function addPages(...pgs) {
  for (let p of pgs) {
    pages.push(p);
    p.hide();
  }
}

class Game extends Page {
  constructor() {
    super();
    this.state = State.PAUSED;
    this.time = millis();
    this.passKick = 0;     // Was "pass" in old code
    this.tryScore = 0;     // Was "goal" in old code
    this.conversion = 0;   // Was "C" in old code
    this.ruck = 0;         // Was "R" in old code
    this.scrumMaul = 0;    // Was "S" in old code

    this.home = 0;
    this.away = 0;
    this.tutorial = 0;
    this.possession = POSSESSION_NEUTRAL;
    this.timestamp = 0;
    this.checkpoint = 0;
    this.selectedImage = -1;
    this.action = null;
    this.stadium = null;
    this.url = null;
    this.pausedImg = paused;
    this.sendCounter = 0;

    // New: List of action messages to display
    this.actionMessages = [];
  }

  // Helper to add an action message with a given duration (in ms)
  addActionMessage(msg, duration) {
    this.actionMessages.push({ text: msg, expire: millis() + duration });
  }

  setStadium(url, stadium, selectedImageIndex) {
    this.url = url;
    this.stadium = stadium;
    this.selectedImage = selectedImageIndex;
    this.pausedImg = stadium === 'Aviva Stadium' ? rugbyPaused : paused;

    switch (url) {
      case DALYMOUNT_PARK:
        this.action = 'dalymount_IRL_sendMessage';
        break;
      case MARVEL_STADIUM:
        this.action = 'marvel_AUS_sendMessage';
        break;
      case DUBLIN:
        this.action = 'dublin_IRL_sendMessage';
        break;
    }
  }

  toJsonRequest() {
    if (!this.action) {
      console.log("Can't send message without stadium");
      return;
    }

    const constrainedX = constrain(mouseX, 0, appWidth);
    const constrainedY = constrain(mouseY, 0, appHeight);
    const scaleFactorX = 102 / appWidth;
    const scaleFactorY = 64 / appHeight;

    // Only single-letter fields in the JSON payload:
    return JSON.stringify({
      action: this.action,
      message: {
        T: parseFloat(this.timestamp.toFixed(2)),
        X: parseFloat((constrainedX * scaleFactorX).toFixed(2)),
        Y: parseFloat((constrainedY * scaleFactorY).toFixed(2)),
        P: this.possession,
        Pa: this.passKick,
        G: this.tryScore,        // "G" now represents a Try in rugby!
        C: this.conversion,
        R: this.ruck,
        S: this.scrumMaul,
      },
    });
  }

  show() {
    super.show();
    if (this.selectedImage < 0 || this.selectedImage >= images.length) {
      background(0);
      fill(255);
      textAlign(CENTER, CENTER);
      textSize(32);
      text('Please select a stadium from the main menu.', appWidth / 2, appHeight / 2);
      return;
    }

    const fixedWidth = 1200;
    const fixedHeight = 800;
    const imgAspect = images[this.selectedImage].width / images[this.selectedImage].height;
    const canvasAspect = fixedWidth / fixedHeight;

    let imgWidth, imgHeight, imgX, imgY;
    if (canvasAspect > imgAspect) {
      imgHeight = fixedHeight;
      imgWidth = imgHeight * imgAspect;
      imgX = (fixedWidth - imgWidth) / 2;
      imgY = 0;
    } else {
      imgWidth = fixedWidth;
      imgHeight = imgWidth / imgAspect;
      imgX = 0;
      imgY = (fixedHeight - imgHeight) / 2;
    }

    image(images[this.selectedImage], imgX, imgY, imgWidth, imgHeight);

    // Instead, draw a small image at the mouse position.
    const imgSize = 65; // Same as the original circle's diameter
    if (this.possession === POSSESSION_HOME) {
      image(homePng, mouseX - imgSize / 2, mouseY - imgSize / 2, imgSize, imgSize);
    } else if (this.possession === POSSESSION_AWAY) {
      image(awayPng, mouseX - imgSize / 2, mouseY - imgSize / 2, imgSize, imgSize);
    }

    if (this.state === State.PAUSED) {
      imageMode(CORNER);
      image(this.pausedImg, 0, 0, fixedWidth, fixedHeight);
    }

    push();
    textSize(25);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    fill('#004d61');
    let now = millis();
    // Remove expired messages
    this.actionMessages = this.actionMessages.filter(msgObj => now < msgObj.expire);
    if (this.actionMessages.length > 0) {
      let message = this.actionMessages[this.actionMessages.length - 1].text.toUpperCase();
      // Draw the text in a box spanning the entire canvas width
      text(message, 0, 55, width, 32.9);
    }
    pop();
    
    const clock = millis();
    if (this.state === State.ONGOING && clock > this.time + MILLI_SEC_DELAY) {
      console.log(`Sending update #${this.sendCounter++}`);
      this.time = clock;
      this.timestamp = this.time / 1000.0 - this.checkpoint;
      webSendJson(this.toJsonRequest());
      this.reset();
    }
  }

  onKeyPressed() {
    const k = key.toUpperCase();
    if (k === 'E') return;

    // Space toggles pause
    if (k === ' ') {
      this.state = this.state === State.PAUSED ? State.ONGOING : State.PAUSED;
      if (this.state === State.PAUSED) this.checkpoint = this.timestamp;
      return;
    }

    // Do not record events if game is paused
    if (this.state !== State.ONGOING) return;

    /*
      Rugby Key Mapping:
      1 => Try (G=1)
      2 => Conversion (C=1)
      A => Pass/Kick (Pa=1)
      D => Ruck (R=1)
      F => Scrum/Maul (S= toggled)
    */
    switch (k) {
      case '1':
        this.tryScore = 1;
        this.addActionMessage("Try", 4000); // Display "Try" for 4 seconds
        break;
      case '2':
        this.conversion = 1;
        this.addActionMessage("Conversion", 2000); // Display "Conversion" for 2 seconds
        break;
      case 'A':
        this.passKick = 1;
        this.addActionMessage("Pass", 500); // Display "Pass" briefly
        break;
      case 'D':
        this.ruck = 1;
        this.addActionMessage("Ruck", 500); // Display "Ruck" briefly
        break;
      case 'F':
        this.scrumMaul = this.scrumMaul === 0 ? 1 : 0;
        if (this.scrumMaul === 1) {
          this.addActionMessage("Scrum", 1000); // Display "Scrum" briefly when toggled on
        }
        break;
    }
  }

  handleMousePressed(event) {
    // Left-click toggles possession: home(1) / away(0)
    if (event.button === 0) {
      this.possession = this.possession === POSSESSION_HOME ? POSSESSION_AWAY : POSSESSION_HOME;
    }
    // Middle-click or wheel-click triggers a Pass/Kick
    if (event.button === 4) {
      this.passKick = 1;
      this.addActionMessage("Pass", 500);
    }
    // Right-click triggers a Try
    if (event.button === 2 || event.button === 3) {
      this.tryScore = 1;
      this.addActionMessage("Try", 4000);
    }
  }

  start() {
    this.state = State.PAUSED;
    webConnect(this.url);
  }

  finish() {
    this.state = State.FINISHED;
    webDisconnect();
  }

  reset() {
    this.passKick = 0;
    this.tryScore = 0;
    this.conversion = 0;
    this.ruck = 0;
    this.scrumMaul = 0; 
  }
}

class MainPage extends Page {
  constructor() {
    super();
    this.font = myFont;
    this.background = backgroundImg;
    this.startButton = null;
    this.stadiumList = null;
    this.modeList = null;
    this.initGUI();
  }

  initGUI() {
    this.modeList = createSelect();
    this.modeList.parent('ui-container');
    this.modeList.class('custom-dropdown');
    let modePlaceholder = createElement('option', 'Select Mode');
    modePlaceholder.attribute('disabled', '');
    modePlaceholder.parent(this.modeList);
    this.modeList.option('Live Tracker Mode', 'live');
    this.modeList.option('Match Playback Mode', 'playback');
    this.modeList.changed(() => selectedMode = this.modeList.value());
    this.controllers.push(this.modeList);

    this.stadiumList = createSelect();
    this.stadiumList.parent('ui-container');
    this.stadiumList.class('custom-dropdown');
    let placeholderOption = createElement('option', LIST_LABEL);
    placeholderOption.attribute('disabled', '');
    placeholderOption.parent(this.stadiumList);
    for (let i = 0; i < stadiums.length; i++) {
      this.stadiumList.option(stadiums[i], i);
    }
    this.stadiumList.changed(() => this.onClickList());
    this.controllers.push(this.stadiumList);

    this.startButton = createButton(START_LABEL);
    this.startButton.parent('ui-container');
    this.startButton.class('start-button');
    this.startButton.mousePressed(() => this.onClickStart());
    this.controllers.push(this.startButton);
  }

  onClickStart() {
    if (selectedMode === 'live') {
      game.start();
      currentPage = game;
    } else if (selectedMode === 'playback') {
      playbackPage.start();
      currentPage = playbackPage;
    }
  }

  onClickList() {
    const selectedValue = this.stadiumList.value();
    if (selectedValue >= 0) this.onSelectStadium(parseInt(selectedValue));
  }

  onSelectStadium(selectedStadium) {
    const stadiumName = stadiums[selectedStadium];
    let url = null;
    let imgIndex = 0;
    
    switch (selectedStadium) {
      case 0: // Demonstration
      url = DALYMOUNT_PARK;
        imgIndex = 0;
        break;
      case 1:
        url = MARVEL_STADIUM;
        break;
      case 2:
        url = DALYMOUNT_PARK;
        break;
      case 3: // Aviva Stadium
        url = DUBLIN;
        imgIndex = 3;
        break;
      case 4: // Aviva - Dublin
        url = DUBLIN;
        imgIndex = 3;
        break;
    }
    
    if (game) {
      game.setStadium(url, stadiumName, imgIndex);
      console.log(`Selected stadium: ${stadiumName}, Image index: ${imgIndex}`);
    }
    if (playbackPage) playbackPage.setStadium(url, stadiumName);
  }

  show() {
    super.show();
    if (this.background) background(this.background);
  }
}

class PlaybackPage extends Page {
  constructor() {
    super();
    this.timestamp = 0;
    this.action = null;
    this.url = null;
    this.isPaused = false;
    this.counter = 0;
    this.jsonData = null;
    this.jsonArray = null;
    this.jsonSize = 0;
    this.startPlaybackTime = 0;
    this.baseT = 0;
    this.pauseStartTime = 0;
    this.totalPausedDuration = 0;

    loadJSON('data/match1.json', (data) => {
      this.jsonData = data;
      this.jsonArray = this.jsonData.data;
      this.jsonSize = this.jsonArray.length;
      if (this.jsonSize > 0) {
        this.baseT = this.jsonArray[0].T;
      }
    });

    this.pauseButton = null;
    this.exitButton = null;
    this.initGUI();
  }

  initGUI() {
    this.pauseButton = createButton('Pause');
    this.pauseButton.class('control-button');
    this.pauseButton.parent('ui-container');
    this.pauseButton.mousePressed(() => this.togglePause());

    this.exitButton = createButton('Exit');
    this.exitButton.class('control-button');
    this.exitButton.parent('ui-container');
    this.exitButton.mousePressed(() => this.exitToMenu());

    this.controllers.push(this.pauseButton);
    this.controllers.push(this.exitButton);
  }

  setStadium(url, stadium, selectedImageIndex) {
    this.url = url;
    this.stadium = stadium;
    this.selectedImage = selectedImageIndex;
    
    // Only use rugby pause for Aviva
    this.pausedImg = (stadium === 'Aviva Stadium') ? rugbyPaused : paused;

    switch (url) {
      case DALYMOUNT_PARK:
        this.action = 'dalymount_IRL_sendMessage';
        break;
      case MARVEL_STADIUM:
        this.action = 'marvel_AUS_sendMessage';
        break;
      case DUBLIN:
        this.action = 'dublin_IRL_sendMessage';
        break;
    }
  }

  start() {
    webConnect(this.url);
    this.startPlaybackTime = millis();
    this.totalPausedDuration = 0;
    this.isPaused = false;
    this.counter = 0;
  }

  finish() {
    webDisconnect();
  }

  exitToMenu() {
    this.finish();
    currentPage = mainMenu;
    mainMenu.show();
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.pauseButton.html('Play');
      this.pauseStartTime = millis();
    } else {
      this.pauseButton.html('Pause');
      let pausedInterval = millis() - this.pauseStartTime;
      this.totalPausedDuration += pausedInterval;
    }
  }

  show() {
    super.show();
    background(50);

    if (!this.jsonArray || this.isPaused) return;

    if (this.counter >= this.jsonSize) {
      // Restart from the beginning once finished
      this.counter = 0;
      this.startPlaybackTime = millis();
      this.totalPausedDuration = 0;
    }

    let currentTime = millis();
    let entry = this.jsonArray[this.counter];
    let scheduledTime = this.startPlaybackTime + (entry.T - this.baseT) * 1000 + this.totalPausedDuration;

    if (currentTime >= scheduledTime) {
      this.sendJsonEntry(entry);
      this.counter++;
    }
  }

  // We keep single-letter keys in the JSON,
  // but note that "G" is a Try, "Pa" is Pass/Kick, etc.
  sendJsonEntry(entry) {
    let msg = JSON.stringify({
      action: this.action,
      message: {
        T: entry.T,
        X: entry.X,
        Y: entry.Y,
        P: entry.P,
        Pa: entry.Pa,
        G: entry.G,
        C: entry.C,
        R: entry.R,
        S: entry.S
      }
    });
    webSendJson(msg);
  }
}

// Web communication code
let requests = [];
let socket = null;
let url = null;

function webConnect(uri) {
  if (socket && socket.readyState === WebSocket.OPEN) return;
  url = uri;
  socket = new WebSocket(uri);
  socket.onopen = () => connectionLost = false;
  socket.onclose = () => connectionLost = true;
  socket.onerror = (error) => console.error('WebSocket error:', error);
}

function webDisconnect() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  while (requests.length > 0) {
    if (socket.readyState === WebSocket.OPEN) socket.send(requests.shift());
  }
  socket.close();
}

function webSendJson(json) {
  console.log('Sending to MQTT:', json);
  requests.push(json);
}

function webSocketEvent(msg) {
  console.log('Received:', msg);
}

function webThread() {
  setInterval(() => {
    if (requests.length > 0 && socket?.readyState === WebSocket.OPEN) {
      socket.send(requests.shift());
    }
  }, 100);
}

function checkInternetConnectionThread() {
  let wasConnected = navigator.onLine;
  setInterval(() => {
    const isConnected = navigator.onLine;
    if (wasConnected !== isConnected) {
      connectionLost = !isConnected;
      wasConnected = isConnected;
    }
  }, 5000);
}

function webSetup() {
  webThread();
  checkInternetConnectionThread();
  window.addEventListener('online', () => connectionLost = false);
  window.addEventListener('offline', () => connectionLost = true);
}

function setup() {
  const cnv = createCanvas(appWidth, appHeight);
  cnv.parent('canvas-container');
  cnv.elt.getContext('2d', { willReadFrequently: true });

  game = new Game();
  mainMenu = new MainPage();
  playbackPage = new PlaybackPage();

  addPages(game, mainMenu, playbackPage);
  currentPage = mainMenu;
  currentPage.show();

  frameRate(60);
  webSetup();
}

function draw() {
  if (currentPage?.show) currentPage.show();
  if (connectionLost) displayConnectionWarning();
}

function displayConnectionWarning() {
  fill(255, 0, 0);
  textSize(32);
  textAlign(CENTER, CENTER);
  text('Connection lost!', width / 2, height / 2);
}

function keyPressed() {
  if (currentPage?.onKeyPressed) currentPage.onKeyPressed();
}

function mousePressed(event) {
  if (currentPage?.handleMousePressed) currentPage.handleMousePressed(event);
  // Prevent default context menu on right/middle click if desired
  if (event.button === 4 || event.button === 2 || event.button === 3) {
    event.preventDefault();
  }
}