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
  else if (state === "confirmAntibiotic") showInfectionSpread();
  else if (state === "runScenario") runScenario();
  else if (state === "runNoTreatment") runNoTreatment();
}

function getCanvasWidth() {
  return Math.max(640, Math.floor(windowWidth * 0.96));
}

function getCanvasHeight() {
  if (windowWidth <= 750) {
    return Math.max(370, Math.floor(windowHeight * 0.54)); // HP EliteBook 14
  }

  return Math.max(470, Math.floor(windowHeight * 0.50)); // MacBook Air 13.5
}

function windowResized() {
  resizeCanvas(getCanvasWidth(), getCanvasHeight());
  applyLaptopPreset();
}

function getLaptopPreset() {
  if (windowWidth <= 750) return "laptop-14"; // HP EliteBook
  return "laptop-13"; // MacBook Air
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
  let dishScale = 0.90;
  let cyRatio = 0.5;

  if (windowWidth <= 750) {
    // HP EliteBook 14
    dishScale = 0.84;
    cyRatio = 0.47;
  }

  const dishSize = Math.min(width, height) * dishScale;
  const cy = height * cyRatio;
  const microbeRadius = dishSize * 0.36;

  return { cx, cy, dishSize, microbeRadius };
}

function getSelectedCharacterLabel() {
  const labels = {
    "bac/ecoli.png": "bacteria",
    "bac/staph.png": "bacteria",
    "bac/sbac2.png": "superbug",
    "bac/mrsa.png": "superbug",
    "bac/covid.png": "virus"
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
  // Some doses spread a bit further, and the first dose has a better chance
  // of being effective so early treatment succeeds more often.
  const isFirstDose = startFrame === 0;
  const spreadChance = isFirstDose ? 0.5 : 0.34;
  const spreadBoost = random() < spreadChance
    ? random(isFirstDose ? 1.18 : 1.12, isFirstDose ? 1.34 : 1.28)
    : 1;

  // First dose can be anywhere in the safe area.
  if (antibioticDrops.length === 0) {
    const p = randomPointInCircle(cx, cy, safeDropRadius);
    return { x: p.x, y: p.y, startFrame, spreadBoost };
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
      return { x: p.x, y: p.y, startFrame, spreadBoost };
    }

    if (nearestDist > bestNearestDist) {
      bestNearestDist = nearestDist;
      bestPoint = p;
    }
  }

  // Fallback: best available point even if ideal gap wasn't found.
  const fallback = bestPoint || randomPointInCircle(cx, cy, safeDropRadius);
  return { x: fallback.x, y: fallback.y, startFrame, spreadBoost };
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
        <button class="reset-btn" onclick="backToChooseCharacter()">Start again</button>
      </div>
    `;
  }

  if (scenario === "bacteria" && stoppedTreatmentEarly) {
    return `
      <div class="end-actions">
        <button class="reset-btn" onclick="backToChooseCharacter()">Start again</button>
      </div>
    `;
  }

  const showDoseChoices =
    scenario === "bacteria" &&
    antibioticDoseCount <= 2 &&
    !resistantRebound &&
    !stoppedTreatmentEarly;

  if (!showDoseChoices) {
    return `
      <div class="end-actions">
        <button class="reset-btn" onclick="backToChooseCharacter()">Start again</button>
      </div>
    `;
  }

  return `
    <div class="end-actions">
      <button class="decision-btn more" onclick="addMoreAntibiotic()">More antibiotic</button>
      <button class="decision-btn no" onclick="completeTreatment()">Treatment complete</button>
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
      title.textContent = "Choose a microbe!";
      title.classList.remove("hidden");
    } else {
      title.classList.add("hidden");
    }
  }

  if (state === "chooseCharacter") {
  ui.innerHTML = `
    <section class="char-section">
      <div class="char-grid">
        <button onclick="choose('bacteria', 'bac/ecoli.png')" class="char-btn" title="E. coli bacteria">
          <img src="bac/ecoli.png" alt="E. coli Bacteria">
          <div class="char-label">Bacteria</div>
        </button>
        <button onclick="choose('bacteria', 'bac/staph.png')" class="char-btn" title="Staph bacteria">
          <img src="bac/staph.png" alt="Staph Bacteria">
          <div class="char-label">Bacteria</div>
        </button>
        <button onclick="choose('virus', 'bac/covid.png')" class="char-btn" title="Virus">
          <img src="bac/covid.png" alt="Virus">
          <div class="char-label">Virus</div>
        </button>
        <button onclick="choose('superbug', 'bac/mrsa.png')" class="char-btn" title="Superbug - resistant bacteria">
          <img src="bac/mrsa.png" alt="Superbug (MRSA)">
          <div class="char-label">Superbug</div>
        </button>
      </div>
    </section>
    <p class="char-intro">We will be seeing what happens when we treat different microbes with antibiotics, and how we can use computers to show us what might happen in real life scenarios.</p>
    <p class="ai-disclaimer">Images generated with AI</p>
  `;
}

  
  if (state === "confirmAntibiotic") {
    const characterLabel = getSelectedCharacterLabel();
    let treatmentText = "Would you like to treat it with antibiotics?";
    
    if (scenario === "virus") {
      treatmentText = "Would you like to try antibiotics? (Hint: antibiotics work on bacteria, not viruses.)";
    } else if (scenario === "superbug") {
      treatmentText = "This is a superbug that's resistant to some antibiotics. Would you like to try treating it anyway?";
    }
    
    ui.innerHTML = `
      <p class="prompt-title"><strong>Oh no!</strong> An infection has started!</p>
      <p class="prompt-subtitle">We can see the ${characterLabel} spreading in a petri dish.</p>
      <p class="prompt-subtitle" style="margin-top: 14px;">${treatmentText}</p>
      <div class="decision-row">
        <button class="decision-btn yes" onclick="giveAntibiotic()">Yes, treat it</button>
        <button class="decision-btn no" onclick="skipAntibiotic()">No, don't treat</button>
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

  if (state === "runScenario" && resetShown && scenario !== "bacteria") {
    if (bottomUI) {
      bottomUI.innerHTML = getEndActionsHTML();
    }
  }

  if (state === "runScenario" && resetShown && scenario === "bacteria") {
    if (bottomUI) {
      bottomUI.innerHTML = getEndActionsHTML();
    }
  }

  if (state === "runScenario" && !resetShown) {
    const characterLabel = getSelectedCharacterLabel();
    let runTitle;
    let additionalMessage = "";
    
    if (resistantRebound) {
      if (scenario === "virus") {
        runTitle = "❌ Antibiotics don't work on viruses!";
        additionalMessage = `<p class="run-subtitle">We need different drugs to treat viral infections. The virus remains active.</p>`;
      } else if (scenario === "superbug") {
        runTitle = "❌ This superbug is resistant to some antibiotics.";
        additionalMessage = `<p class="run-subtitle">These antibiotics may not work, so we need to choose treatment carefully.</p>`;
      } else {
        runTitle = "⚠️ Oh no! The bacteria developed resistance to the antibiotic.";
      }
    } else {
      runTitle =
        scenario === "bacteria"
          ? `Let's watch what happens when we treat these ${characterLabel} with antibiotics...`
          : `Let's watch what happens when we treat the ${characterLabel} with antibiotics...`;
    }

    ui.innerHTML = `<p class="run-title">${runTitle}</p>${additionalMessage}`;
  }

  if (state === "runNoTreatment" && !resetShown) {
    const characterLabel = getSelectedCharacterLabel();
    ui.innerHTML = `<p class="run-title">⚠️ Without treatment, the ${characterLabel} keeps spreading...`;
  }

  if (state === "runNoTreatment" && resetShown) {
    let messageText = "";
    
    if (scenario === "virus") {
      messageText = `
        <p class="run-title">🎉 Great choice not to use antibiotics for a virus!</p>
        <p class="run-subtitle">Viruses need different treatments. A doctor can help choose the right treatment.</p>
      `;
    } else if (scenario === "superbug") {
      messageText = `
        <p class="run-title">✓ That was the right choice!</p>
        <p class="run-subtitle">These bacteria are resistant to these antibiotics. We're better off finding out more about the infection and then making a more informed treatment strategy.</p>
      `;
    } else {
      messageText = `
        <p class="run-title">⚠️ Without proper treatment, the infection keeps growing.</p>
        <p class="run-subtitle">The patient doesn't get better, they might need antibiotics to treat this infection.</p>
      `;
    }
    
    if (ui) {
      ui.innerHTML = messageText;
    }
    
    // Don't modify bottomUI here - let drawPatientArrow() handle the panel + buttons
    return;
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
  
  // Virus treatment always fails immediately
  if (scenario === "virus") {
    resistantRebound = true;
    reboundStartTime = 0;
    nextActionTime = 360;
  }
  // Superbug is always resistant from the start
  else if (scenario === "superbug") {
    resistantRebound = true;
    reboundStartTime = 0;
    nextActionTime = 360;
  }
  // Bacteria have random resistance chance
  else {
    const jumpedToResistance = maybeTriggerRandomResistance(timer, 0.03);
    if (jumpedToResistance) {
      nextActionTime = timer + 360;
    }
  }
  
  setupUI();

  // Keep the exact dish state from the previous slide when available.
  // Fallback to initialization only if no bacteria are currently present.
  if (bacteria.length === 0) {
    initInfection();
  }

  // First antibiotic dose
  antibioticDrops = [createAntibioticDrop(0)];
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

    const jumpedToResistance = maybeTriggerRandomResistance(timer, 0.095);
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
  nextActionTime = 0;
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

  const layout = getConfirmDishLayout();
  const spreadRadius = layout.microbeRadius + 20;

  for (let i = 0; i < 80; i++) {
    const p = randomPointInCircle(layout.cx, layout.cy, spreadRadius);
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

  const layout = getConfirmDishLayout();
  const cx = layout.cx;
  const cy = layout.cy;
  const spreadRadius = layout.microbeRadius + 20;

  // Infection spreads rapidly when no antibiotic is used, within dish bounds
  if (frameCount % 20 === 0 && bacteria.length < 200) {
    const p = randomPointInCircle(cx, cy, spreadRadius);
    bacteria.push({
      x: p.x,
      y: p.y,
      alpha: 255,
      rot: random(TWO_PI),
      sizeScale: random(0.88, 1.15)
    });
  }

  const characterLabel = getSelectedCharacterLabel();

  if (scenario === "bacteria") {
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
      } else {
        fill(0, 180, 0, b.alpha);
        noStroke();
        ellipse(b.x, b.y, 8);
      }
    }
  }

  if (scenario === "superbug") {
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
      } else {
        fill(150, 0, 150, b.alpha);
        noStroke();
        ellipse(b.x, b.y, 8);
      }
    }
  }

  if (scenario === "virus") {
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
      } else {
        fill(255, 100, 0, b.alpha);
        noStroke();
        push();
        translate(b.x, b.y);
        rotate(frameCount * 0.01);
        triangle(-6, -6, 6, -6, 0, 6);
        pop();
      }
    }
  }

  drawPatientArrow(false, 0);

  if (timer > nextActionTime && !resetShown) {
    resetShown = true;
    setupUI();
  }
}

// ====== Bacteria Scenario ======
function runBacteriaScenario() {
  if (antibioticDrops.length === 0) return;

  // Update title if resistant rebound has been triggered
  const ui = document.getElementById("ui");
  if (ui && resistantRebound) {
    const runTitle = "Uh oh, the bacteria has developed resistance to this antibiotic.";
    ui.innerHTML = `
      <p class="run-title">❌ ${runTitle}</p>
      <p class="run-subtitle">Repeated exposure to antibiotics means bacteria are more able to develop resistance.</p>
    `;
  }

  const arrivalFrames = BACTERIA_ARRIVAL_FRAMES;
  const effectFrames = BACTERIA_EFFECT_FRAMES;

  const dishCx = width / 2;
  const dishCy = height / 2;

  const doseEffects = [];

  for (let i = 0; i < antibioticDrops.length; i++) {
    const drop = antibioticDrops[i];
    const spreadBoost = drop.spreadBoost || 1;
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

    const killRadius = (18 + 62 * effectProgress) * spreadBoost;
    const fadeRadius = killRadius + 24;

    // Visible antibiotic zone once drop lands
    if (localAnim >= 1) {
      fill(0, 150, 255, 70 + 70 * effectProgress);
      noStroke();
      ellipse(drop.x, drop.y, killRadius * 1.45);
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
    const layout = getConfirmDishLayout();
    const spreadRadius = layout.microbeRadius + 20;

    // After repeated dosing, resistant bacteria regrow and patient worsens.
    if (frameCount % 7 === 0 && bacteria.length < 140) {
      const p = randomPointInCircle(layout.cx, layout.cy, spreadRadius);
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
    const layout = getConfirmDishLayout();
    const spreadRadius = layout.microbeRadius + 20;

    if (ui) {
      ui.innerHTML = `
        <p class="run-title">⚠️ The infection remains.</p>
        <p class="run-subtitle">Enough healthy bacteria remain for the bacteria to survive and the patient doesn't get better.</p>
      `;
    }

    if (frameCount % 14 === 0 && bacteria.length < 140) {
      const p = randomPointInCircle(layout.cx, layout.cy, spreadRadius);
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

  // Determine if infection is cured. A strong first dose can clear infection
  // at a slightly higher remaining-bacteria threshold.
  const bacteriaPercentageRemaining = totalCount > 0 ? aliveCount / totalCount : 0;
  const curedThreshold = antibioticDoseCount <= 1 ? 0.34 : 0.3;
  let cured = bacteriaPercentageRemaining < curedThreshold;
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
      ui.innerHTML = `
        <p class="run-title">🎉 Yay! The infection has been successfully treated.</p>
        <p class="run-subtitle">The antibiotics have killed enough bacteria, and the patient has recovered.</p>
      `;
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
  if (antibioticDrops.length === 0) return;

  const arrivalFrames = BACTERIA_ARRIVAL_FRAMES;
  const effectFrames = BACTERIA_EFFECT_FRAMES;

  const layout = getConfirmDishLayout();
  const dishCx = layout.cx;
  const dishCy = layout.cy;
  const spreadRadius = layout.microbeRadius + 20;

  // Draw antibiotic drops coming in (but they have no effect on superbug)
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

    // Show antibiotic zone but no killing effect
    if (localAnim >= 1) {
      fill(0, 150, 255, 50);
      noStroke();
      ellipse(drop.x, drop.y, 108);
      drawAntibioticIcon(drop.x, drop.y, 0.68);
    }
  }

  // When resistant, superbug cells turn red and rapidly regrow
  if (resistantRebound) {
    if (frameCount % 7 === 0 && bacteria.length < 140) {
      const p = randomPointInCircle(dishCx, dishCy, spreadRadius);
      bacteria.push({
        x: p.x,
        y: p.y,
        alpha: 255,
        rot: random(TWO_PI),
        sizeScale: random(0.88, 1.15)
      });
    }

    let aliveCount = 0;

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

  // Superbug cells keep growing despite antibiotic (before resistance)
  if (frameCount % 10 === 0 && bacteria.length < 160) {
    const p = randomPointInCircle(dishCx, dishCy, spreadRadius);
    bacteria.push({
      x: p.x,
      y: p.y,
      alpha: 255,
      rot: random(TWO_PI),
      sizeScale: random(0.88, 1.15)
    });
  }

  let aliveCount = bacteria.length;

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
    } else {
      fill(150, 0, 150, b.alpha);
      noStroke();
      ellipse(b.x, b.y, 8);
    }
  }

  // Health declining as superbug spreads
  const spreadProgress = constrain((timer - reboundStartTime) / 400, 0, 1);
  const healthProgress = constrain(0.6 - spreadProgress * 0.5, 0.05, 0.6);
  drawPatientArrow(false, healthProgress);
}

// ====== Virus Scenario ======
function runVirusScenario() {
  if (antibioticDrops.length === 0) return;

  const arrivalFrames = BACTERIA_ARRIVAL_FRAMES;
  const effectFrames = BACTERIA_EFFECT_FRAMES;

  const layout = getConfirmDishLayout();
  const dishCx = layout.cx;
  const dishCy = layout.cy;
  const spreadRadius = layout.microbeRadius + 20;

  // Draw antibiotic drops coming in (but they have no effect on virus)
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

    // Show antibiotic zone but no killing effect
    if (localAnim >= 1) {
      fill(0, 150, 255, 50);
      noStroke();
      ellipse(drop.x, drop.y, 108);
      drawAntibioticIcon(drop.x, drop.y, 0.68);
    }
  }

  // Virus cells keep growing despite antibiotic
  if (frameCount % 10 === 0 && bacteria.length < 160) {
    const p = randomPointInCircle(dishCx, dishCy, spreadRadius);
    bacteria.push({
      x: p.x,
      y: p.y,
      alpha: 255,
      rot: random(TWO_PI),
      sizeScale: random(0.88, 1.15)
    });
  }

  let aliveCount = bacteria.length;

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
    } else {
      fill(255, 100, 0, b.alpha);
      noStroke();
      push();
      translate(b.x, b.y);
      rotate(frameCount * 0.01);
      triangle(-6, -6, 6, -6, 0, 6);
      pop();
    }
  }

  // Health declining as virus spreads
  const spreadProgress = constrain((timer - reboundStartTime) / 400, 0, 1);
  const healthProgress = constrain(0.6 - spreadProgress * 0.5, 0.05, 0.6);
  drawPatientArrow(false, healthProgress);
}

// ====== Draw Patient Arrow ======
function drawPatientArrow(cured, healthProgress = 0) {
  const p = constrain(healthProgress, 0, 1);
  const status = cured ? "Healthy" : p > 0.2 ? "Recovering" : "Unwell";
  const percent = Math.round(p * 100);
  const bottomUI = document.getElementById("bottom-ui");
  if (!bottomUI) return;

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

  // If final actions are shown, just update the panel part without replacing buttons
  if (resetShown && bottomUI.querySelector(".end-actions")) {
    const existingPanel = bottomUI.querySelector(".human-response-panel");
    if (existingPanel) {
      existingPanel.outerHTML = panelHTML;
    }
  } else {
    if (resetShown) {
      let actionsHTML;
      if (state === "runNoTreatment") {
        actionsHTML = `
          <div class="end-actions">
            <button class="reset-btn" onclick="backToChooseCharacter()">Start again</button>
          </div>
        `;
      } else {
        actionsHTML = getEndActionsHTML();
      }
      bottomUI.innerHTML = panelHTML + actionsHTML;
    } else {
      bottomUI.innerHTML = panelHTML;
    }
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
