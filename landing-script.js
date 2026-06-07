/* Landing Page & Main Game Orchestrator */

const landing = document.getElementById('landing-screen');
const gameScreen = document.getElementById('game-screen');
const bulb = document.getElementById('bulb-glass');
const simpleSwitchKnob = document.getElementById('simple-switch-knob');

let isLightOn = true;
let lastTime = 0;

// Cleanup references for memory leak prevention
const eventListeners = [];

function registerListener(target, event, handler, options = false) {
  target.addEventListener(event, handler, options);
  eventListeners.push({ target, event, handler, options });
}

function removeAllListeners() {
  eventListeners.forEach(({ target, event, handler, options }) => {
    target.removeEventListener(event, handler, options);
  });
  eventListeners.length = 0;
  clearAllTimeouts();
}

let activeTimeouts = [];
function registerTimeout(fn, delay) {
  const id = setTimeout(fn, delay);
  activeTimeouts.push(id);
  return id;
}

function clearAllTimeouts() {
  activeTimeouts.forEach(id => clearTimeout(id));
  activeTimeouts.length = 0;
}

// 1. Landing light switch click toggle logic
const simpleSwitch = document.getElementById('simple-switch');
const startGameplayFromLanding = () => {
  if (!isLightOn) return;
  if (window.audio) window.audio.playClick();

  const switchKnob = document.getElementById('simple-switch-knob');
  if (switchKnob) switchKnob.classList.add('switch-on');
  isLightOn = false;
  document.body.style.backgroundColor = '#0c0a09';
  landing.classList.add('opacity-0', 'pointer-events-none');

  registerTimeout(() => {
    landing.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    void gameScreen.offsetWidth;
    gameScreen.classList.add('opacity-100');

    if (window.audio) window.audio.startHum();
    if (window.gameEngine) window.gameEngine.startGame();

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }, 600);
};

if (simpleSwitch) {
  registerListener(simpleSwitch, 'click', startGameplayFromLanding);
}

document.querySelectorAll('input[name="control-mode"]').forEach((el) => {
  registerListener(el, 'change', (e) => {
    if (!window.gameEngine || !e.target.checked) return;
    window.gameEngine.setControlMode(e.target.value);
  });
});

// Sync UI with gameEngine's native auto-detection
setTimeout(() => {
  if (window.gameEngine && window.gameEngine.controlMode === 'joystick') {
    const joyRadio = document.querySelector('input[value="joystick"]');
    if (joyRadio) joyRadio.checked = true;
  }
}, 50);

// 2. Playable game animation loop
function gameLoop(time) {
  if (!window.gameEngine || window.gameEngine.state === 'INIT' || window.gameEngine.state === 'LANDING') return;

  const dt = (time - lastTime) / 1000.0;
  lastTime = time;

  if (window.gameEngine.state === 'PLAYING') {
    window.gameEngine.update(dt);
  }
  window.gameEngine.draw();
  requestAnimationFrame(gameLoop);
}

// 3. Pause menu bindings
const pauseVolume = document.getElementById('pause-volume');
const pauseMuteBtn = document.getElementById('pause-mute-btn');

if (pauseVolume) {
  registerListener(pauseVolume, 'input', (e) => {
    if (!window.audio) return;
    const v = Number(e.target.value) / 100;
    window.audio.setVolume(v);
  });
}

if (pauseMuteBtn) {
  registerListener(pauseMuteBtn, 'click', () => {
    if (!window.audio) return;
    const nextMuted = !window.audio.muted;
    window.audio.setMuted(nextMuted);
    pauseMuteBtn.textContent = nextMuted ? 'Unmute Audio' : 'Mute Audio';
  });
}

registerListener(document.getElementById('pause-trigger'), 'click', () => {
  if (window.gameEngine) window.gameEngine.pauseGame();
  if (window.audio && pauseVolume && pauseMuteBtn) {
    pauseVolume.value = String(Math.round((window.audio.volume || 0) * 100));
    pauseMuteBtn.textContent = window.audio.muted ? 'Unmute Audio' : 'Mute Audio';
  }
});

registerListener(document.getElementById('resume-btn'), 'click', () => {
  if (window.audio) window.audio.playClick();
  if (window.gameEngine) window.gameEngine.resumeGame();
});

// Exit handler returns to landing page
const returnToLanding = () => {
  removeAllListeners();

  // Cleanup game engine listeners and joystick
  if (window.gameEngine) {
    window.gameEngine.cleanup();
    window.gameEngine.cleanupJoystick();
    window.gameEngine.state = 'LANDING';
  }

  if (window.audio) {
    window.audio.playClick();
    window.audio.stopHum();
  }
  if (window.popups) {
    window.popups.clearAll();
  }

  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');
  gameScreen.classList.remove('opacity-100');
  gameScreen.classList.add('hidden');

  landing.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
  bulb.setAttribute('fill', '#fef08a');
  if (simpleSwitchKnob) {
    simpleSwitchKnob.classList.remove('switch-on');
  }
  isLightOn = true;
  document.body.style.backgroundColor = '#1c1917';

  reattachListeners();
};

registerListener(document.getElementById('exit-btn'), 'click', returnToLanding);
registerListener(document.getElementById('exit-gameover-btn'), 'click', returnToLanding);

// Restart game over binding
registerListener(document.getElementById('restart-btn'), 'click', () => {
  if (window.audio) {
    window.audio.playClick();
    window.audio.startHum();
  }
  document.getElementById('game-over-screen').classList.add('hidden');
  if (window.gameEngine) {
    window.gameEngine.startGame();
  }
});

// 4. Initialize game engine on load
function initGameEngine() {
  const canvas = document.getElementById('game-canvas');
  if (window.gameEngine) {
    window.gameEngine.init(canvas);
  }
  initBulbPhysics();
}

registerListener(window, 'load', initGameEngine);

// Re-attach listeners after returning to landing
function reattachListeners() {
  registerListener(simpleSwitch, 'click', startGameplayFromLanding);
  document.querySelectorAll('input[name="control-mode"]').forEach((el) => {
    registerListener(el, 'change', (e) => {
      if (!window.gameEngine || !e.target.checked) return;
      window.gameEngine.setControlMode(e.target.value);
    });
  });
}

// --- Bulb Physics (moved here to be part of landing script) ---
const bulbSvg = document.querySelector('.lightbulb-cord');
const bulbShadow = document.getElementById('bulb-shadow');
const bulbHint = document.getElementById('bulb-hint');
const bulbLine = document.getElementById('bulb-line');
const bulbFixture = document.getElementById('bulb-fixture');
const bulbGlass = document.getElementById('bulb-glass');
const bulbReflection = document.getElementById('bulb-reflection');

let angle = 0.15;
let angularVel = 0;
let angularAcc = 0;
let length = 78;
let lengthVel = 0;
let lengthAcc = 0;

const baseLength = 78;
const gravity = 28.0;
const damping = 0.995;
const springK = 180.0;
const springDamping = 1.1;
const angleSpringK = 4.5;
const angleDamping = 0.05;

let isDragging = false;
let lastTimeBulb = performance.now();
let mouseX = null;
let mouseY = null;
let isHovered = false;
let stillSince = null;
let bulbAnimationFrameId = null;

bulbSvg.addEventListener('pointerdown', (e) => {
  if (!isLightOn) return;
  if (bulbHint) bulbHint.classList.add('hidden');
  isDragging = true;
  bulbSvg.setPointerCapture(e.pointerId);
  if (window.audio) window.audio.playGrab();

  const pivot = getPivot();
  const dx = e.clientX - pivot.x;
  const dy = e.clientY - pivot.y;
  angle = Math.atan2(dy, dx) - (Math.PI / 2);
  length = Math.max(65, Math.min(308, Math.hypot(dx, dy) / 0.96));
  angularVel = 0;
  lengthVel = 0;
  lastTimeBulb = performance.now();
});

window.addEventListener('pointermove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  if (!isLightOn || !isDragging) return;
  const pivot = getPivot();
  const dx = e.clientX - pivot.x;
  const dy = e.clientY - pivot.y;
  const now = performance.now();
  const dt = Math.max(0.001, (now - lastTimeBulb) / 1000);

  const nextAngle = Math.atan2(dy, dx) - (Math.PI / 2);
  const nextLength = Math.max(65, Math.min(322, Math.hypot(dx, dy) / 0.96));

  angularVel = (nextAngle - angle) / dt;
  lengthVel = (nextLength - length) / dt;
  angularVel = Math.max(-20, Math.min(20, angularVel));
  lengthVel = Math.max(-900, Math.min(900, lengthVel));

  angle = nextAngle;
  length = nextLength;
  lastTimeBulb = now;
});

const releaseBulb = (e) => {
  if (!isDragging) return;
  isDragging = false;
  if (e && e.pointerId !== undefined) {
    try { bulbSvg.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  if (window.audio) window.audio.playSnapback();
};

bulbSvg.addEventListener('pointerup', releaseBulb);
bulbSvg.addEventListener('pointercancel', releaseBulb);

function getPivot() {
  const parentRect = bulbSvg.parentElement.getBoundingClientRect();
  return {
    x: parentRect.left + parentRect.width / 2,
    y: parentRect.top
  };
}

function updateBulbPhysics() {
  if (!isLightOn) {
    bulbAnimationFrameId = requestAnimationFrame(updateBulbPhysics);
    return;
  }

  const now = performance.now();
  const dt = Math.min(0.02, (now - lastTimeBulb) / 1000);
  lastTimeBulb = now;

  if (!isDragging) {
    if (mouseX !== null && mouseY !== null) {
      const pivot = getPivot();
      const scale = 0.96;
      const bulbX = pivot.x + Math.cos(angle) * length * scale;
      const bulbY = pivot.y + Math.sin(angle) * (length + 20) * scale;
      const dist = Math.hypot(mouseX - bulbX, mouseY - bulbY);

      if (dist < 65) {
        if (!isHovered) {
          isHovered = true;
          if (window.audio) window.audio.playFlicker();
        }
        angularVel += Math.sin(now * 0.03) * 0.016;
        lengthVel += Math.cos(now * 0.022) * 1.8;
      } else {
        isHovered = false;
      }
    }

    const oldLength = length;
    const lengthDisp = length - baseLength;
    lengthAcc = -(springK * lengthDisp) - (springDamping * lengthVel);
    lengthVel += lengthAcc * dt;
    length += lengthVel * dt;

    if (length < 55) {
      length = 55;
      lengthVel = 0;
    }

    if (oldLength > 40 && length > 40) {
      const ratio = Math.min(2.5, oldLength / length);
      angularVel *= (ratio * ratio);
    }

    const effectiveLength = Math.max(1, length / 100);
    angularAcc = -(gravity / effectiveLength) * Math.sin(angle) - (angleSpringK * angle) - (angleDamping * angularVel);
    angularVel += angularAcc * dt;
    angularVel *= damping;
    angle += angularVel * dt;
  }

  if (bulbLine) bulbLine.setAttribute('y2', length);
  if (bulbFixture) bulbFixture.setAttribute('y', length - 5);
  if (bulbGlass) bulbGlass.setAttribute('cy', length + 14);
  if (bulbReflection) bulbReflection.setAttribute('cy', length + 12);

  const degrees = angle * (180 / Math.PI);
  bulbSvg.style.transform = `rotate(${degrees}deg)`;

  if (bulbHint) {
    const motion = Math.abs(angularVel) + Math.abs(lengthVel * 0.01) + Math.abs(angle * 0.6);
    if (isDragging || motion > 0.12) {
      stillSince = null;
      bulbHint.classList.add('hidden');
    } else {
      if (stillSince === null) stillSince = now;
      if ((now - stillSince) >= 5000) {
        bulbHint.classList.remove('hidden');
      } else {
        bulbHint.classList.add('hidden');
      }
    }
  }

  const scale = 0.96;
  const rxScreen = Math.cos(angle) * length * scale;
  const ryScreen = Math.sin(angle) * length * scale;
  if (bulbShadow && bulbGlass && bulbSvg && bulbSvg.parentElement) {
    const parentRect = bulbSvg.parentElement.getBoundingClientRect();
    const bulbRect = bulbGlass.getBoundingClientRect();
    const centerX = (bulbRect.left + bulbRect.width / 2) - parentRect.left;
    const centerY = (bulbRect.top + bulbRect.height / 2) - parentRect.top;
    bulbShadow.style.left = `${centerX}px`;
    bulbShadow.style.top = `${centerY + 42}px`;
    bulbShadow.style.transform = 'translate(-50%, 0)';
  }

  bulbAnimationFrameId = requestAnimationFrame(updateBulbPhysics);
}

function initBulbPhysics() {
  if (bulbAnimationFrameId) cancelAnimationFrame(bulbAnimationFrameId);
  bulbAnimationFrameId = requestAnimationFrame(updateBulbPhysics);
}

// Cleanup bulb physics
window.addEventListener('beforeunload', () => {
  if (bulbAnimationFrameId) cancelAnimationFrame(bulbAnimationFrameId);
});
