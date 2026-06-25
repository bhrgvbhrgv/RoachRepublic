/**
 * Cockroach Janta Party - Canvas Game Engine
 */

class GameEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.state = 'INIT'; // INIT -> LANDING -> PLAYING -> PAUSED -> GAMEOVER

    // Logical world size is no longer used as a hard boundary.
    this.worldWidth = 2400;
    this.worldHeight = 1800;

    // Player state
    this.player = {
      x: 0,
      y: 0,
      radius: 20,
      angle: 0,
      targetAngle: 0,
      speed: 0,
      maxSpeed: 5,
      lives: 3,
      maxLives: 5,
      shieldTime: 0, // seconds left
      speedBoostTime: 0, // seconds left
      isSlowed: false
    };
    this.torchBurstCooldown = 0;
    this.invulnTime = 0;

    // Controller state
    this.mouse = { x: 0, y: 0 };
    // Tracks active finger for follow-mode on mobile
    this.touch = { active: false, x: 0, y: 0 };
    this.joystick = {
      active: false,
      startX: 0,
      startY: 0,
      curX: 0,
      curY: 0,
      vx: 0,
      vy: 0,
      maxRadius: 50
    };

    // Entities
    this.hazards = [];
    this.collectibles = [];
    this.particles = [];
    this.allies = [];
    this.deadAllies = [];

    // Spawning rates (ms)
    this.spawnTimers = {
      chappal: 0,
      baygon: 0,
      torch: 0,
      collectible: 0,
      allyForced: 0
    };

    // Game stats - MONEY BASED SYSTEM
    this.money = 0; // in rupees
    this.peakMoney = 0; // highest money reached in this run
    this.survivalTime = 0;
    this.isMobile = false;
    this.mobileQualityMode = false;
    this.dpr = 1;
    this.chappalHits = 0;
    this.deadAlliesCount = 0;
    this.highScore = parseFloat(localStorage.getItem('rr_high_score') || '0'); // peak money ever
    
    // Auto-detect mobile devices natively in constructor
    const isTouch = (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
    this.controlMode = isTouch ? 'joystick' : 'follow'; // follow | joystick

    // Tax system
    this.taxTimer = 0;
    this.taxInterval = 12.0; // every 12 seconds
    this.taxAmount = 0.30; // flat ₹0.30 deduction every 12 seconds
    this.lastTaxAmount = 0;

    // Sound control
    this.lastSkitterTime = 0;
    this.skitterInterval = 280; // ms

    // Procedural grease stains on the floor
    this.greaseStains = [];
    this.generateGreaseStains();
  }

  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    this.updateControlMode();

    // Store listeners for cleanup
    this._listeners = [];

    const resizeHandler = () => {
      this.resizeCanvas();
      this.updateControlMode();
    };
    this._listeners.push({ target: window, event: 'resize', handler: resizeHandler });
    window.addEventListener('resize', resizeHandler);

    // Unified pointer/mouse handler for follow-cursor mode (desktop)
    const pointerMoveHandler = (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    };
    this._listeners.push({ target: window, event: 'pointermove', handler: pointerMoveHandler });
    this._listeners.push({ target: window, event: 'pointerdown', handler: pointerMoveHandler });
    window.addEventListener('pointermove', pointerMoveHandler);
    window.addEventListener('pointerdown', pointerMoveHandler);

    // Touch tracking for follow-finger mode on mobile
    const touchStartHandler = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      this.touch.active = true;
      this.touch.x = t.clientX;
      this.touch.y = t.clientY;
    };
    const touchMoveHandler = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      this.touch.x = t.clientX;
      this.touch.y = t.clientY;
    };
    const touchEndHandler = () => {
      this.touch.active = false;
    };
    this._listeners.push({ target: window, event: 'touchstart', handler: touchStartHandler, passive: true });
    this._listeners.push({ target: window, event: 'touchmove', handler: touchMoveHandler, passive: true });
    this._listeners.push({ target: window, event: 'touchend', handler: touchEndHandler });
    this._listeners.push({ target: window, event: 'touchcancel', handler: touchEndHandler });
    window.addEventListener('touchstart', touchStartHandler, { passive: true });
    window.addEventListener('touchmove', touchMoveHandler, { passive: true });
    window.addEventListener('touchend', touchEndHandler);
    window.addEventListener('touchcancel', touchEndHandler);

    this.setupJoystick();
    this.state = 'LANDING';
  }

  cleanup() {
    if (this._listeners) {
      this._listeners.forEach(({ target, event, handler, passive }) => {
        target.removeEventListener(event, handler, passive ? { passive: true } : false);
      });
      this._listeners.length = 0;
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const width = Math.max(1, Math.floor(window.innerWidth));
    const height = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, this.mobileQualityMode ? 1.5 : 2);

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.dpr = dpr;

    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  updateControlMode() {
    // Control mode is explicitly selected from landing settings only.
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    this.isMobile = this.controlMode === 'joystick';
    this.mobileQualityMode = this.isMobile || isTouchDevice || window.innerWidth < 900;
    const joyContainer = document.getElementById('joystick-container');
    if (joyContainer) {
      if (this.isMobile) joyContainer.classList.remove('hidden');
      else joyContainer.classList.add('hidden');
    }
  }

  setControlMode(mode) {
    this.controlMode = (mode === 'joystick') ? 'joystick' : 'follow';
    this.updateControlMode();
  }

  generateGreaseStains() {
    for (let i = 0; i < 40; i++) {
      this.greaseStains.push({
        x: Math.random() * this.worldWidth,
        y: Math.random() * this.worldHeight,
        radius: 10 + Math.random() * 40,
        opacity: 0.05 + Math.random() * 0.12,
        color: Math.random() > 0.5 ? '#7c2d12' : '#451a03' // brown/greasy oil drops
      });
    }
  }

  setupJoystick() {
    const joyContainer = document.getElementById('joystick-container');
    const joyThumb = document.getElementById('joystick-thumb');
    if (!joyContainer || !joyThumb) return;

    this.updateControlMode();

    const handleStart = (e) => {
      if (e.cancelable && e.type !== 'pointerdown') e.preventDefault();
      if (this.state !== 'PLAYING') return;
      const touch = e.touches ? e.touches[0] : e;
      this.joystick.active = true;
      this.joystick.startX = touch.clientX;
      this.joystick.startY = touch.clientY;
      this.joystick.curX = touch.clientX;
      this.joystick.curY = touch.clientY;

      joyThumb.style.transform = 'translate(-50%, -50%)';
    };

    const handleMove = (e) => {
      if (!this.joystick.active || this.state !== 'PLAYING') return;
      if (e.cancelable && e.type !== 'pointermove') e.preventDefault();
      const touch = e.touches ? e.touches[0] : e;
      this.joystick.curX = touch.clientX;
      this.joystick.curY = touch.clientY;

      let dx = this.joystick.curX - this.joystick.startX;
      let dy = this.joystick.curY - this.joystick.startY;
      const dist = Math.hypot(dx, dy);

      if (dist > this.joystick.maxRadius) {
        dx = (dx / dist) * this.joystick.maxRadius;
        dy = (dy / dist) * this.joystick.maxRadius;
      }

      joyThumb.style.left = `calc(50% + ${dx}px)`;
      joyThumb.style.top = `calc(50% + ${dy}px)`;

      this.joystick.vx = dx / this.joystick.maxRadius;
      this.joystick.vy = dy / this.joystick.maxRadius;
    };

    const handleEnd = () => {
      this.joystick.active = false;
      this.joystick.vx = 0;
      this.joystick.vy = 0;
      joyThumb.style.left = '50%';
      joyThumb.style.top = '50%';
    };

    if (!this._joystickListeners) this._joystickListeners = [];

    this._joystickListeners.push({ target: joyContainer, event: 'touchstart', handler: handleStart });
    joyContainer.addEventListener('touchstart', handleStart);

    this._joystickListeners.push({ target: window, event: 'touchmove', handler: handleMove, passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });

    this._joystickListeners.push({ target: window, event: 'touchend', handler: handleEnd });
    window.addEventListener('touchend', handleEnd);

    const joyPointerDownHandler = (e) => {
      e.preventDefault();
      handleStart(e);
      try { joyContainer.setPointerCapture(e.pointerId); } catch (_) { }
    };
    this._joystickListeners.push({ target: joyContainer, event: 'pointerdown', handler: joyPointerDownHandler });
    joyContainer.addEventListener('pointerdown', joyPointerDownHandler);

    this._joystickListeners.push({ target: window, event: 'pointermove', handler: handleMove });
    window.addEventListener('pointermove', handleMove);

    this._joystickListeners.push({ target: window, event: 'pointerup', handler: handleEnd });
    window.addEventListener('pointerup', handleEnd);

    this._joystickListeners.push({ target: window, event: 'pointercancel', handler: handleEnd });
    window.addEventListener('pointercancel', handleEnd);
  }

  cleanupJoystick() {
    if (this._joystickListeners) {
      this._joystickListeners.forEach(({ target, event, handler, passive }) => {
        target.removeEventListener(event, handler, passive ? { passive: false } : false);
      });
      this._joystickListeners.length = 0;
    }
  }

  // Start game loop
  startGame() {
    this.state = 'PLAYING';
    this.player.lives = 3;
    this.player.x = 0;
    this.player.y = 0;
    this.player.shieldTime = 0;
    this.player.speedBoostTime = 0;
    this.player.isSlowed = false;
    this.torchBurstCooldown = 0;
    this.invulnTime = 0;

    this.money = 1.0; // Start with 1 Rs
    this.peakMoney = 1.0;
    this.taxTimer = 0;
    this.survivalTime = 0;
    this.chappalHits = 0;
    this.deadAlliesCount = 0;
    this.lastTaxAmount = 0;

    this.hazards = [];
    this.collectibles = [];
    this.particles = [];
    this.allies = [];
    this.deadAllies = [];

    if (window.popups) {
      window.popups.clearAll();
      window.popups.startSpawning();
    }

    // Refresh HUD immediately so hearts/money/stats show correct reset values
    this.updateHUD();
  }

  addMoney(rupeesAmount) {
    if (this.state !== 'PLAYING') return;
    this.money += rupeesAmount;
    if (this.money < 0) this.money = 0;
    if (this.money > this.peakMoney) {
      this.peakMoney = this.money;
      if (this.peakMoney > this.highScore) {
        this.highScore = this.peakMoney;
        try { localStorage.setItem('rr_high_score', String(this.highScore.toFixed(2))); } catch (_) { }
      }
    }
    this.updateHUD();
  }




  triggerDamage(source = 'generic') {
    if (source === 'chappal') {
      this.chappalHits++;
      this.updateHUD();
    }

    // Shield protects both main roach and allied roaches.
    if (this.player.shieldTime > 0) return;
    if (this.invulnTime > 0) return;

    // Ally roach has exactly 1 heart and only blocks chappal hits.
    if (source === 'chappal' && this.allies.length > 0) {
      const sacrificed = this.allies.shift();
      this.deadAlliesCount++;
      this.deadAllies.push({
        x: sacrificed.x,
        y: sacrificed.y,
        angle: sacrificed.angle || 0,
        life: 0.7,
        vy: -0.2
      });
      this.spawnParticles(sacrificed.x, sacrificed.y, '#f59e0b', 10);
      this.updateHUD();
      return;
    }

    this.player.lives--;
    this.invulnTime = 1.0;

    // Sound & visual shake
    if (window.audio) {
      window.audio.playHit();
    }

    // Screen flash
    const flashEl = document.getElementById('flash-effect');
    if (flashEl) {
      flashEl.classList.remove('damage-flash');
      void flashEl.offsetWidth; // trigger reflow
      flashEl.classList.add('damage-flash');
    }

    this.spawnParticles(this.player.x, this.player.y, '#7f1d1d', 15); // blood-red splash

    this.updateHUD();

    if (this.player.lives <= 0) {
      this.gameOver('health');
    }
  }

  gameOver(reason = 'bankruptcy') {
    this.state = 'GAMEOVER';
    if (window.audio) {
      window.audio.playGameOver();
      window.audio.stopHum();
    }
    if (window.popups) {
      window.popups.clearAll();
    }

    // Show game over overlay
    const gameOverMenu = document.getElementById('game-over-screen');
    const finalScoreEl = document.getElementById('final-score');
    if (gameOverMenu) gameOverMenu.classList.remove('hidden');
    if (finalScoreEl) finalScoreEl.innerText = `₹ ${this.money.toFixed(2)}`;
  }

  showTaxPopup(amount) {
    if (this.money > 5.00) {
      // Positive Balance (> ₹5.00): silent, clean animation. No popup.
      const scoreEl = document.getElementById('score-value');
      if (scoreEl) {
        const rect = scoreEl.getBoundingClientRect();
        const floatingText = document.createElement('div');
        floatingText.className = 'fixed text-stone-300 font-retro text-sm font-bold pointer-events-none transition-all duration-1000 z-50';
        floatingText.style.left = `${rect.left}px`;
        floatingText.style.top = `${rect.top}px`;
        floatingText.innerText = `-${amount.toFixed(2)}`;
        document.body.appendChild(floatingText);
        
        void floatingText.offsetWidth; // Force reflow
        floatingText.style.transform = 'translateY(-20px)';
        floatingText.style.opacity = '0';
        setTimeout(() => floatingText.remove(), 1000);
      }
    } else if (this.money > 0.00) {
      // Low Balance (₹0.01 - ₹5.00): Text turns yellow. Subtle notification.
      const popup = document.createElement('div');
      popup.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 bg-yellow-900/90 border border-yellow-600 text-yellow-100 px-3 py-1.5 md:px-5 md:py-3 rounded shadow-lg z-50 font-mono text-center pointer-events-none transition-opacity duration-1000';
      popup.innerHTML = `
        <div class="text-[8px] md:text-xs uppercase tracking-wider mb-0.5 text-yellow-300">Tax Deducted</div>
        <div class="text-xs md:text-sm font-bold text-yellow-400">-${amount.toFixed(2)} Rs</div>
      `;
      document.body.appendChild(popup);
      
      setTimeout(() => {
        popup.style.opacity = '0';
        setTimeout(() => popup.remove(), 1000);
      }, 1000);
    } else {
      // Danger Zone (<= ₹0.00): High-alert visual assets.
      const popup = document.createElement('div');
      popup.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 bg-red-900/95 border-2 md:border-4 border-red-600 text-red-100 px-3 py-2 md:px-6 md:py-4 rounded shadow-2xl z-50 font-mono text-center pointer-events-none popup-shake';
      popup.innerHTML = `
        <div class="text-[10px] md:text-sm font-bold uppercase tracking-wider mb-1">DANGER: TAX DEDUCTED</div>
        <div class="text-sm md:text-2xl font-bold text-red-400">-${amount.toFixed(2)} Rs</div>
      `;
      document.body.appendChild(popup);
      setTimeout(() => popup.remove(), 2000);

      // Flashing red overlay
      const flash = document.getElementById('flash-effect');
      if (flash) {
        flash.classList.add('bg-red-600/30');
        setTimeout(() => flash.classList.remove('bg-red-600/30'), 300);
      }

      // Play alarm/damage sound
      if (window.audio && window.audio.playHit) {
        window.audio.playHit();
      }
    }
  }

  pauseGame() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      document.getElementById('pause-menu').classList.remove('hidden');
      if (window.popups) window.popups.stopSpawning();
    }
  }

  resumeGame() {
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      document.getElementById('pause-menu').classList.add('hidden');
      if (window.popups) window.popups.startSpawning();
    }
  }

  updateHUD() {
    // Health hearts
    const heartsContainer = document.getElementById('hud-hearts');
    if (heartsContainer) {
      heartsContainer.innerHTML = '';
      for (let i = 0; i < this.player.maxLives; i++) {
        const heart = document.createElement('span');
        heart.textContent = i < this.player.lives ? '❤' : '♡';
        heart.className = `text-[8px] leading-none emoji ${i < this.player.lives ? 'text-red-600' : 'text-stone-600'}`;
        heartsContainer.appendChild(heart);
      }
    }

    // Money display
    const moneyVal = document.getElementById('score-value');
    if (moneyVal) moneyVal.innerText = `₹ ${this.money.toFixed(2)}`;

    // Multiplier → Money display in HUD
    const multVal = document.getElementById('mult-value');
    if (multVal) {
      multVal.innerText = `${this.peakMoney.toFixed(2)}`;
      multVal.className = this.money > 1.0 ? 'text-yellow-400 font-bold' : 'text-stone-400';
    }

    const chappalHitsVal = document.getElementById('chappal-hits-value');
    if (chappalHitsVal) chappalHitsVal.innerText = String(this.chappalHits);

    const highScoreVal = document.getElementById('high-score-value');
    if (highScoreVal) highScoreVal.innerText = `₹ ${this.highScore.toFixed(2)}`;

    const deadAlliesVal = document.getElementById('dead-allies-value');
    if (deadAlliesVal) deadAlliesVal.innerText = String(this.allies.length);

    // Powerups HUD
    const shieldHud = document.getElementById('shield-hud');
    const speedHud = document.getElementById('speed-hud');

    if (shieldHud) {
      if (this.player.shieldTime > 0) {
        shieldHud.classList.remove('hidden');
        shieldHud.querySelector('.hud-timer-bar').style.width = `${(this.player.shieldTime / 5) * 100}%`;
      } else {
        shieldHud.classList.add('hidden');
      }
    }

    if (speedHud) {
      if (this.player.speedBoostTime > 0) {
        speedHud.classList.remove('hidden');
        speedHud.querySelector('.hud-timer-bar').style.width = `${(this.player.speedBoostTime / 3) * 100}%`;
      } else {
        speedHud.classList.add('hidden');
      }
    }
  }

  spawnParticles(x, y, color, count = 8) {
    const maxParticles = this.mobileQualityMode ? Math.min(count, 6) : count;
    if (this.particles.length > 180) return;

    for (let i = 0; i < maxParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 4,
        color,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.04
      });
    }
  }

  // Update physics and state
  update(dt) {
    if (this.state !== 'PLAYING') return;

    // Timers decrement
    if (this.player.shieldTime > 0) {
      this.player.shieldTime = Math.max(0, this.player.shieldTime - dt);
    }
    if (this.player.speedBoostTime > 0) {
      this.player.speedBoostTime = Math.max(0, this.player.speedBoostTime - dt);
    }
    if (this.invulnTime > 0) {
      this.invulnTime = Math.max(0, this.invulnTime - dt);
    }
    if (this.torchBurstCooldown > 0) {
      this.torchBurstCooldown = Math.max(0, this.torchBurstCooldown - dt);
    }

    // Tax timer & bankruptcy check
    this.taxTimer += dt;
    this.survivalTime += dt;

    if (this.taxTimer >= this.taxInterval) {
      this.taxTimer = 0;
      this.survivalTime = Math.floor(this.survivalTime);

      // Multi-Tiered Dynamic Tax Brackets
      let taxAmount = 0;
      if (this.money <= 0.00) {
        taxAmount = 0.10;
      } else if (this.money <= 10.00) {
        taxAmount = 0.40;
      } else if (this.money <= 30.00) {
        taxAmount = 0.80;
      } else {
        taxAmount = 1.50;
      }

      this.lastTaxAmount = taxAmount;
      this.money = Math.max(-5.00, this.money - taxAmount);
      this.showTaxPopup(this.lastTaxAmount);
    }

    // --- Movement calculation ---
    let moveX = 0;
    let moveY = 0;
    let targetAngle = this.player.angle;
    let isMoving = false;

    if (this.isMobile && this.joystick.active) {
      // Joystick movement
      moveX = this.joystick.vx;
      moveY = this.joystick.vy;
      targetAngle = Math.atan2(moveY, moveX);
      isMoving = Math.hypot(moveX, moveY) > 0.15;
    } else if (!this.isMobile && this.touch.active) {
      // Follow-finger mode on mobile: cockroach chases held finger position
      const dx = this.touch.x - window.innerWidth / 2;
      const dy = this.touch.y - window.innerHeight / 2;
      const dist = Math.hypot(dx, dy);
      if (dist > 20) {
        targetAngle = Math.atan2(dy, dx);
        const intensity = Math.min(1.0, dist / 150);
        moveX = Math.cos(targetAngle) * intensity;
        moveY = Math.sin(targetAngle) * intensity;
        isMoving = true;
      }
    } else if (!this.isMobile) {
      // Mouse movement on desktop
      const dx = this.mouse.x - window.innerWidth / 2;
      const dy = this.mouse.y - window.innerHeight / 2;
      const dist = Math.hypot(dx, dy);
      if (dist > 30) {
        targetAngle = Math.atan2(dy, dx);
        const intensity = Math.min(1.0, dist / 180);
        moveX = Math.cos(targetAngle) * intensity;
        moveY = Math.sin(targetAngle) * intensity;
        isMoving = true;
      }
    }

    // Speed modifiers
    let currentMaxSpeed = this.player.maxSpeed;
    if (this.player.speedBoostTime > 0) {
      currentMaxSpeed *= 1.8;
    }
    if (this.player.isSlowed) {
      currentMaxSpeed *= 0.45;
    }

    if (isMoving) {
      // Apply movement speed
      const targetSpeed = currentMaxSpeed * Math.hypot(moveX, moveY);
      this.player.speed += (targetSpeed - this.player.speed) * 0.15;

      // Smooth angle rotation
      let angleDiff = targetAngle - this.player.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      this.player.angle += angleDiff * 0.22;

      // Move player position in world
      this.player.x += Math.cos(this.player.angle) * this.player.speed;
      this.player.y += Math.sin(this.player.angle) * this.player.speed;

      // Play skitter sound periodically
      const now = Date.now();
      if (now - this.lastSkitterTime > this.skitterInterval) {
        if (window.audio) window.audio.playSkitter();
        this.lastSkitterTime = now;
      }

      // Dust trail while speed boost is active.
      if (this.player.speedBoostTime > 0 && Math.random() > 0.35) {
        const backX = this.player.x - Math.cos(this.player.angle) * 20;
        const backY = this.player.y - Math.sin(this.player.angle) * 20;
        const spread = (Math.random() - 0.5) * 10;
        this.particles.push({
          x: backX + Math.cos(this.player.angle + Math.PI / 2) * spread,
          y: backY + Math.sin(this.player.angle + Math.PI / 2) * spread,
          vx: -Math.cos(this.player.angle) * (0.8 + Math.random() * 1.6),
          vy: -Math.sin(this.player.angle) * (0.8 + Math.random() * 1.6),
          radius: 1 + Math.random() * 2,
          color: 'rgba(180, 180, 180, 0.85)',
          life: 0.45,
          decay: 0.035 + Math.random() * 0.03
        });
      }
    } else {
      this.player.speed *= 0.8; // decelerate
    }

    // Infinite map: no boundary clamp.

    // --- Entity Spawns ---
    this.updateSpawners(dt);

    // --- Update Entities & Collision check ---
    this.updateHazards(dt);
    this.updateCollectibles(dt);
    this.updateParticles(dt);
  }

  updateSpawners(dt) {
    // 1. Flying Chappal (Linear flying shoe hazard)
    this.spawnTimers.chappal += dt;
    const chappalInterval = Math.max(1.8, 3.5 - (this.survivalTime * 0.02)); // faster spawns over time
    if (this.spawnTimers.chappal >= chappalInterval) {
      this.spawnTimers.chappal = 0;
      // Increase pressure: spawn two chappals per cycle.
      this.spawnChappal();
      this.spawnChappal();
    }

    // 2. Bygone Cloud (damage-over-time areas)
    this.spawnTimers.baygon += dt;
    const baygonInterval = Math.max(6.0, 10.0 - (this.survivalTime * 0.04));
    if (this.spawnTimers.baygon >= baygonInterval) {
      this.spawnTimers.baygon = 0;
      this.spawnBygoneCloud();
    }

    // 3. Torch Sweep (Light spotlight hazard)
    this.spawnTimers.torch += dt;
    const torchInterval = 12.0;
    if (this.spawnTimers.torch >= torchInterval) {
      this.spawnTimers.torch = 0;
      this.spawnTorchSweep();
    }

    // 4. Collectibles
    this.spawnTimers.collectible += dt;
    const activeCount = this.collectibles.length;
    
    if (activeCount >= 12) {
      // Hard cap pause
      this.spawnTimers.collectible = 0;
    } else {
      const currentInterval = 0.5 + (activeCount / 12) * (3.0 - 0.5);
      if (this.spawnTimers.collectible >= currentInterval) {
        this.spawnTimers.collectible = 0;
        this.spawnCollectible();
      }
    }

    // Forced ally spawn every 10 seconds (outside viewport and a bit far).
    this.spawnTimers.allyForced += dt;
    if (this.spawnTimers.allyForced >= 10.0) {
      this.spawnTimers.allyForced = 0;
      this.spawnAllyOutsideViewport();
    }

  }

  // Chappal: spawns off-screen, flies diagonally across player coordinates
  spawnChappal() {
    // 20% chance: spawn from the front (where cockroach is headed).
    const fromFront = Math.random() < 0.2;
    const dist = 750;
    let sx;
    let sy;

    if (fromFront) {
      const frontAngle = this.player.angle + (Math.random() * 0.5 - 0.25);
      sx = this.player.x + Math.cos(frontAngle) * dist;
      sy = this.player.y + Math.sin(frontAngle) * dist;
    } else {
      const angle = Math.random() * Math.PI * 2;
      sx = this.player.x + Math.cos(angle) * dist;
      sy = this.player.y + Math.sin(angle) * dist;
    }

    // Direct trajectory towards player with slight inaccuracy
    const targetAngle = Math.atan2(this.player.y - sy, this.player.x - sx) + (Math.random() * 0.3 - 0.15);
    const speed = (7.5 + (this.survivalTime * 0.08)) * 0.7; // 30% slower

    this.hazards.push({
      type: 'chappal',
      x: sx,
      y: sy,
      vx: Math.cos(targetAngle) * speed,
      vy: Math.sin(targetAngle) * speed,
      radius: 40, // large hit box
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() > 0.5 ? 0.05 : -0.05),
      width: 70,
      height: 100
    });
  }

  // Bygone Cloud: spawns randomly ahead of player or close by
  spawnBygoneCloud() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 300;
    const cx = this.player.x + Math.cos(angle) * dist;
    const cy = this.player.y + Math.sin(angle) * dist;

    this.hazards.push({
      type: 'bygone',
      x: cx,
      y: cy,
      radius: 540, // 100% increase (was 270)
      life: 6.0, // seconds
      maxLife: 6.0,
      damageTimer: 0 // logic for ticking damage
    });
  }

  // Torch sweep spotlight
  spawnTorchSweep() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 900;
    const sx = this.player.x + Math.cos(angle) * dist;
    const sy = this.player.y + Math.sin(angle) * dist;

    this.hazards.push({
      type: 'torch',
      x: sx,
      y: sy,
      targetX: this.player.x,
      targetY: this.player.y,
      radius: 120, // large spotlight
      life: 8.0,
      maxLife: 8.0,
      speed: 3.2
    });
  }

  // Collectible item spawn
  spawnCollectible() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 180 + Math.random() * 620;
    const rx = this.player.x + Math.cos(angle) * dist;
    const ry = this.player.y + Math.sin(angle) * dist;

    const r = Math.random();

    if (r < 0.40) {
      // Coin spawn — group system (80/15/5 split)
      this.spawnCoinGroup(rx, ry);
      return;
    }

    let type;
    if (r < 0.70)      type = 'crumb';   // 30%
    else if (r < 0.80) type = 'shield';  // 10%
    else if (r < 0.90) type = 'speed';   // 10%
    else               type = 'ally';    // 10%

    this.collectibles.push({
      type,
      x: rx,
      y: ry,
      radius: 14,
      bounce: 0,
      bounceSpeed: 0.05 + Math.random() * 0.03,
      guideTime: type === 'ally' ? 5.0 : 0,
      lifespan: 12.0,
      roamAngle: Math.random() * Math.PI * 2,
      roamTurn: (Math.random() * 0.08) - 0.04,
      roamSpeed: 0.08 + Math.random() * 0.08
    });
  }

  spawnCoinGroup(cx, cy) {
    const roll = Math.random();
    let offsets = [];

    if (roll < 0.20) {
      // 20% — 5 coins tight ring, 12–26px from center
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
        const d = 12 + Math.random() * 14; // 12–26px
        offsets.push({ x: Math.cos(a) * d, y: Math.sin(a) * d });
      }
    } else if (roll < 0.50) {
      // 30% — 2 coins side by side, 20px apart
      const a = Math.random() * Math.PI * 2;
      offsets.push({ x:  Math.cos(a) * 20, y:  Math.sin(a) * 20 });
      offsets.push({ x: -Math.cos(a) * 20, y: -Math.sin(a) * 20 });
    } else {
      // 50% — single coin
      offsets.push({ x: 0, y: 0 });
    }

    offsets.forEach(off => {
      this.collectibles.push({
        type: 'coin',
        x: cx + off.x,
        y: cy + off.y,
        radius: 10,
        bounce: 0,
        bounceSpeed: 0.05 + Math.random() * 0.03,
        guideTime: 0,
        lifespan: 12.0,
        roamAngle: Math.random() * Math.PI * 2,
        roamTurn: (Math.random() * 0.08) - 0.04,
        roamSpeed: 0.08 + Math.random() * 0.08
      });
    });
  }

  spawnAllyOutsideViewport() {
    if (!this.canvas) return;
    const camX = this.player.x - this.canvas.width / 2;
    const camY = this.player.y - this.canvas.height / 2;
    const margin = 140;
    const side = Math.floor(Math.random() * 4); // 0 left,1 right,2 top,3 bottom
    let x = 0;
    let y = 0;

    if (side === 0) {
      x = camX - margin;
      y = camY + Math.random() * this.canvas.height;
    } else if (side === 1) {
      x = camX + this.canvas.width + margin;
      y = camY + Math.random() * this.canvas.height;
    } else if (side === 2) {
      x = camX + Math.random() * this.canvas.width;
      y = camY - margin;
    } else {
      x = camX + Math.random() * this.canvas.width;
      y = camY + this.canvas.height + margin;
    }

    this.collectibles.push({
      type: 'ally',
      x, y,
      radius: 14,
      bounce: 0,
      bounceSpeed: 0.05 + Math.random() * 0.03,
      guideTime: 5.0,
      lifespan: 12.0,
      roamAngle: Math.random() * Math.PI * 2,
      roamTurn: (Math.random() * 0.08) - 0.04,
      roamSpeed: 0.08 + Math.random() * 0.08
    });
  }

  // Update flying chappals, clouds, spotlights
  updateHazards(dt) {
    this.player.isSlowed = false;

    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];

      if (h.type === 'chappal') {
        h.x += h.vx;
        h.y += h.vy;
        h.rotation += h.rotSpeed;

        // Collision check
        const dist = Math.hypot(this.player.x - h.x, this.player.y - h.y);
        if (dist < this.player.radius + h.radius) {
          this.triggerDamage('chappal');
          // Remove shoe on hit
          this.hazards.splice(i, 1);
          continue;
        }

        // Out of bounds cleanup (ensure offscreen safety margins)
        if (Math.hypot(h.x - this.player.x, h.y - this.player.y) > 2600) {
          this.hazards.splice(i, 1);
        }
      }

      else if (h.type === 'bygone') {
        h.life -= dt;
        if (h.life <= 0) {
          this.hazards.splice(i, 1);
          continue;
        }

        // Overlap check for damage ticks
        const dist = Math.hypot(this.player.x - h.x, this.player.y - h.y);
        if (dist < this.player.radius + h.radius) {
          h.damageTimer += dt;
          if (h.damageTimer >= 0.8) { // tick damage every 0.8 seconds inside gas
            h.damageTimer = 0;
            this.triggerDamage('bygone');
          }
        }
      }

      else if (h.type === 'torch') {
        h.life -= dt;
        if (h.life <= 0) {
          this.hazards.splice(i, 1);
          continue;
        }

        // Sweeping algorithm: slowly moves towards player position
        const dx = this.player.x - h.x;
        const dy = this.player.y - h.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 10) {
          h.x += (dx / dist) * h.speed;
          h.y += (dy / dist) * h.speed;
        }

        // Spotting check: trigger chappal burst, no speed slowdown.
        if (dist < h.radius) {
          if (this.torchBurstCooldown <= 0) {
            this.torchBurstCooldown = 1.2;
            this.spawnChappal();
            this.spawnChappal();
            this.spawnChappal();
          }
        }
      }
    }

  }

  // Update item pickups
  updateCollectibles(dt) {
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.bounce += c.bounceSpeed;
      
      // Lifespan Decay (Auto-Clearing)
      if (c.lifespan !== undefined) {
        c.lifespan -= dt;
        if (c.lifespan <= 0) {
          this.collectibles.splice(i, 1);
          // Apply decay penalty
          this.money = Math.max(-5.00, this.money - 0.10);
          this.spawnParticles(c.x, c.y, '#9ca3af', 8); // Decay dust
          this.updateHUD(); // Show updated money
          continue;
        }
      }

      if (c.type === 'ally') {
        c.guideTime = Math.max(0, (c.guideTime || 0) - dt);
        c.roamAngle += c.roamTurn * dt * 60;
        c.roamTurn += (Math.random() * 0.002 - 0.001);
        c.roamTurn = Math.max(-0.04, Math.min(0.04, c.roamTurn));
        c.x += Math.cos(c.roamAngle) * c.roamSpeed;
        c.y += Math.sin(c.roamAngle) * c.roamSpeed;
      }

      // Check collision
      const dist = Math.hypot(this.player.x - c.x, this.player.y - c.y);
      if (dist < this.player.radius + c.radius) {
        // Collect sound
        if (window.audio) window.audio.playChime();

        if (c.type === 'crumb') {
          // Add life or score
          if (this.player.lives < this.player.maxLives) {
            this.player.lives++;
          } else {
          }
          this.spawnParticles(c.x, c.y, '#f59e0b', 8);
        }

        else if (c.type === 'coin') {
          // Add rupees
          this.addMoney(1.00);
          this.spawnParticles(c.x, c.y, '#fbbf24', 10);
        }

        else if (c.type === 'shield') {
          this.player.shieldTime = 5.0; // 5 seconds
          this.spawnParticles(c.x, c.y, '#fbbf24', 12);
        }

        else if (c.type === 'speed') {
          this.player.speedBoostTime = 3.0; // 3 seconds
          this.spawnParticles(c.x, c.y, '#f97316', 10);
        }
        else if (c.type === 'ally') {
          this.allies.push({
            x: this.player.x - 24,
            y: this.player.y + 16,
            angle: this.player.angle
          });
          this.spawnParticles(c.x, c.y, '#facc15', 8);
        }

        this.updateHUD();
        this.collectibles.splice(i, 1);
      }
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Ally follow behavior (group formation toward cursor direction)
    for (let i = 0; i < this.allies.length; i++) {
      const ally = this.allies[i];

      // Build ring-like slots around player while all allies face cursor direction.
      const ringIndex = Math.floor(i / 6);
      const inRing = i % 6;
      const ringCount = Math.min(6, this.allies.length - ringIndex * 6);
      const baseDir = this.player.angle;
      const t = ringCount <= 1 ? 0 : (inRing / ringCount);
      const slotAngle = (Math.PI * 2 * t) + (ringIndex % 2 === 0 ? 0 : Math.PI / ringCount);
      const radius = 44 + ringIndex * 24; // ring around player
      const targetX = this.player.x + Math.cos(slotAngle) * radius;
      const targetY = this.player.y + Math.sin(slotAngle) * radius;

      ally.x += (targetX - ally.x) * 0.14;
      ally.y += (targetY - ally.y) * 0.14;

      // Force all allies to face the same direction as the main roach/cursor heading.
      let d = baseDir - ally.angle;
      while (d < -Math.PI) d += Math.PI * 2;
      while (d > Math.PI) d -= Math.PI * 2;
      ally.angle += d * 0.28;
    }

    // Hard non-overlap constraints: ally vs player + ally vs ally.
    const minPlayerDist = this.player.radius + 18;
    for (let i = 0; i < this.allies.length; i++) {
      const a = this.allies[i];
      let dx = a.x - this.player.x;
      let dy = a.y - this.player.y;
      let d = Math.hypot(dx, dy) || 0.0001;
      if (d < minPlayerDist) {
        const push = (minPlayerDist - d);
        a.x += (dx / d) * push;
        a.y += (dy / d) * push;
      }
    }

    const minAllyDist = 32;
    for (let i = 0; i < this.allies.length; i++) {
      for (let j = i + 1; j < this.allies.length; j++) {
        const a = this.allies[i];
        const b = this.allies[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy) || 0.0001;
        if (d < minAllyDist) {
          const push = (minAllyDist - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }

    // Dead ally flip animation
    for (let i = this.deadAllies.length - 1; i >= 0; i--) {
      const d = this.deadAllies[i];
      d.life -= dt;
      d.angle += 0.22;
      d.y += d.vy;
      d.vy += 0.02;
      if (d.life <= 0) this.deadAllies.splice(i, 1);
    }
  }

  // --- Drawing functions ---
  draw() {
    if (!this.ctx) return;

    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    const zoom = isMobileViewport ? 0.55 : 1.0;
    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;
    const vWidth = cssWidth / zoom;
    const vHeight = cssHeight / zoom;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, cssWidth, cssHeight);

    this.ctx.save();
    this.ctx.scale(zoom, zoom);

    // Cam focus: player stays in middle of screen
    const camX = this.player.x - vWidth / 2;
    const camY = this.player.y - vHeight / 2;

    // Translate renderer backwards so world content moves opposite player
    this.ctx.translate(-camX, -camY);

    // 1. Draw floor tiles background (camera-relative infinite grid)
    this.drawKitchenFloor(camX, camY, vWidth, vHeight);

    // 2. Draw grease stains
    this.greaseStains.forEach(s => {
      this.ctx.fillStyle = s.color;
      this.ctx.globalAlpha = s.opacity;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1.0; // reset

    // 3. Draw Collectibles
    this.drawCollectibles();
    this.drawAllyGuideArrow();

    // 4. Draw Particles
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1.0;

    // 5. Draw Player (Cockroach)
    this.drawCockroach();
    this.drawAllies();

    // 6. Draw Hazards (overlay details like Aerosol and shoe)
    this.drawHazards();

    this.ctx.restore();
  }

  drawKitchenFloor(camX, camY, vWidth = this.canvas.width, vHeight = this.canvas.height) {
    const tileSize = 120;
    const pad = tileSize * 2;
    const left = camX - pad;
    const right = camX + vWidth + pad;
    const top = camY - pad;
    const bottom = camY + vHeight + pad;

    // Fill only the visible region (+padding), not an ever-growing world.
    this.ctx.fillStyle = '#292524';
    this.ctx.fillRect(left, top, right - left, bottom - top);

    // Grid tile lines
    this.ctx.strokeStyle = '#44403c'; // mortar lines
    this.ctx.lineWidth = 2;

    const startX = Math.floor(left / tileSize) * tileSize;
    const endX = Math.ceil(right / tileSize) * tileSize;
    const startY = Math.floor(top / tileSize) * tileSize;
    const endY = Math.ceil(bottom / tileSize) * tileSize;

    for (let x = startX; x <= endX; x += tileSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
      this.ctx.stroke();
    }

    for (let y = startY; y <= endY; y += tileSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
      this.ctx.stroke();
    }
  }

  drawCockroach() {
    const p = this.player;
    this.ctx.save();
    this.ctx.translate(p.x, p.y);
    this.ctx.rotate(p.angle);

    // Invincible gold shield ring
    if (p.shieldTime > 0) {
      this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.radius + 12 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Keep visuals unchanged during speed boost (mechanic still applies).

    // --- Procedural Cockroach Anatomy ---

    // 1. Antennas (sweeping wires out of head)
    this.ctx.strokeStyle = '#543d2b';
    this.ctx.lineWidth = 1.5;
    const antennaSwing = Math.sin(Date.now() * 0.01) * 0.15;

    // Left antenna
    this.ctx.beginPath();
    this.ctx.moveTo(18, -4);
    this.ctx.quadraticCurveTo(35, -20 + (antennaSwing * 40), 45, -30 + (antennaSwing * 20));
    this.ctx.stroke();

    // Right antenna
    this.ctx.beginPath();
    this.ctx.moveTo(18, 4);
    this.ctx.quadraticCurveTo(35, 20 - (antennaSwing * 40), 45, 30 - (antennaSwing * 20));
    this.ctx.stroke();

    // 2. Legs (Skitter oscillation animations)
    this.ctx.strokeStyle = '#402e20';
    this.ctx.lineWidth = 3.5;
    const legCycle = isNaN(p.speed) || p.speed < 0.2 ? 0 : Math.sin(Date.now() * 0.035 * p.speed);

    // Draw 3 legs on each side
    const legOffsets = [-8, 0, 8];
    legOffsets.forEach((offsetY, idx) => {
      const direction = idx % 2 === 0 ? 1 : -1;
      const swingVal = legCycle * 10 * direction;

      // Left leg
      this.ctx.beginPath();
      this.ctx.moveTo(offsetY, -6);
      this.ctx.lineTo(offsetY - 5 + swingVal, -22);
      this.ctx.lineTo(offsetY - 12 + swingVal, -28);
      this.ctx.stroke();

      // Right leg
      this.ctx.beginPath();
      this.ctx.moveTo(offsetY, 6);
      this.ctx.lineTo(offsetY - 5 - swingVal, 22);
      this.ctx.lineTo(offsetY - 12 - swingVal, 28);
      this.ctx.stroke();
    });

    // 3. Body base (dark brown oval)
    this.ctx.fillStyle = '#452a17';
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // 4. Thorax shield & head (slightly lighter shell)
    this.ctx.fillStyle = '#653f22';
    this.ctx.beginPath();
    this.ctx.ellipse(12, 0, 8, 9, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Small head cap
    this.ctx.fillStyle = '#301c0e';
    this.ctx.beginPath();
    this.ctx.arc(18, 0, 5, 0, Math.PI * 2);
    this.ctx.fill();

    // Shiny back shell line (wing separator)
    this.ctx.strokeStyle = '#27160a';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(-22, 0);
    this.ctx.lineTo(8, 0);
    this.ctx.stroke();

    // Tiny shiny highlights on carapace
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.beginPath();
    this.ctx.ellipse(8, -4, 4, 2, Math.PI / 4, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  drawAllies() {
    this.allies.forEach(a => {
      this.ctx.save();
      this.ctx.translate(a.x, a.y);
      this.ctx.rotate(a.angle);
      this.ctx.scale(0.82, 0.82);
      this.drawRoachBody();
      this.ctx.restore();
    });

    this.deadAllies.forEach(d => {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, d.life / 0.7);
      this.ctx.translate(d.x, d.y);
      this.ctx.rotate(d.angle);
      this.ctx.scale(0.78, -0.78); // flipped dead pose
      this.drawRoachBody(true);
      this.ctx.restore();
      this.ctx.globalAlpha = 1;
    });
  }

  drawRoachBody(isDead = false) {
    this.ctx.strokeStyle = isDead ? '#5b4636' : '#543d2b';
    this.ctx.lineWidth = 1.5;
    const antennaSwing = isDead ? 0 : Math.sin(Date.now() * 0.01) * 0.15;
    this.ctx.beginPath();
    this.ctx.moveTo(18, -4);
    this.ctx.quadraticCurveTo(35, -20 + (antennaSwing * 40), 45, -30 + (antennaSwing * 20));
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(18, 4);
    this.ctx.quadraticCurveTo(35, 20 - (antennaSwing * 40), 45, 30 - (antennaSwing * 20));
    this.ctx.stroke();

    this.ctx.strokeStyle = isDead ? '#4a3727' : '#402e20';
    this.ctx.lineWidth = 3.5;
    const legCycle = isDead ? 0 : Math.sin(Date.now() * 0.03);
    const legOffsets = [-8, 0, 8];
    legOffsets.forEach((offsetY, idx) => {
      const direction = idx % 2 === 0 ? 1 : -1;
      const swingVal = legCycle * 10 * direction;
      this.ctx.beginPath();
      this.ctx.moveTo(offsetY, -6);
      this.ctx.lineTo(offsetY - 5 + swingVal, -22);
      this.ctx.lineTo(offsetY - 12 + swingVal, -28);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(offsetY, 6);
      this.ctx.lineTo(offsetY - 5 - swingVal, 22);
      this.ctx.lineTo(offsetY - 12 - swingVal, 28);
      this.ctx.stroke();
    });

    this.ctx.fillStyle = isDead ? '#3b2b1d' : '#452a17';
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = isDead ? '#4b331f' : '#653f22';
    this.ctx.beginPath();
    this.ctx.ellipse(12, 0, 8, 9, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#301c0e';
    this.ctx.beginPath();
    this.ctx.arc(18, 0, 5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawCollectibles() {
    const useHeavyEffects = !this.mobileQualityMode;

    this.collectibles.forEach((c, index) => {
      const hoverOffset = Math.sin(Date.now() * 0.005 + c.bounce) * 3;

      this.ctx.save();
      this.ctx.translate(c.x, c.y + hoverOffset);

      if (useHeavyEffects) {
        const glowPulse = 0.6 + Math.sin(Date.now() * 0.006 + c.bounce) * 0.4;
        const universalGlow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
        universalGlow.addColorStop(0, 'rgba(255, 215, 0, 0.7)');
        universalGlow.addColorStop(0.5, 'rgba(255, 193, 7, 0.3)');
        universalGlow.addColorStop(1, 'rgba(255, 215, 0, 0)');

        this.ctx.globalAlpha = glowPulse;
        this.ctx.fillStyle = universalGlow;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 26, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
      }

      if (c.type === 'crumb') {
        // Bread emoji
        this.ctx.font = 'bold 28px "Noto Emoji", "Segoe UI Emoji", Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('\u{1F35E}', 0, 0);
      }

      else if (c.type === 'coin') {
        // Shiny coin body
        this.ctx.fillStyle = '#ffd700';
        this.ctx.strokeStyle = '#b8860b';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 11, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Inner highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        this.ctx.beginPath();
        this.ctx.ellipse(-3, -3, 5, 3, Math.PI / 4, 0, Math.PI * 2);
        this.ctx.fill();

        // ₹ symbol
        this.ctx.fillStyle = '#7c5e00';
        this.ctx.font = 'bold 12px "Arial"';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('₹', 0, 1);
      }

      else if (c.type === 'shield') {
        // Gold grease shield jar
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        // Draw a shield outline shape
        this.ctx.moveTo(0, -c.radius);
        this.ctx.lineTo(c.radius, -c.radius / 2);
        this.ctx.lineTo(c.radius / 1.5, c.radius / 2);
        this.ctx.lineTo(0, c.radius);
        this.ctx.lineTo(-c.radius / 1.5, c.radius / 2);
        this.ctx.lineTo(-c.radius, -c.radius / 2);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }

      else if (c.type === 'speed') {
        // Red speed boot/lightning shape
        this.ctx.fillStyle = '#ef4444';
        this.ctx.strokeStyle = '#b91c1c';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -c.radius);
        this.ctx.lineTo(c.radius / 2, -c.radius / 4);
        this.ctx.lineTo(-c.radius / 3, 0);
        this.ctx.lineTo(c.radius / 3, c.radius);
        this.ctx.lineTo(-c.radius / 2, c.radius / 4);
        this.ctx.lineTo(c.radius / 3, 0);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }

      else if (c.type === 'ally') {
        // Mini ally cockroach pickup marker
        this.ctx.rotate(c.roamAngle || 0);
        this.ctx.scale(1, 1);
        this.drawRoachBody();

        // Recruitment ring to make it discoverable
        this.ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 20, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.restore();
    });
  }

  drawAllyGuideArrow() {
    let target = null;
    let bestDist = Infinity;
    for (const c of this.collectibles) {
      if (c.type !== 'ally' || (c.guideTime || 0) <= 0) continue;
      const d = Math.hypot(c.x - this.player.x, c.y - this.player.y);
      if (d < bestDist) {
        bestDist = d;
        target = c;
      }
    }
    if (!target) return;

    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const ang = Math.atan2(dy, dx);
    const startDist = 28;
    const len = 48;
    const sx = this.player.x + Math.cos(ang) * startDist;
    const sy = this.player.y + Math.sin(ang) * startDist;
    const ex = sx + Math.cos(ang) * len;
    const ey = sy + Math.sin(ang) * len;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(sx, sy);
    this.ctx.lineTo(ex, ey);
    this.ctx.stroke();

    // Arrow head
    this.ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
    this.ctx.beginPath();
    this.ctx.moveTo(ex, ey);
    this.ctx.lineTo(ex - Math.cos(ang - 0.55) * 14, ey - Math.sin(ang - 0.55) * 14);
    this.ctx.lineTo(ex - Math.cos(ang + 0.55) * 14, ey - Math.sin(ang + 0.55) * 14);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  drawHazards() {
    const useHeavyEffects = !this.mobileQualityMode;

    this.hazards.forEach(h => {
      if (h.type === 'chappal') {
        this.ctx.save();
        this.ctx.translate(h.x, h.y);
        this.ctx.rotate(h.rotation);

        // Shadow under chappal
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        this.ctx.beginPath();
        this.ctx.ellipse(-10, 15, h.width / 2, h.height / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Chappal sole (brown leather base, red rubber strap)
        this.ctx.fillStyle = '#854d0e'; // brown base
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, h.width / 2, h.height / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Strap (red hazard strap)
        this.ctx.strokeStyle = '#dc2626';
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.moveTo(-h.width / 3, -h.height / 4);
        this.ctx.quadraticCurveTo(0, -h.height / 8, 0, -h.height / 2.5);
        this.ctx.moveTo(h.width / 3, -h.height / 4);
        this.ctx.quadraticCurveTo(0, -h.height / 8, 0, -h.height / 2.5);
        this.ctx.stroke();

        this.ctx.restore();
      }

      else if (h.type === 'bygone') {
        const intensity = h.life > 1.0 ? 0.38 : (h.life / 1.0) * 0.38;

        if (useHeavyEffects) {
          const radGrd = this.ctx.createRadialGradient(h.x, h.y, 10, h.x, h.y, h.radius);
          radGrd.addColorStop(0, `rgba(34, 197, 94, ${intensity})`);
          radGrd.addColorStop(0.5, `rgba(34, 197, 94, ${intensity * 0.5})`);
          radGrd.addColorStop(1, 'rgba(34, 197, 94, 0)');

          this.ctx.fillStyle = radGrd;
          this.ctx.beginPath();
          this.ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
          this.ctx.fill();
        } else {
          this.ctx.fillStyle = `rgba(34, 197, 94, ${intensity * 0.4})`;
          this.ctx.beginPath();
          this.ctx.arc(h.x, h.y, h.radius * 0.5, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      else if (h.type === 'torch') {
        this.ctx.save();

        if (useHeavyEffects) {
          const glow = this.ctx.createRadialGradient(h.x, h.y, h.radius * 0.2, h.x, h.y, h.radius);
          const torchAlpha = 0.32 + Math.sin(Date.now() * 0.015) * 0.08;
          glow.addColorStop(0, `rgba(253, 224, 71, ${torchAlpha})`);
          glow.addColorStop(0.7, `rgba(253, 224, 71, ${torchAlpha * 0.3})`);
          glow.addColorStop(1, 'rgba(253, 224, 71, 0)');

          this.ctx.fillStyle = glow;
          this.ctx.beginPath();
          this.ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.strokeStyle = 'rgba(253, 224, 71, 0.4)';
          this.ctx.lineWidth = 1.5;
          this.ctx.setLineDash([8, 6]);
          this.ctx.beginPath();
          this.ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
        } else {
          this.ctx.fillStyle = 'rgba(253, 224, 71, 0.16)';
          this.ctx.beginPath();
          this.ctx.arc(h.x, h.y, h.radius * 0.55, 0, Math.PI * 2);
          this.ctx.fill();
        }

        this.ctx.restore();
      }
    });

  }
}

// Instantiate engine globally
const gameEngine = new GameEngine();
window.gameEngine = gameEngine;

