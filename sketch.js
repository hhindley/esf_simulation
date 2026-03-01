// ====== Global Variables ======
let state = "chooseCharacter";
let scenario = null;
let timer = 0;
let resetShown = false;
let bacteria = [];
let antibioticDrops = [];
let choseAntibiotic = null;
let selectedSpritePath = null;
let selectedSpriteImage = null;
let previewMicrobes = [];
let antibioticDropAnim = 0;
let antibioticDoseCount = 0;
let nextActionTime = 600;
const BACTERIA_ARRIVAL_FRAMES = 90;
const BACTERIA_EFFECT_FRAMES = 300;
let resistantRebound = false;
let reboundStartTime = 0;
let stoppedTreatmentEarly = false;
let earlyStopStartTime = 0;

// ====== Setup ======
function setup() {
  const cnv = createCanvas(getCanvasWidth(), getCanvasHeight());
  cnv.parent("canvas-wrap");
  textAlign(CENTER, CENTER);
  applyLaptopPreset();
  setupUI();
}

// ====== Draw Loop ======
function draw() {
  clear();

  if (state === "chooseCharacter") drawIntro();
  else if (state === "showInitialInfection") showInitialInfection();
  else if (state === "showInfectionSpread") showInfectionSpread();
  else if (state === "runScenario") runScenario();
  else if (state === "runNoTreatment") runNoTreatment();
}

function getCanvasWidth() {
  return Math.max(640, Math.floor(windowWidth * 0.96));
}

function getCanvasHeight() {
  if (windowWidth <= 1440) {
    return Math.max(450, Math.floor(windowHeight * 0.57)); // ~13" laptops
  }

  if (windowWidth <= 1728) {
    return Math.max(490, Math.floor(windowHeight * 0.62)); // ~15" laptops
  }

  return Math.max(520, Math.floor(windowHeight * 0.66));
}

function windowResized() {
  resizeCanvas(getCanvasWidth(), getCanvasHeight());
  applyLaptopPreset();
}

function getLaptopPreset() {
  if (windowWidth <= 1440) return "laptop-13";
  if (windowWidth <= 1728) return "laptop-15";
  return "desktop";
}

function applyLaptopPreset() {
  if (!document || !document.body) return;
  document.body.setAttribute("data-screen", getLaptopPreset());
}

// ====== Random Point Inside Circle ======
function randomPointInCircle(cx, cy, radius) {
  let angle = random(TWO_PI);
  let r = radius * sqrt(random());
  return { x: cx + r * cos(angle), y: cy + r * sin(angle) };
}

function easeOutCubic(t) {
  return 1 - pow(1 - t, 3);
}

function drawAntibioticIcon(x, y, scale = 1) {
  push();
  translate(x, y);
  rotate(-0.35);
  noStroke();

  // Capsule body
  fill(255, 255, 255, 230);
  rectMode(CENTER);
  rect(0, 0, 24 * scale, 10 * scale, 6 * scale);

  // Left half
  fill(255, 120, 120, 230);
  rect(-6 * scale, 0, 12 * scale, 10 * scale, 6 * scale);

  // Small cross mark
  stroke(60, 120, 190, 220);
  strokeWeight(1.6 * scale);
  line(3 * scale, -2 * scale, 3 * scale, 2 * scale);
  line(1 * scale, 0, 5 * scale, 0);

  pop();
}

function generatePreviewMicrobes(count) {
  // If count not specified, vary bacteria count randomly (18-26)
  if (!count) {
    count = floor(random(18, 27));
  }
  previewMicrobes = [];

  for (let i = 0; i < count; i++) {
    const p = randomPointInCircle(0, 0, 1);
    previewMicrobes.push({
      ux: p.x,
      uy: p.y,
      rot: random(TWO_PI),
      sizeScale: random(0.88, 1.15)
    });
  }
}

function getConfirmDishLayout() {
  const cx = width / 2;
  let dishScale = 0.89;
  let cyRatio = 0.515;

  if (windowWidth <= 1440) {
    dishScale = 0.85;
    cyRatio = 0.475;
  } else if (windowWidth <= 1728) {
    dishScale = 0.87;
    cyRatio = 0.505;
  }

  const dishSize = Math.min(width, height) * dishScale;
  const cy = height * cyRatio;
  const microbeRadius = dishSize * 0.36;

  return { cx, cy, dishSize, microbeRadius };
}

function getSelectedCharacterLabel() {
  const labels = {
    "bac/bac1.png": "bacteria",
    "bac/bac2.png": "bacteria",
    "bac/bac3.png": "bacteria",
    "bac/sbac1.png": "superbug",
    "bac/sbac2.png": "superbug",
    "bac/sbac3.png": "superbug",
    "bac/v1.png": "virus",
    "bac/v2.png": "virus"
  };

  return labels[selectedSpritePath] || "infection";
}

function createAntibioticDrop(startFrame = 0) {
  // Keep antibiotic effects inside the dish boundary
  const dishRadius = 200;
  const maxAntibioticZoneRadius = 88;
  const safeDropRadius = dishRadius - maxAntibioticZoneRadius - 12;
  const cx = width / 2;
  const cy = height / 2;
  const minSeparation = 95;

  // First dose can be anywhere in the safe area.
  if (antibioticDrops.length === 0) {
    const p = randomPointInCircle(cx, cy, safeDropRadius);
    return { x: p.x, y: p.y, startFrame };
  }

  // Try to place new dose far from existing doses.
  let bestPoint = null;
  let bestNearestDist = -1;

  for (let i = 0; i < 60; i++) {
    const p = randomPointInCircle(cx, cy, safeDropRadius);
    let nearestDist = Infinity;

    for (let d of antibioticDrops) {
      nearestDist = min(nearestDist, dist(p.x, p.y, d.x, d.y));
    }

    if (nearestDist >= minSeparation) {
      return { x: p.x, y: p.y, startFrame };
    }

    if (nearestDist > bestNearestDist) {
      bestNearestDist = nearestDist;
      bestPoint = p;
    }
  }

  // Fallback: best available point even if ideal gap wasn't found.
  const fallback = bestPoint || randomPointInCircle(cx, cy, safeDropRadius);
  return { x: fallback.x, y: fallback.y, startFrame };
}

function maybeTriggerRandomResistance(triggerTime, chance = 0.18) {
  if (resistantRebound) return false;
  if (random() >= chance) return false;

  resistantRebound = true;
  reboundStartTime = triggerTime;
  resetShown = false;
  nextActionTime = triggerTime + 360;
  return true;
}

function getEndActionsHTML() {
  if (scenario === "bacteria" && resistantRebound) {
    return `
      <div class="end-actions">
        <button class="reset-btn" onclick="backToChooseCharacter()">Back to start</button>
      </div>
    `;
  }

  if (scenario === "bacteria" && stoppedTreatmentEarly) {
    return `
      <div class="end-actions">
        <button class="decision-btn more" onclick="addMoreAntibiotic()">Add more antibiotic</button>
        <button class="reset-btn" onclick="backToChooseCharacter()">Start again</button>
      </div>
    `;
  }

  const showDoseChoices =
    scenario === "bacteria" &&
    antibioticDoseCount <= 2 &&
    !resistantRebound &&
    !stoppedTreatmentEarly;

  return `
    <div class="end-actions">
      ${showDoseChoices ? '<button class="decision-btn more" onclick="addMoreAntibiotic()">More antibiotic</button>' : ""}
      ${showDoseChoices ? '<button class="decision-btn no" onclick="completeTreatment()">Treatment complete</button>' : '<button class="reset-btn" onclick="reset()">Try another infection</button>'}
      ${showDoseChoices ? '' : '<button class="decision-btn alt" onclick="backToTreatmentChoice()">Different treatment option</button>'}
    </div>
  `;
}

// ====== UI Setup ======
function setupUI() {
  const ui = document.getElementById("ui");
  const bottomUI = document.getElementById("bottom-ui");
  const title = document.getElementById("screen-title");
  ui.innerHTML = "";
  if (bottomUI) bottomUI.innerHTML = "";

  if (title) {
    if (state === "chooseCharacter") {
      title.textContent = "Choose your character";
      title.classList.remove("hidden");
    } else {
      title.classList.add("hidden");
    }
  }

  if (state === "chooseCharacter") {
  ui.innerHTML = `
    <section class="char-section">
      <h2 class="section-heading">Bacteria</h2>
      <div class="char-grid">
        <button onclick="choose('bacteria', 'bac/bac1.png')" class="char-btn">
          <img src="bac/bac1.png" alt="Bacteria 1">
        </button>
        <button onclick="choose('bacteria', 'bac/bac2.png')" class="char-btn">
          <img src="bac/bac2.png" alt="Bacteria 2">
        </button>
        <button onclick="choose('bacteria', 'bac/bac3.png')" class="char-btn">
          <img src="bac/bac3.png" alt="Bacteria 3">
        </button>
      </div>
    </section>

    <section class="char-section">
      <h2 class="section-heading">Superbugs</h2>
      <div class="char-grid">
        <button onclick="choose('superbug', 'bac/sbac1.png')" class="char-btn">
          <img src="bac/sbac1.png" alt="Superbug 1">
        </button>
        <button onclick="choose('superbug', 'bac/sbac2.png')" class="char-btn">
          <img src="bac/sbac2.png" alt="Superbug 2">
        </button>
        <button onclick="choose('superbug', 'bac/sbac3.png')" class="char-btn">
          <img src="bac/sbac3.png" alt="Superbug 3">
        </button>
      </div>
    </section>

    <section class="char-section">
      <h2 class="section-heading">Virus</h2>
      <div class="char-grid">
        <button onclick="choose('virus', 'bac/v1.png')" class="char-btn">
          <img src="bac/v1.png" alt="Virus 1">
        </button>
        <button onclick="choose('virus', 'bac/v2.png')" class="char-btn">
          <img src="bac/v2.png" alt="Virus 2">
        </button>
      </div>
    </section>

  `;
}

  
  if (state === "confirmAntibiotic") {
    ui.innerHTML = `
      <p class="prompt-title"><strong>Oh no!</strong> It looks like there's an infection.</p>
      <p class="prompt-subtitle">Let's test this in a petri dish. Would you like to treat with antibiotics?</p>
      <div class="decision-row">
        <button class="decision-btn yes" onclick="giveAntibiotic()">Yes, treat it</button>
        <button class="decision-btn no" onclick="skipAntibiotic()">No, leave it</button>
      </div>
    `;

    if (bottomUI) {
      bottomUI.innerHTML = `
        <div class="back-row">
          <button class="decision-btn back" onclick="backToChooseCharacter()">← Back to characters</button>
        </div>
      `;
    }
  }

  if (state === "runScenario" && resetShown) {
    if (bottomUI) {
      bottomUI.innerHTML = getEndActionsHTML();
    }
  }

  if (state === "runScenario" && !resetShown) {
    const characterLabel = getSelectedCharacterLabel();
    let runTitle;
    
    if (resistantRebound) {
      runTitle = "Uh oh, the bacteria has developed resistance to this antibiotic.";
    } else {
      runTitle =
        scenario === "bacteria"
          ? `Let's see what happens when we treat these ${characterLabel} with an antibiotic.`
          : `Let's see what happens when we treat ${characterLabel} with an antibiotic.`;
    }

    ui.innerHTML = `<p class="run-title">🧪 ${runTitle}</p>`;
  }

  if (state === "runNoTreatment" && resetShown) {
    if (bottomUI) {
      bottomUI.innerHTML = getEndActionsHTML();
    }
  }
  
}

// ====== Button Handlers ======
window.choose = function(choice, spritePath) {
  scenario = choice;
  generatePreviewMicrobes();
  selectedSpritePath = spritePath || null;
  selectedSpriteImage = null;

  if (selectedSpritePath) {
    loadImage(
      selectedSpritePath,
      (img) => {
        selectedSpriteImage = img;
      },
      () => {
        selectedSpriteImage = null;
      }
    );
  }

  state = "showInitialInfection";
  timer = 0;
  bacteria = [];
  // Initialize with just the preview microbes (full count will be added during spread screen)
  if (previewMicrobes.length > 0) {
    const layout = getConfirmDishLayout();
    for (let i = 0; i < previewMicrobes.length; i++) {
      const m = previewMicrobes[i];
      bacteria.push({
        x: layout.cx + m.ux * layout.microbeRadius,
        y: layout.cy + m.uy * layout.microbeRadius,
        alpha: 255,
        rot: m.rot,
        sizeScale: m.sizeScale
      });
    }
  }
  setupUI();
};

window.giveAntibiotic = function() {
  choseAntibiotic = true;
  state = "runScenario";
  timer = 0;
  resetShown = false;
  antibioticDropAnim = 0;
  antibioticDoseCount = 1;
  nextActionTime = BACTERIA_ARRIVAL_FRAMES + BACTERIA_EFFECT_FRAMES + 90;
  resistantRebound = false;
  reboundStartTime = 0;
  stoppedTreatmentEarly = false;
  earlyStopStartTime = 0;
  setupUI();

  // Keep the exact dish state from the previous slide when available.
  // Fallback to initialization only if no bacteria are currently present.
  if (bacteria.length === 0) {
    initInfection();
  }

  // First antibiotic dose
  antibioticDrops = [createAntibioticDrop(0)];

  // Occasionally resistance appears early, by chance (kept lower to make success more achievable).
  const jumpedToResistance = maybeTriggerRandomResistance(timer, 0.06);
  if (jumpedToResistance) {
    nextActionTime = timer + 360;
  }
};

window.addMoreAntibiotic = function() {
  if (state !== "runScenario" || scenario !== "bacteria") return;

  // After the "infection remains" branch, adding more antibiotic
  // should jump directly into resistance.
  if (stoppedTreatmentEarly) {
    antibioticDoseCount += 1;
    resistantRebound = true;
    stoppedTreatmentEarly = false;
    reboundStartTime = timer;
    resetShown = false;
    nextActionTime = timer + 360;

    const bottomUI = document.getElementById("bottom-ui");
    if (bottomUI) bottomUI.innerHTML = "";
    setupUI();
    return;
  }

  if (antibioticDoseCount < 2) {
    antibioticDoseCount += 1;
    antibioticDrops.push(createAntibioticDrop(timer));
    resetShown = false;
    stoppedTreatmentEarly = false;

    const jumpedToResistance = maybeTriggerRandomResistance(timer, 0.12);
    if (!jumpedToResistance) {
      nextActionTime = timer + BACTERIA_ARRIVAL_FRAMES + BACTERIA_EFFECT_FRAMES + 40;
    }
  } else {
    // Overuse pathway: resistance/rebound after repeated dosing
    antibioticDoseCount += 1;
    resistantRebound = true;
    reboundStartTime = timer;
    resetShown = false;
    nextActionTime = timer + 360;
  }

  const bottomUI = document.getElementById("bottom-ui");
  if (bottomUI) bottomUI.innerHTML = "";

  setupUI();
};

window.completeTreatment = function() {
  if (state !== "runScenario" || scenario !== "bacteria") return;

  stoppedTreatmentEarly = true;
  earlyStopStartTime = timer;
  resetShown = false;
  nextActionTime = timer + 320;

  const bottomUI = document.getElementById("bottom-ui");
  if (bottomUI) bottomUI.innerHTML = "";
};

window.skipAntibiotic = function() {
  choseAntibiotic = false;
  state = "runNoTreatment";
  timer = 0;
  resetShown = false;
  antibioticDoseCount = 0;
  nextActionTime = 600;
  resistantRebound = false;
  reboundStartTime = 0;
  stoppedTreatmentEarly = false;
  earlyStopStartTime = 0;
  setupUI();

  initInfection();
  antibioticDrops = [];
};

window.backToChooseCharacter = function() {
  state = "chooseCharacter";
  scenario = null;
  timer = 0;
  resetShown = false;
  bacteria = [];
  antibioticDrops = [];
  antibioticDoseCount = 0;
  nextActionTime = 600;
  resistantRebound = false;
  reboundStartTime = 0;
  stoppedTreatmentEarly = false;
  earlyStopStartTime = 0;
  choseAntibiotic = null;
  selectedSpritePath = null;
  selectedSpriteImage = null;
  previewMicrobes = [];
  setupUI();
};

window.backToTreatmentChoice = function() {
  state = "confirmAntibiotic";
  timer = 0;
  resetShown = false;
  bacteria = [];
  antibioticDrops = [];
  antibioticDropAnim = 0;
  antibioticDoseCount = 0;
  nextActionTime = 600;
  resistantRebound = false;
  reboundStartTime = 0;
  stoppedTreatmentEarly = false;
  earlyStopStartTime = 0;
  choseAntibiotic = null;
  setupUI();
};

function initInfection() {

  // Initialize bacteria positions
  bacteria = [];

  if (scenario === "bacteria" && previewMicrobes.length > 0) {
    const layout = getConfirmDishLayout();

    for (let i = 0; i < previewMicrobes.length; i++) {
      const m = previewMicrobes[i];
      bacteria.push({
        x: layout.cx + m.ux * layout.microbeRadius,
        y: layout.cy + m.uy * layout.microbeRadius,
        alpha: 255,
        rot: m.rot,
        sizeScale: m.sizeScale
      });
    }



    return;
  }

  for (let i = 0; i < 80; i++) {
    const p = randomPointInCircle(width / 2, height / 2, 170);
    bacteria.push({
      x: p.x,
      y: p.y,
      alpha: 255
    });
  }
}

window.reset = function() {
  state = "chooseCharacter";
  scenario = null;
  timer = 0;
  resetShown = false;
  bacteria = [];
  antibioticDrops = [];
  antibioticDoseCount = 0;
  nextActionTime = 600;
  resistantRebound = false;
  reboundStartTime = 0;
  stoppedTreatmentEarly = false;
  earlyStopStartTime = 0;
  choseAntibiotic = null;
  selectedSpritePath = null;
  selectedSpriteImage = null;
  previewMicrobes = [];
  setupUI();
};

// ====== Petri Dish ======
function drawPetriDish() {
  const layout = getConfirmDishLayout();
  const outer = layout.dishSize;
  const inner = layout.dishSize - 24;

  stroke(168, 182, 200);
  strokeWeight(4);
  fill(244, 248, 255);
  ellipse(layout.cx, layout.cy, outer, outer);

  noStroke();
  fill(255, 254, 240);
  ellipse(layout.cx, layout.cy, inner, inner);
}

// ====== Run Scenario ======
function runScenario() {
  timer++;
  drawPetriDish();

  if (scenario === "bacteria") runBacteriaScenario();
  if (scenario === "superbug") runSuperbugScenario();
  if (scenario === "virus") runVirusScenario();

  if (timer > nextActionTime && !resetShown) {
    resetShown = true;
  }
}

// ====== Run Scenario (No Treatment) ======
function runNoTreatment() {
  timer++;
  drawPetriDish();

  // Infection spreads when no antibiotic is used
  if (frameCount % 20 === 0 && bacteria.length < 200) {
    bacteria.push({
      x: random(width/2 - 180, width/2 + 180),
      y: random(height/2 - 180, height/2 + 180),
      alpha: 255
    });
  }

  if (scenario === "bacteria") {
    for (let b of bacteria) {
      fill(0, 180, 0, b.alpha);
      noStroke();
      ellipse(b.x, b.y, 8);
    }
  }

  if (scenario === "superbug") {
    for (let b of bacteria) {
      fill(150, 0, 150, b.alpha);
      noStroke();
      ellipse(b.x, b.y, 8);
    }
  }

  if (scenario === "virus") {
    for (let b of bacteria) {
      fill(255, 100, 0, b.alpha);
      noStroke();
      push();
      translate(b.x, b.y);
      rotate(frameCount * 0.01);
      triangle(-6, -6, 6, -6, 0, 6);
      pop();
    }
  }

  drawPatientArrow(false, 0);

  if (timer > nextActionTime && !resetShown) {
    resetShown = true;
  }
}

// ====== Bacteria Scenario ======
function runBacteriaScenario() {
  if (antibioticDrops.length === 0) return;

  // Update title if resistant rebound has been triggered
  const ui = document.getElementById("ui");
  if (ui && resistantRebound) {
    const runTitle = "Uh oh, the bacteria has developed resistance to this antibiotic.";
    ui.innerHTML = `<p class="run-title">❌ ${runTitle}</p>`;
  }

  const arrivalFrames = BACTERIA_ARRIVAL_FRAMES;
  const effectFrames = BACTERIA_EFFECT_FRAMES;

  const dishCx = width / 2;
  const dishCy = height / 2;

  const doseEffects = [];

  for (let i = 0; i < antibioticDrops.length; i++) {
    const drop = antibioticDrops[i];
    const localTime = max(0, timer - (drop.startFrame || 0));
    const localAnim = min(1, localTime / arrivalFrames);
    const dropAnimEase = easeOutCubic(localAnim);

    if (i === 0) antibioticDropAnim = localAnim;

    const startAngle = atan2(drop.y - dishCy, drop.x - dishCx);
    const startRadius = 176;
    const startX = dishCx + cos(startAngle) * startRadius;
    const startY = dishCy + sin(startAngle) * startRadius;

    const incomingX = lerp(startX, drop.x, dropAnimEase);
    const incomingY = lerp(startY, drop.y, dropAnimEase);

    // Antibiotic drop flying into the dish
    fill(20, 150, 255, 180);
    noStroke();
    ellipse(incomingX, incomingY, 24, 24);
    fill(120, 210, 255, 180);
    ellipse(incomingX - 4, incomingY - 4, 8, 8);
    drawAntibioticIcon(incomingX, incomingY, 0.62);

    let effectProgress = 0;
    if (localAnim >= 1) {
      effectProgress = min(1, (localTime - arrivalFrames) / effectFrames);
    }

    const killRadius = 20 + 78 * effectProgress;
    const fadeRadius = killRadius + 30;

    // Visible antibiotic zone once drop lands
    if (localAnim >= 1) {
      fill(0, 150, 255, 70 + 70 * effectProgress);
      noStroke();
      ellipse(drop.x, drop.y, killRadius * 1.7);
      drawAntibioticIcon(drop.x, drop.y, 0.68);
    }

    doseEffects.push({
      x: drop.x,
      y: drop.y,
      localAnim,
      effectProgress,
      killRadius,
      fadeRadius
    });
  }

  let aliveCount = 0;
  const totalCount = bacteria.length;

  if (resistantRebound) {
    // After repeated dosing, resistant bacteria regrow and patient worsens.
    if (frameCount % 7 === 0 && bacteria.length < 140) {
      const p = randomPointInCircle(width / 2, height / 2, 170);
      bacteria.push({
        x: p.x,
        y: p.y,
        alpha: 255,
        rot: random(TWO_PI),
        sizeScale: random(0.88, 1.15)
      });
    }

    for (let b of bacteria) {
      b.alpha = min(255, b.alpha + 1.6);

      if (selectedSpriteImage) {
        imageMode(CENTER);
        push();
        tint(255, 70, 70, b.alpha);
        translate(b.x, b.y);
        rotate(b.rot || 0);
        const size = 18 * (b.sizeScale || 1);
        image(selectedSpriteImage, 0, 0, size, size);
        pop();
      } else {
        fill(220, 70, 70, b.alpha);
        noStroke();
        ellipse(b.x, b.y, 8);
      }

      if (b.alpha > 0) aliveCount++;
    }

    const reboundProgress = constrain((timer - reboundStartTime) / 180, 0, 1);
    const healthProgress = constrain(0.45 - reboundProgress * 0.35, 0.05, 0.45);
    drawPatientArrow(false, healthProgress);
    return;
  }

  if (stoppedTreatmentEarly) {
    if (ui) {
      ui.innerHTML = `<p class="run-title">⚠️ Enough healthy bacteria remain to keep dividing, the infection remains.</p>`;
    }

    if (frameCount % 14 === 0 && bacteria.length < 140) {
      const p = randomPointInCircle(width / 2, height / 2, 170);
      bacteria.push({
        x: p.x,
        y: p.y,
        alpha: 150,
        rot: random(TWO_PI),
        sizeScale: random(0.88, 1.15)
      });
    }

    for (let b of bacteria) {
      b.alpha = min(255, b.alpha + 0.9);
      aliveCount++;

      if (selectedSpriteImage) {
        imageMode(CENTER);
        push();
        tint(255, b.alpha);
        translate(b.x, b.y);
        rotate(b.rot || 0);
        const size = 18 * (b.sizeScale || 1);
        image(selectedSpriteImage, 0, 0, size, size);
        pop();
      } else {
        fill(0, 180, 0, b.alpha);
        noStroke();
        ellipse(b.x, b.y, 8);
      }
    }

    const earlyProgress = constrain((timer - earlyStopStartTime) / 320, 0, 1);
    const healthProgress = constrain(0.62 - earlyProgress * 0.44, 0.14, 0.62);
    drawPatientArrow(false, healthProgress);

    if (timer > nextActionTime && !resetShown) {
      resetShown = true;
    }
    return;
  }

  for (let b of bacteria) {
    let alphaDecay = 0;

    for (let effect of doseEffects) {
      if (effect.localAnim < 1) continue;

      const d = dist(b.x, b.y, effect.x, effect.y);
      if (d < effect.killRadius) alphaDecay += 24;
      else if (d < effect.fadeRadius) alphaDecay += 3;
    }

    if (alphaDecay > 0) b.alpha -= min(32, alphaDecay);

    b.alpha = max(0, b.alpha);

    if (b.alpha > 0) {
      aliveCount++;

      if (selectedSpriteImage) {
        imageMode(CENTER);
        push();
        tint(255, b.alpha);
        translate(b.x, b.y);
        rotate(b.rot || 0);
        const size = 18 * (b.sizeScale || 1);
        image(selectedSpriteImage, 0, 0, size, size);
        pop();
      } else {
        fill(0, 180, 0, b.alpha);
        noStroke();
        ellipse(b.x, b.y, 8);
      }
    }
  }

  // Determine if infection is cured (less than 30% of bacteria remain)
  const bacteriaPercentageRemaining = totalCount > 0 ? aliveCount / totalCount : 0;
  let cured = bacteriaPercentageRemaining < 0.3;
  const killedFraction = totalCount > 0 ? 1 - aliveCount / totalCount : 0;
  const dose1Progress = doseEffects[0] ? doseEffects[0].effectProgress : 0;
  const dose2Progress = doseEffects[1] ? doseEffects[1].effectProgress : 0;

  let healthProgress =
    killedFraction * 0.58 +
    dose1Progress * 0.2 +
    dose2Progress * 0.26 +
    (antibioticDoseCount > 1 ? 0.08 : 0);

  // Keep some room for visible improvement after dose 1,
  // then allow dose 2 to push toward full recovery.
  if (antibioticDoseCount <= 1) {
    healthProgress = min(0.78, healthProgress);
  }

  healthProgress = constrain(healthProgress, 0, 1);
  drawPatientArrow(cured, healthProgress);

  if (ui && resetShown && !cured) {
    ui.innerHTML = `<p class="run-title">✅ Great! We've had some successful treatment, would you like to apply more antibiotic?</p>`;
  }

  // Show success message when treatment is successful
  if (cured && !resetShown) {
    resetShown = true;
  }
  
  if (cured && resetShown) {
    if (ui) {
      ui.innerHTML = `<p class="run-title">🎉 Yay! The bacteria have successfully completed the treatment.</p>`;
    }

    const bottomUI = document.getElementById("bottom-ui");
    if (bottomUI && !bottomUI.innerHTML.includes("Start again")) {
      bottomUI.innerHTML = `
        <div class="end-actions" style="display: flex; gap: 12px; justify-content: center;">
          <button class="reset-btn" onclick="backToChooseCharacter()">Start again</button>
        </div>
      `;
    }
  }
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

  drawPatientArrow(false, 0.06); // superbug not cured
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

  drawPatientArrow(false, 0); // virus not cured
}

// ====== Draw Patient Arrow ======
function drawPatientArrow(cured, healthProgress = 0) {
  const p = constrain(healthProgress, 0, 1);
  const status = cured ? "Healthy" : p > 0.2 ? "Recovering" : "Unwell";
  const percent = Math.round(p * 100);
  const bottomUI = document.getElementById("bottom-ui");
  if (!bottomUI) return;

  // Avoid replacing button DOM every frame once final actions are shown,
  // otherwise click interactions can be interrupted.
  if (resetShown && bottomUI.querySelector(".end-actions")) {
    return;
  }

  const panelHTML = `
    <div class="human-response-panel">
      <div class="human-response-title">Human response</div>
      <div class="human-response-row">
        <span class="human-label left">🤒 Sick</span>
        <div class="human-progress-wrap">
          <div class="human-progress-track"></div>
          <div class="human-progress-fill" style="width: ${percent}%"></div>
          <div class="human-progress-dot" style="left: calc(${percent}% - 8px)"></div>
        </div>
        <span class="human-label right">${status} ${cured ? "😄" : p > 0.2 ? "🙂" : "😷"}</span>
      </div>
    </div>
  `;

  if (resetShown) {
    bottomUI.innerHTML = panelHTML + getEndActionsHTML();
  } else {
    bottomUI.innerHTML = panelHTML;
  }
}

// ====== Intro / Confirm Screens ======
function drawIntro() {
  // Intentionally blank: first screen uses only HTML UI
}

function showInitialInfection() {
  timer++;
  
  const layout = getConfirmDishLayout();
  const cx = layout.cx;
  const cy = layout.cy;
  const dishSize = layout.dishSize;
  const outer = dishSize;
  const inner = dishSize - 24;

  // Draw petri dish
  stroke(168, 182, 200);
  strokeWeight(4);
  fill(244, 248, 255);
  ellipse(cx, cy, outer, outer);
  noStroke();
  fill(255, 254, 240);
  ellipse(cx, cy, inner, inner);

  const characterLabel = getSelectedCharacterLabel();
  
  // Render bacteria
  for (let b of bacteria) {
    if (selectedSpriteImage) {
      imageMode(CENTER);
      push();
      tint(255, b.alpha);
      translate(b.x, b.y);
      rotate(b.rot || 0);
      const size = 18 * (b.sizeScale || 1);
      image(selectedSpriteImage, 0, 0, size, size);
      pop();
    } else if (scenario === "bacteria") {
      fill(0, 180, 0, b.alpha);
      noStroke();
      ellipse(b.x, b.y, 8);
    } else if (scenario === "superbug") {
      fill(150, 0, 150, b.alpha);
      noStroke();
      ellipse(b.x, b.y, 8);
    } else if (scenario === "virus") {
      fill(255, 100, 0, b.alpha);
      noStroke();
      push();
      translate(b.x, b.y);
      rotate(frameCount * 0.01);
      triangle(-6, -6, 6, -6, 0, 6);
      pop();
    }
  }

  // Show initial infection message
  const ui = document.getElementById("ui");
  if (ui && !ui.innerHTML.includes("Uh oh")) {
    ui.innerHTML = `
      <p class="prompt-title"><strong>Uh oh!</strong></p>
      <p class="prompt-subtitle">Looks like this ${characterLabel} has caused an infection.</p>
    `;
  }

  // After 120 frames (~2 seconds at 60fps), transition to spread screen
  if (timer > 120) {
    state = "showInfectionSpread";
    timer = 0;
  }
}

function showInfectionSpread() {
  timer++;
  
  const layout = getConfirmDishLayout();
  const cx = layout.cx;
  const cy = layout.cy;
  const dishSize = layout.dishSize;
  const outer = dishSize;
  const inner = dishSize - 24;

  // Draw petri dish
  stroke(168, 182, 200);
  strokeWeight(4);
  fill(244, 248, 255);
  ellipse(cx, cy, outer, outer);
  noStroke();
  fill(255, 254, 240);
  ellipse(cx, cy, inner, inner);

  // Add bacteria as animation progresses (0-400 frames up to 75 bacteria)
  const spreadProgress = constrain(timer / 400, 0, 1);
  const targetBacteria = floor(previewMicrobes.length + (75 - previewMicrobes.length) * spreadProgress);
  
  while (bacteria.length < targetBacteria) {
    const p = randomPointInCircle(layout.cx, layout.cy, layout.microbeRadius);
    bacteria.push({
      x: p.x,
      y: p.y,
      alpha: 255,
      rot: random(TWO_PI),
      sizeScale: random(0.88, 1.15)
    });
  }

  const characterLabel = getSelectedCharacterLabel();
  
  // Render bacteria
  for (let b of bacteria) {
    if (selectedSpriteImage) {
      imageMode(CENTER);
      push();
      tint(255, b.alpha);
      translate(b.x, b.y);
      rotate(b.rot || 0);
      const size = 18 * (b.sizeScale || 1);
      image(selectedSpriteImage, 0, 0, size, size);
      pop();
    } else if (scenario === "bacteria") {
      fill(0, 180, 0, b.alpha);
      noStroke();
      ellipse(b.x, b.y, 8);
    } else if (scenario === "superbug") {
      fill(150, 0, 150, b.alpha);
      noStroke();
      ellipse(b.x, b.y, 8);
    } else if (scenario === "virus") {
      fill(255, 100, 0, b.alpha);
      noStroke();
      push();
      translate(b.x, b.y);
      rotate(frameCount * 0.01);
      triangle(-6, -6, 6, -6, 0, 6);
      pop();
    }
  }

  // Show warning message with treatment options
  const ui = document.getElementById("ui");
  if (ui && !ui.innerHTML.includes("If left untreated")) {
    ui.innerHTML = `
      <p class="prompt-title"><strong>Uh oh!</strong></p>
      <p class="prompt-subtitle">Looks like this ${characterLabel} has caused an infection.</p>
      <p class="prompt-title" style="margin-top: 14px;"><strong>⚠️ Warning!</strong></p>
      <p class="prompt-subtitle">If left untreated, this infection could spread and become harmful.</p>
      <p class="prompt-subtitle" style="margin-top: 24px; font-weight: bold;">Would you like to treat the infection with antibiotics?</p>
    `;
    
    const bottomUI = document.getElementById("bottom-ui");
    if (bottomUI) {
      const characterLabel = getSelectedCharacterLabel();
      bottomUI.innerHTML = `
        <div class="prompt-buttons">
          <button class="decision-btn yes" onclick="giveAntibiotic()">Yes, use antibiotics</button>
          <button class="decision-btn no" onclick="skipAntibiotic()">No, don't treat</button>
        </div>
      `;
    }
  }
}

function drawConfirm() {
  drawConfirmPreviewDish();
}

function drawConfirmPreviewDish() {
  const layout = getConfirmDishLayout();
  const cx = layout.cx;
  const cy = layout.cy;
  const dishSize = layout.dishSize;
  const outer = dishSize;
  const inner = dishSize - 24;

  stroke(168, 182, 200);
  strokeWeight(4);
  fill(244, 248, 255);
  ellipse(cx, cy, outer, outer);

  noStroke();
  fill(255, 254, 240);
  ellipse(cx, cy, inner, inner);

  const r = layout.microbeRadius;

  if (previewMicrobes.length === 0) {
    generatePreviewMicrobes();
  }

  for (let i = 0; i < previewMicrobes.length; i++) {
    const m = previewMicrobes[i];
    const x = cx + m.ux * r;
    const y = cy + m.uy * r;

    if (selectedSpriteImage) {
      imageMode(CENTER);
      const baseSize = scenario === "virus" ? 20 : 18;
      const spriteSize = baseSize * m.sizeScale;
      push();
      translate(x, y);
      rotate(m.rot);
      image(selectedSpriteImage, 0, 0, spriteSize, spriteSize);
      pop();
    } else if (scenario === "superbug") {
      fill(150, 0, 150, 215);
      stroke(95, 0, 95, 180);
      strokeWeight(1.5);
      ellipse(x, y, 10, 10);
      noStroke();
      fill(188, 90, 188, 180);
      ellipse(x + 2, y - 2, 3, 3);
    } else if (scenario === "virus") {
      noStroke();
      fill(255, 120, 20, 220);
      push();
      translate(x, y);
      rotate(i * 0.6);
      triangle(-6, -5, 6, -5, 0, 6);
      pop();
    } else {
      fill(10, 170, 70, 220);
      noStroke();
      ellipse(x, y, 9, 9);
    }
  }
}
