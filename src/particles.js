// Lexer - Canvas Particle Engine
// 6 presets: floating_dots, constellation, aurora, fireflies, rain, none
// 30fps cap, max 80 particles, auto-pause after 30s idle

class ParticleCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.preset = 'constellation';
    this.maxParticles = 60;
    this.opacity = 0.4;
    this.running = false;
    this.paused = false;
    this.frameInterval = 1000 / 30; // 30fps cap
    this.lastFrame = 0;
    this.idleTimer = null;
    this.idleTimeout = 30000; // 30s
    this.time = 0;

    // Colors from theme
    this.colors = ['88, 166, 255', '210, 168, 255', '126, 231, 135'];

    this._resize();
    this._bindEvents();
  }

  // --- Public API ---

  start(preset) {
    if (preset) this.preset = preset;
    if (this.preset === 'none') return;

    this.running = true;
    this.paused = false;
    this._spawnParticles();
    this._resetIdle();
    this._loop(performance.now());
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (!this.running) return;
    this.paused = false;
    this._loop(performance.now());
  }

  setPreset(preset) {
    this.preset = preset;
    this.particles = [];
    if (preset === 'none') {
      this.running = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    this._spawnParticles();
    if (!this.running) this.start(preset);
  }

  // --- Lifecycle ---

  _bindEvents() {
    window.addEventListener('resize', () => this._resize(), { passive: true });

    // Reset idle on user activity
    const resetIdle = () => this._resetIdle();
    document.addEventListener('scroll', resetIdle, { passive: true, capture: true });
    document.addEventListener('mousemove', resetIdle, { passive: true });

    // Pause when tab hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    });
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }

  _resetIdle() {
    if (this.paused) this.resume();
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.pause(), this.idleTimeout);
  }

  // --- Particle Management ---

  _spawnParticles() {
    this.particles = [];
    const count = Math.min(this.maxParticles, Math.floor(this.width * this.height / 15000));

    for (let i = 0; i < count; i++) {
      this.particles.push(this._createParticle());
    }
  }

  _createParticle() {
    const preset = this.preset;
    const base = {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      radius: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
      colorIdx: Math.floor(Math.random() * this.colors.length),
    };

    if (preset === 'floating_dots' || preset === 'constellation') {
      base.vx = (Math.random() - 0.5) * 0.3;
      base.vy = (Math.random() - 0.5) * 0.3;
    } else if (preset === 'fireflies') {
      base.vx = (Math.random() - 0.5) * 0.15;
      base.vy = (Math.random() - 0.5) * 0.15;
      base.phase = Math.random() * Math.PI * 2;
      base.pulseSpeed = 0.02 + Math.random() * 0.03;
      base.radius = Math.random() * 3 + 1;
    } else if (preset === 'rain') {
      base.x = Math.random() * this.width;
      base.y = Math.random() * this.height - this.height;
      base.vx = -0.3 - Math.random() * 0.2;
      base.vy = 4 + Math.random() * 4;
      base.length = 10 + Math.random() * 20;
      base.opacity = Math.random() * 0.15 + 0.05;
    } else if (preset === 'aurora') {
      base.y = 0;
      base.phase = Math.random() * Math.PI * 2;
      base.amplitude = 30 + Math.random() * 50;
      base.speed = 0.005 + Math.random() * 0.01;
      base.bandY = 0.2 + Math.random() * 0.4; // vertical position ratio
    }

    return base;
  }

  // --- Render Loop ---

  _loop(timestamp) {
    if (!this.running || this.paused) return;

    const elapsed = timestamp - this.lastFrame;
    if (elapsed >= this.frameInterval) {
      this.lastFrame = timestamp - (elapsed % this.frameInterval);
      this.time += 0.016; // ~60fps normalized time
      this._update();
      this._draw();
    }

    requestAnimationFrame((ts) => this._loop(ts));
  }

  _update() {
    const w = this.width;
    const h = this.height;
    const preset = this.preset;

    for (const p of this.particles) {
      if (preset === 'floating_dots' || preset === 'constellation') {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
      } else if (preset === 'fireflies') {
        p.x += p.vx;
        p.y += p.vy;
        p.phase += p.pulseSpeed;
        p.opacity = 0.1 + Math.abs(Math.sin(p.phase)) * 0.5;
        // Gentle drift change
        p.vx += (Math.random() - 0.5) * 0.02;
        p.vy += (Math.random() - 0.5) * 0.02;
        p.vx = Math.max(-0.4, Math.min(0.4, p.vx));
        p.vy = Math.max(-0.4, Math.min(0.4, p.vy));
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
      } else if (preset === 'rain') {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > h) {
          p.y = -p.length;
          p.x = Math.random() * w;
        }
      } else if (preset === 'aurora') {
        p.phase += p.speed;
      }
    }
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = this.opacity;

    const preset = this.preset;

    if (preset === 'floating_dots') {
      this._drawDots();
    } else if (preset === 'constellation') {
      this._drawConstellation();
    } else if (preset === 'aurora') {
      this._drawAurora();
    } else if (preset === 'fireflies') {
      this._drawFireflies();
    } else if (preset === 'rain') {
      this._drawRain();
    }

    ctx.globalAlpha = 1;
  }

  // --- Preset Renderers ---

  _drawDots() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.colors[p.colorIdx]}, ${p.opacity})`;
      ctx.fill();
    }
  }

  _drawConstellation() {
    const ctx = this.ctx;
    const maxDist = 120;

    // Draw connections first (behind dots)
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      for (let j = i + 1; j < this.particles.length; j++) {
        const q = this.particles[j];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < maxDist) {
          const lineOpacity = 0.08 * (1 - d / maxDist);
          ctx.strokeStyle = `rgba(${this.colors[p.colorIdx]}, ${lineOpacity})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }

    // Draw dots
    this._drawDots();
  }

  _drawAurora() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    for (const p of this.particles) {
      const baseY = p.bandY * h;
      ctx.beginPath();
      ctx.moveTo(0, baseY);

      for (let x = 0; x <= w; x += 4) {
        const y = baseY + Math.sin(x * 0.005 + p.phase) * p.amplitude
                       + Math.sin(x * 0.002 + p.phase * 0.7) * p.amplitude * 0.5;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, baseY - p.amplitude, 0, baseY + p.amplitude * 2);
      gradient.addColorStop(0, `rgba(${this.colors[p.colorIdx]}, 0)`);
      gradient.addColorStop(0.4, `rgba(${this.colors[p.colorIdx]}, 0.06)`);
      gradient.addColorStop(1, `rgba(${this.colors[p.colorIdx]}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  _drawFireflies() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4);
      glow.addColorStop(0, `rgba(${this.colors[p.colorIdx]}, ${p.opacity})`);
      glow.addColorStop(1, `rgba(${this.colors[p.colorIdx]}, 0)`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Bright center
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.8})`;
      ctx.fill();
    }
  }

  _drawRain() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.strokeStyle = `rgba(${this.colors[0]}, ${p.opacity})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 3, p.y + p.length);
      ctx.stroke();
    }
  }
}

// --- Bootstrap ---
const canvasEl = document.getElementById('particle-canvas');
if (canvasEl) {
  const particleEngine = new ParticleCanvas(canvasEl);
  particleEngine.start('constellation');
  window.lexerParticles = particleEngine;
}
