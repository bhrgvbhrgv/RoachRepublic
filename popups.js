(function () {
  class PopupManager {
    constructor() {
      this.anchor = document.getElementById('popup-anchor');
      this.active = false;
      this.spawnTimer = null;
      this.popups = [];
      this.maxVisible = 3;
      this.minSpawnDelay = 4000;
      this.maxSpawnDelay = 8000;
    }

    startSpawning() {
      this.active = true;
      this.scheduleNextSpawn();
    }

    stopSpawning() {
      this.active = false;
      this.clearSpawnTimer();
    }

    clearAll() {
      this.active = false;
      this.clearSpawnTimer();
      this.popups.forEach((entry) => this.removeEntry(entry));
      this.popups = [];
    }

    scheduleNextSpawn() {
      this.clearSpawnTimer();
      if (!this.active || !this.anchor) return;

      if (this.popups.length >= this.maxVisible) {
        this.spawnTimer = window.setTimeout(() => this.scheduleNextSpawn(), 1500);
        return;
      }

      const delay = this.minSpawnDelay + Math.random() * (this.maxSpawnDelay - this.minSpawnDelay);
      this.spawnTimer = window.setTimeout(() => {
        this.spawnTimer = null;
        if (!this.active) return;
        this.spawnPopup();
        if (this.active) this.scheduleNextSpawn();
      }, delay);
    }

    clearSpawnTimer() {
      if (this.spawnTimer) {
        window.clearTimeout(this.spawnTimer);
        this.spawnTimer = null;
      }
    }

    spawnPopup() {
      if (!this.anchor || this.popups.length >= this.maxVisible) return;

      const popup = document.createElement('div');
      popup.className = 'absolute w-[min(240px,calc(100vw-2rem))] max-w-[240px] pointer-events-auto bg-[#f4ecd8] border-4 border-stone-800 text-stone-900 rounded-xl shadow-2xl p-3 z-20 popup-shake';
      popup.style.left = '50%';
      popup.style.top = '50%';
      popup.style.transform = 'translate(-50%, -50%)';

      const position = this.getSafePosition();
      popup.style.left = `${position.x}%`;
      popup.style.top = `${position.y}%`;

      const id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : `popup-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      popup.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-elite text-[10px] uppercase tracking-[0.2em] text-red-700">Form 17-C</p>
            <p class="font-mono text-[9px] text-stone-700 mt-1">Bureaucratic paperwork detected.</p>
          </div>
          <button class="popup-close text-[10px] font-bold text-stone-700 hover:text-red-700" aria-label="Dismiss popup">✕</button>
        </div>
        <div class="mt-2 border-t border-stone-400 pt-2">
          <p class="font-mono text-[9px] leading-relaxed text-stone-700">
            Clear this notice quickly to avoid the audit penalty.
          </p>
        </div>
      `;

      const closeButton = popup.querySelector('.popup-close');
      if (closeButton) {
        closeButton.addEventListener('click', (event) => {
          event.stopPropagation();
          this.resolvePopup(id, 'closed');
        });
      }

      popup.addEventListener('click', (event) => {
        if (event.target.closest('.popup-close')) return;
        this.resolvePopup(id, 'closed');
      });

      this.anchor.appendChild(popup);

      const entry = {
        id,
        popup,
        timeout: window.setTimeout(() => this.resolvePopup(id, 'expired'), 5000)
      };
      this.popups.push(entry);
    }

    getSafePosition() {
      const width = this.anchor ? this.anchor.clientWidth || window.innerWidth : window.innerWidth;
      const height = this.anchor ? this.anchor.clientHeight || window.innerHeight : window.innerHeight;
      const joystick = document.getElementById('joystick-container');
      const usesJoystick = joystick && !joystick.classList.contains('hidden');

      const safeZone = usesJoystick
        ? { xMin: 0.06, xMax: 0.78, yMin: 0.62, yMax: 0.92 }
        : null;

      let x = 20 + Math.random() * 60;
      let y = 20 + Math.random() * 60;

      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (!safeZone || !this.inSafeZone(x, y, safeZone)) break;
        x = 18 + Math.random() * 64;
        y = 18 + Math.random() * 64;
      }

      return {
        x: Math.max(12, Math.min(88, x)),
        y: Math.max(14, Math.min(86, y))
      };
    }

    inSafeZone(xPercent, yPercent, safeZone) {
      return xPercent >= safeZone.xMin * 100
        && xPercent <= safeZone.xMax * 100
        && yPercent >= safeZone.yMin * 100
        && yPercent <= safeZone.yMax * 100;
    }

    resolvePopup(id, reason) {
      const entryIndex = this.popups.findIndex((entry) => entry.id === id);
      if (entryIndex < 0) return;

      const [entry] = this.popups.splice(entryIndex, 1);
      if (!entry) return;

      if (entry.timeout) {
        window.clearTimeout(entry.timeout);
      }

      if (entry.popup && entry.popup.isConnected) {
        entry.popup.classList.add('popup-shatter');
        entry.popup.addEventListener('animationend', () => entry.popup.remove(), { once: true });
      } else if (entry.popup) {
        entry.popup.remove();
      }

      if (reason === 'closed') {
        this.applyScoreDelta(25);
      } else if (reason === 'expired') {
        this.applyScoreDelta(-10);
      }

      this.scheduleNextSpawn();
    }

    applyScoreDelta(amount) {
      if (typeof window !== 'undefined' && window.gameEngine && typeof window.gameEngine.addMoney === 'function') {
        window.gameEngine.addMoney(amount);
      }
    }

    removeEntry(entry) {
      if (entry.timeout) window.clearTimeout(entry.timeout);
      if (entry.popup && entry.popup.isConnected) entry.popup.remove();
    }
  }

  window.popups = new PopupManager();
  window.PopupManager = PopupManager;
})();
