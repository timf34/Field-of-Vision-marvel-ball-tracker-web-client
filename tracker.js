// Global variables  
let pages = [];
let currentPage;

let game;
let mainMenu;
let playbackPage;

let images = []; // pitch images

// Sport–specific ball images (for possession indicators)
let ballFootballHome, ballFootballAway;
let ballAFLHome, ballAFLAway;
let ballRugbyHome, ballRugbyAway;

let paused;      // Football pause image
let rugbyPaused; // Rugby pause image
let aflPaused;   // AFL pause image

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
  'Aviva Stadium',
  'Aviva - Dublin',
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

// Font and background image
let myFont;
let backgroundImg;

function preload() {
  myFont = loadFont('assets/arial.ttf');
  backgroundImg = loadImage('images/background.png');

  /* 
    Setup pitch images:
    - For Football (Demonstration & Dalymount Park): use "football pitch.png"
    - For AFL (Marvel Stadium): use "afl pitch.png"
    - For Rugby (Aviva Stadium & Aviva - Dublin): use "rugby pitch.png"
  */
  images[0] = loadImage('images/football pitch.png');  // Demonstration (Football)
  images[1] = loadImage('images/afl pitch.png');         // Marvel Stadium (AFL)
  images[2] = loadImage('images/football pitch.png');    // Dalymount Park (Football)
  images[3] = loadImage('images/rugby pitch.png');       // Aviva Stadium / Aviva - Dublin (Rugby)

  // Load pause images based on sport:
  paused = loadImage('images/football pause.png');
  rugbyPaused = loadImage('images/rugby pause.png');
  aflPaused = loadImage('images/afl pause.png');

  // Load ball images for each sport (using the provided file names)
  // For Football:
  ballFootballHome = loadImage('images/football home.png');
  ballFootballAway = loadImage('images/football away.png');
  // For AFL:
  ballAFLHome = loadImage('images/afl home.png');
  ballAFLAway = loadImage('images/afl away.png');
  // For Rugby:
  ballRugbyHome = loadImage('images/rugby home.png');
  ballRugbyAway = loadImage('images/rugby away.png');
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
    this.passKick = 0;     // Pass/Kick flag
    this.tryScore = 0;     // For Football/AFL: "Goal"; for Rugby: "Try"
    this.conversion = 0;   // For Rugby: Conversion; for AFL: "Behind"
    this.ruck = 0;         // For Rugby: Ruck; for AFL: "Mark"
    this.scrumMaul = 0;    // For Rugby: Scrum/Maul toggle
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
    this.sport = ""; // Set based on selectedImage index

    // List of action messages to display
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
    // Determine sport based on selectedImage index:
    // 0 and 2: Football, 1: AFL, 3: Rugby
    if (selectedImageIndex === 0 || selectedImageIndex === 2) {
      this.sport = "football";
      this.pausedImg = paused;
    } else if (selectedImageIndex === 1) {
      this.sport = "AFL";
      this.pausedImg = aflPaused;
    } else if (selectedImageIndex === 3) {
      this.sport = "rugby";
      this.pausedImg = rugbyPaused;
    }

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

    return JSON.stringify({
      action: this.action,
      message: {
        T: parseFloat(this.timestamp.toFixed(2)),
        X: parseFloat((constrainedX * scaleFactorX).toFixed(2)),
        Y: parseFloat((constrainedY * scaleFactorY).toFixed(2)),
        P: this.possession,
        Pa: this.passKick,
        G: this.tryScore,
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

    // Draw the sport–specific ball image at the mouse position based on possession.
    const imgSize = 65;
    if (this.possession === POSSESSION_HOME) {
      if (this.sport === "football") {
        image(ballFootballHome, mouseX - imgSize / 2, mouseY - imgSize / 2, imgSize, imgSize);
      } else if (this.sport === "AFL") {
        image(ballAFLHome, mouseX - imgSize / 2, mouseY - imgSize / 2, imgSize, imgSize);
      } else if (this.sport === "rugby") {
        image(ballRugbyHome, mouseX - imgSize / 2, mouseY - imgSize / 2, imgSize, imgSize);
      }
    } else {
      if (this.sport === "football") {
        image(ballFootballAway, mouseX - imgSize / 2, mouseY - imgSize / 2, imgSize, imgSize);
      } else if (this.sport === "AFL") {
        image(ballAFLAway, mouseX - imgSize / 2, mouseY - imgSize / 2, imgSize, imgSize);
      } else if (this.sport === "rugby") {
        image(ballRugbyAway, mouseX - imgSize / 2, mouseY - imgSize / 2, imgSize, imgSize);
      }
    }

    if (this.state === State.PAUSED) {
      imageMode(CORNER);
      image(this.pausedImg, 0, 0, fixedWidth, fixedHeight);
    }

    // Display introductory instructions when tracking hasn't started (timestamp == 0)
    if (this.state === State.PAUSED && this.timestamp === 0) {
      push();
      textAlign(CENTER, CENTER);
      if (this.sport === "football") {
        textSize(32);
        textStyle(BOLD);
        fill(255);
        text("Controls/Actions: Pause/Play, Possession detection, Pass, Goal!", width / 2, height / 2 - 40);
      } else if (this.sport === "AFL" || this.sport === "rugby") {
        textSize(32);
        textStyle(BOLD);
        fill(255);
        text("PRESS 'SPACE' TO START BALL TRACKING.", width / 2, height / 2 - 40);
        textSize(20);
        text("The ball on the device will mirror the movement of your mouse.", width / 2, height / 2);
      }
      pop();
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

    // Space toggles pause/play
    if (k === ' ') {
      this.state = this.state === State.PAUSED ? State.ONGOING : State.PAUSED;
      if (this.state === State.PAUSED) this.checkpoint = this.timestamp;
      return;
    }

    if (this.state !== State.ONGOING) return;

    // Sport–specific key mappings and on–screen messages:
    switch(this.sport) {
      case "football":
        if (k === '1') {
          this.tryScore = 1;
          this.addActionMessage("Goal!", 4000);
        } else if (k === 'A') {
          this.passKick = 1;
          this.addActionMessage("Pass", 500);
        }
        break;
      case "AFL":
        if (k === '1') {
          this.tryScore = 1;
          this.addActionMessage("Goal", 4000);
        } else if (k === '2') {
          this.conversion = 1;
          this.addActionMessage("Behind", 2000);
        } else if (k === 'A') {
          this.passKick = 1;
          this.addActionMessage("Pass", 500);
        } else if (k === 'D') {
          this.ruck = 1;
          this.addActionMessage("Mark", 500);
        }
        break;
      case "rugby":
        if (k === '1') {
          this.tryScore = 1;
          this.addActionMessage("Try", 4000);
        } else if (k === '2') {
          this.conversion = 1;
          this.addActionMessage("Conversion", 2000);
        } else if (k === 'A') {
          this.passKick = 1;
          this.addActionMessage("Pass", 500);
        } else if (k === 'D') {
          this.ruck = 1;
          this.addActionMessage("Ruck", 500);
        } else if (k === 'F') {
          this.scrumMaul = this.scrumMaul === 0 ? 1 : 0;
          if (this.scrumMaul === 1) {
            this.addActionMessage("Scrum", 1000);
          }
        }
        break;
    }
  }

  handleMousePressed(event) {
    // Left-click toggles possession.
    if (event.button === 0) {
      this.possession = this.possession === POSSESSION_HOME ? POSSESSION_AWAY : POSSESSION_HOME;
    }
    // Middle-click (wheel-click) triggers a Pass action.
    if (event.button === 4) {
      this.passKick = 1;
      this.addActionMessage("Pass", 500);
    }
    // Right-click triggers the scoring action—label depends on the sport.
    if (event.button === 2 || event.button === 3) {
      switch(this.sport) {
        case "football":
          this.tryScore = 1;
          this.addActionMessage("Goal!", 4000);
          break;
        case "AFL":
          this.tryScore = 1;
          this.addActionMessage("Goal", 4000);
          break;
        case "rugby":
          this.tryScore = 1;
          this.addActionMessage("Try", 4000);
          break;
      }
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
    
    // Map each stadium to its appropriate URL and pitch image:
    // - Demonstration and Dalymount Park: Football
    // - Marvel Stadium: AFL
    // - Aviva Stadium and Aviva - Dublin: Rugby
    switch (selectedStadium) {
      case 0: // Demonstration (Football)
        url = DALYMOUNT_PARK;
        imgIndex = 0;
        break;
      case 1: // Marvel Stadium (AFL)
        url = MARVEL_STADIUM;
        imgIndex = 1;
        break;
      case 2: // Dalymount Park (Football)
        url = DALYMOUNT_PARK;
        imgIndex = 0;
        break;
      case 3: // Aviva Stadium (Rugby)
        url = DUBLIN;
        imgIndex = 3;
        break;
      case 4: // Aviva - Dublin (Rugby)
        url = DUBLIN;
        imgIndex = 3;
        break;
    }
    
    if (game) {
      game.setStadium(url, stadiumName, imgIndex);
      console.log(`Selected stadium: ${stadiumName}, Image index: ${imgIndex}`);
    }
    if (playbackPage) playbackPage.setStadium(url, stadiumName, imgIndex);
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
    if (selectedImageIndex === 0 || selectedImageIndex === 2) {
      this.sport = "football";
      this.pausedImg = paused;
    } else if (selectedImageIndex === 1) {
      this.sport = "AFL";
      this.pausedImg = aflPaused;
    } else if (selectedImageIndex === 3) {
      this.sport = "rugby";
      this.pausedImg = rugbyPaused;
    }
  
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
  if (event.button === 4 || event.button === 2 || event.button === 3) {
    event.preventDefault();
  }
}
