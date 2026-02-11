// ====== Global Variables ======
let state = "chooseCharacter";
let scenario = null;
let timer = 0;
let resetShown = false;
let bacteria = [];
let antibioticDrops = [];

// ====== Setup ======
function setup() {
  createCanvas(500, 500);
  textAlign(CENTER, CENTER);
  setupUI();
}

// ====== Draw Loop ======
function draw() {
  background(255);

  if (state === "chooseCharacter") drawIntro();
  else if (state === "confirmAntibiotic") drawConfirm();
  else if (state === "runScenario") runScenario();
}

// ====== Random Point Inside Circle ======
function randomPointInCircle(cx, cy, radius) {
  let angle = random(TWO_PI);
  let r = radius * sqrt(random());
  return { x: cx + r * cos(angle), y: cy + r * sin(angle) };
}

// ====== UI Setup ======
function setupUI() {
  const ui = document.getElementById("ui");
  ui.innerHTML = "";

  if (state === "chooseCharacter") {
  ui.innerHTML = `
    <button onclick="choose('bacteria')" class="char-btn">
      <img src="bac/bac1.png" alt="Bacteria">
    </button>

    <button onclick="choose('superbug')" class="char-btn">
      <img src="bac/bac2.png" alt="Superbug">
    </button>

    <button onclick="choose('virus')" class="char-btn">
      <img src="bac/bac3.png" alt="Virus">
    </button>

    <button onclick="choose('bacteria')" class="char-btn">
      <img src="bac/sbac1.png" alt="Bacteria">
    </button>

    <button onclick="choose('superbug')" class="char-btn">
      <img src="bac/sbac2.png" alt="Superbug">
    </button>

    <button onclick="choose('virus')" class="char-btn">
      <img src="bac/sbac3.png" alt="Virus">
    </button>

    <button onclick="choose('bacteria')" class="char-btn">
      <img src="bac/v1.png" alt="Bacteria">
    </button>

    <button onclick="choose('superbug')" class="char-btn">
      <img src="bac/v2.png" alt="Superbug">
    </button>

  `;
}

  
  if (state === "confirmAntibiotic") {
    ui.innerHTML = `
      <p>The patient is unwell with an infection.</p>
      <button onclick="giveAntibiotic()">✔ Give antibiotic</button>
    `;
  }

  if (state === "runScenario" && resetShown) {
    ui.innerHTML = `<button onclick="reset()">Try another infection</button>`;
  }
  
}

// ====== Button Handlers ======
window.choose = function(choice) {
  scenario = choice;
  state = "confirmAntibiotic";
  setupUI();
};

window.giveAntibiotic = function() {
  state = "runScenario";
  timer = 0;
  resetShown = false;
  setupUI();

  // Initialize bacteria positions
  bacteria = [];
  for (let i = 0; i < 80; i++) {
    bacteria.push({
      x: random(width/2 - 150, width/2 + 150),
      y: random(height/2 - 150, height/2 + 150),
      alpha: 255
    });
  }

  // Single antibiotic drop inside dish
  const dishRadius = 200;
  const dropRadius = 50; 
  antibioticDrops = [randomPointInCircle(width/2, height/2, dishRadius - dropRadius)];
};

window.reset = function() {
  state = "chooseCharacter";
  scenario = null;
  timer = 0;
  resetShown = false;
  bacteria = [];
  antibioticDrops = [];
  setupUI();
};

// ====== Petri Dish ======
function drawPetriDish() {
  stroke(180);
  strokeWeight(4);
  fill(245, 245, 250);
  ellipse(width/2, height/2, 420, 420);

  noStroke();
  fill(255, 255, 240);
  ellipse(width/2, height/2, 400, 400);
}

// ====== Run Scenario ======
function runScenario() {
  timer++;
  drawPetriDish();

  if (scenario === "bacteria") runBacteriaScenario();
  if (scenario === "superbug") runSuperbugScenario();
  if (scenario === "virus") runVirusScenario();

  if (timer > 600 && !resetShown) {
    const ui = document.getElementById("ui");
    ui.innerHTML = `<button onclick="reset()">Try another infection</button>`;
    resetShown = true;
  }
}

// ====== Bacteria Scenario ======
function runBacteriaScenario() {
  const drop = antibioticDrops[0];
  fill(0, 150, 255, 120);
  noStroke();
  ellipse(drop.x, drop.y, 100); // radius = 50

  const killRadius = 50;
  const fadeRadius = 150;

  let aliveCount = 0;

  for (let b of bacteria) {
    let d = dist(b.x, b.y, drop.x, drop.y);

    if (d < killRadius) b.alpha = 0;
    else if (d < fadeRadius) b.alpha -= 4;

    if (b.alpha > 0) {
      aliveCount++;
      fill(0, 180, 0, b.alpha);
      noStroke();
      ellipse(b.x, b.y, 8);
    }
  }

  // Determine if infection is cured
  let cured = aliveCount === 0;
  drawPatientArrow(cured);
}

// ====== Superbug Scenario ======
function runSuperbugScenario() {
  for (let b of bacteria) {
    if (b.alpha > 0) {
      fill(150, 0, 150, b.alpha);
      noStroke();
      ellipse(b.x, b.y, 8);
    }
  }

  // Antibiotic zone (for visualization)
  for (let drop of antibioticDrops) {
    fill(0, 150, 255, 120);
    noStroke();
    ellipse(drop.x, drop.y, 100);
  }

  drawPatientArrow(false); // superbug not cured
}

// ====== Virus Scenario ======
function runVirusScenario() {
  for (let b of bacteria) {
    fill(255, 100, 0, b.alpha);
    noStroke();
    push();
    translate(b.x, b.y);
    rotate(frameCount * 0.01);
    triangle(-6, -6, 6, -6, 0, 6);
    pop();
  }

  // Antibiotic zone (no effect)
  for (let drop of antibioticDrops) {
    fill(0, 150, 255, 120);
    noStroke();
    ellipse(drop.x, drop.y, 100);
  }

  drawPatientArrow(false); // virus not cured
}

// ====== Draw Patient Arrow ======
function drawPatientArrow(cured) {
  textSize(40);
  noStroke();

  // Emojis
  text("😷", 80, 60);
  text("😄", 200, 60);

  // Arrow
  stroke(cured ? color(0, 180, 0) : 150);
  strokeWeight(3);
  fill(cured ? color(0, 180, 0) : 150);
  line(120, 60, 180, 60);
  triangle(180, 60, 170, 55, 170, 65);
}

// ====== Intro / Confirm Screens ======
function drawIntro() {
  textSize(20);
  fill(0);
  text("Choose an infection above", width/2, 250);
}

function drawConfirm() {
  textSize(20);
  fill(0);
  text("Giving antibiotic…", width/2, 250);
}
