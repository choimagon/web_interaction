import WebGLFluid from './WebGLFluid.js';

const random = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function hueColor(hue, brightness = 0.26) {
  const h = ((hue % 360) + 360) % 360 / 60;
  const channel = (offset) => {
    const k = (offset + h) % 6;
    return brightness * (1 - 0.87 * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return [channel(5), channel(3), channel(1)];
}

// A soft textured fallback also works on devices without floating-point WebGL.
class CanvasSmoke {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.sprites = new Map();
    this.time = 0;
  }
  resize(width, height, dpr) {
    this.width = width; this.height = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sprite(color) {
    const rgb = color.map((channel) => Math.round(channel * 3 * 255 / 32) * 32);
    const key = rgb.join(',');
    if (this.sprites.has(key)) return this.sprites.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 160;
    const ctx = canvas.getContext('2d');
    for (let index = 0; index < 9; index++) {
      const x = index === 0 ? 80 : random(47, 113);
      const y = index === 0 ? 80 : random(47, 113);
      const radius = random(28, 47);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${rgb.join(',')},0.28)`);
      gradient.addColorStop(0.35, `rgba(${rgb.join(',')},0.13)`);
      gradient.addColorStop(1, `rgba(${rgb.join(',')},0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    if (this.sprites.size > 30) this.sprites.delete(this.sprites.keys().next().value);
    this.sprites.set(key, canvas);
    return canvas;
  }
  splat(x, y, dx, dy, color, size, boost = 1) {
    for (let index = 0; index < 3; index++) this.particles.push({
      x: x * this.width + random(-8, 8), y: (1 - y) * this.height + random(-8, 8),
      vx: dx * 0.0005 + random(-0.015, 0.015), vy: -dy * 0.0005 - random(0.008, 0.03),
      size: (35 + size * 0.75) * Math.sqrt(boost), born: this.time,
      phase: random(0, Math.PI * 2), rotation: random(-1, 1), sprite: this.sprite(color), life: random(4300, 6500),
    });
    this.particles = this.particles.slice(-280);
  }
  step(dt) { this.time += dt * 1000; }
  display() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = 'screen';
    this.particles = this.particles.filter((particle) => this.time - particle.born < particle.life);
    this.particles.forEach((particle) => {
      const age = this.time - particle.born;
      const progress = age / particle.life;
      const size = particle.size * (1 + progress * 2.8);
      ctx.save();
      ctx.globalAlpha = Math.min(1, age / 180) * Math.pow(1 - progress, 1.4) * 0.7;
      ctx.translate(particle.x + particle.vx * age + Math.sin(progress * 4 + particle.phase) * progress * 40, particle.y + particle.vy * age);
      ctx.rotate(particle.rotation + progress * 0.8);
      ctx.drawImage(particle.sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    });
    return this.canvas;
  }
  clear() { this.particles = []; }
  destroy() { this.particles = []; this.sprites.clear(); }
}

export default class SmokeEngine {
  constructor(canvas, cursor, onActivity) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cursor = cursor; this.onActivity = onActivity;
    this.palette = 'rainbow'; this.size = 60; this.auto = false;
    this.time = 0; this.lastFrame = 0; this.lastAuto = 0; this.lastAmbient = 0;
    this.hue = random(0, 360); this.hasInteracted = false; this.disposed = false;
    this.pointers = new Map(); this.hoverPoint = null; this.splats = []; this.listeners = [];
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      this.renderer = new WebGLFluid();
      this.canvas.dataset.renderer = 'webgl-fluid';
    } catch { this.fallback(); }
    this.listen(this.renderer.canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      this.renderer.destroy(); this.fallback();
      this.renderer.resize(this.width, this.height, this.dpr);
    });
    this.listen(window, 'resize', () => this.resize());
    this.listen(window, 'blur', () => this.releasePointers());
    this.bindInput();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    this.listen(canvas, 'keydown', (event) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        this.emit(random(this.width * 0.2, this.width * 0.8), random(this.height * 0.28, this.height * 0.65), true);
      }
    });
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(this.frame); this.releasePointers(); this.lastFrame = 0;
      } else if (!this.disposed) this.frame = requestAnimationFrame((time) => this.render(time));
    });
    this.resize(); this.seed();
    this.frame = requestAnimationFrame((time) => this.render(time));
  }
  fallback() { this.renderer = new CanvasSmoke(); this.canvas.dataset.renderer = 'canvas-smoke'; }
  listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.listeners.push(() => target.removeEventListener(event, handler, options));
  }
  bindInput() {
    const canvas = this.canvas;
    const leave = () => {
      this.hoverPoint = null;
      this.cursor.classList.remove('is-visible');
      if (!this.pointers.size) this.onActivity(false);
    };
    if (typeof window.PointerEvent !== 'undefined') {
      this.listen(canvas, 'pointerdown', (event) => this.pointerDown(event));
      this.listen(canvas, 'pointermove', (event) => this.pointerMove(event));
      this.listen(window, 'pointerup', (event) => this.pointerUp(event));
      this.listen(window, 'pointercancel', (event) => this.pointerUp(event));
      this.listen(canvas, 'lostpointercapture', (event) => this.pointerUp(event));
      this.listen(canvas, 'pointerenter', (event) => this.pointerEnter(event));
      this.listen(canvas, 'pointerleave', leave);
      return;
    }
    // Some embedded Tizen browsers expose only the older mouse/touch APIs.
    const mouse = (event) => ({
      pointerId: 1, pointerType: 'mouse', button: event.button,
      clientX: event.clientX, clientY: event.clientY,
      preventDefault: () => event.preventDefault(),
    });
    this.listen(canvas, 'mouseenter', (event) => this.pointerEnter(mouse(event)));
    this.listen(canvas, 'mouseleave', leave);
    this.listen(canvas, 'mousedown', (event) => this.pointerDown(mouse(event)));
    this.listen(canvas, 'mousemove', (event) => this.pointerMove(mouse(event)));
    this.listen(window, 'mousemove', (event) => {
      if (event.target !== canvas && this.pointers.has(1)) this.pointerMove(mouse(event));
    });
    this.listen(window, 'mouseup', (event) => this.pointerUp(mouse(event)));
    const touches = (handler) => (event) => {
      for (let index = 0; index < event.changedTouches.length; index++) {
        const touch = event.changedTouches[index];
        handler.call(this, {
          pointerId: touch.identifier + 2, pointerType: 'touch', button: 0,
          clientX: touch.clientX, clientY: touch.clientY,
          preventDefault: () => event.preventDefault(),
        });
      }
    };
    this.listen(canvas, 'touchstart', touches(this.pointerDown), { passive: false });
    this.listen(canvas, 'touchmove', (event) => {
      event.preventDefault();
      touches(this.pointerMove)(event);
    }, { passive: false });
    this.listen(window, 'touchend', touches(this.pointerUp));
    this.listen(window, 'touchcancel', touches(this.pointerUp));
  }
  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (width === this.width && height === this.height) return;
    this.width = width; this.height = height;
    // Drawing resolution is independent of the CSS interaction area. Capping
    // the backing buffer keeps large embedded displays within GPU limits.
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5, 1920 / width, 1080 / height);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    try { this.renderer.resize(width, height, this.dpr); }
    catch { this.renderer.destroy(); this.fallback(); this.renderer.resize(width, height, this.dpr); }
  }
  point(event) {
    const bounds = this.canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }
  moveCursor(event) {
    if (event.pointerType === 'touch') return;
    this.cursor.style.left = `${event.clientX}px`; this.cursor.style.top = `${event.clientY}px`;
    this.cursor.classList.add('is-visible');
  }
  pointerEnter(event) {
    this.moveCursor(event);
    if (event.pointerType !== 'mouse' || this.pointers.has(event.pointerId)) return;
    const point = this.point(event);
    this.hoverPoint = { ...point, emitted: this.time, held: this.time };
    this.onActivity(true);
    this.emit(point.x, point.y);
  }
  pointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    const point = this.point(event);
    this.hoverPoint = null;
    this.pointers.set(event.pointerId, { ...point, emitted: this.time, held: this.time });
    if (typeof window.PointerEvent !== 'undefined' && this.canvas.setPointerCapture) {
      try { this.canvas.setPointerCapture(event.pointerId); } catch { /* Embedded browsers may reject capture. */ }
    }
    this.moveCursor(event);
    this.cursor.classList.add('is-pressed'); this.onActivity(true);
    this.emit(point.x, point.y, true);
  }
  pointerMove(event) {
    this.moveCursor(event);
    const pressed = this.pointers.has(event.pointerId);
    const hovering = event.pointerType === 'mouse' && !pressed;
    if (hovering && !this.hoverPoint) {
      this.pointerEnter(event);
      return;
    }
    const previous = pressed ? this.pointers.get(event.pointerId) : hovering ? this.hoverPoint : null;
    if (!previous) return;
    const point = this.point(event);
    const dx = point.x - previous.x; const dy = point.y - previous.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 4 || this.time - previous.emitted < 22) return;
    const steps = Math.min(5, Math.ceil(distance / 18));
    for (let index = 1; index <= steps; index++) this.emit(previous.x + dx * index / steps, previous.y + dy * index / steps, false, dx / steps, dy / steps);
    const next = { ...point, emitted: this.time, held: this.time };
    if (pressed) this.pointers.set(event.pointerId, next);
    else this.hoverPoint = next;
  }
  pointerUp(event) {
    if (!this.pointers.delete(event.pointerId)) return;
    if (event.pointerType === 'mouse') {
      const point = this.point(event);
      if (point.x >= 0 && point.x <= this.width && point.y >= 0 && point.y <= this.height) {
        this.hoverPoint = { ...point, emitted: this.time, held: this.time };
      }
    }
    if (!this.pointers.size) { this.cursor.classList.remove('is-pressed'); this.onActivity(Boolean(this.hoverPoint)); }
    if (event.pointerType === 'touch') this.cursor.classList.remove('is-visible');
  }
  releasePointers() {
    this.pointers.clear(); this.hoverPoint = null;
    this.cursor.classList.remove('is-pressed', 'is-visible'); this.onActivity(false);
  }
  color() {
    this.hue = (this.hue + random(2, 7)) % 360;
    if (this.palette === 'rainbow') return hueColor(this.hue);
    const base = { aurora: 265, ocean: 175, sunset: 350 }[this.palette] ?? 265;
    return hueColor(base + Math.sin(this.time * 0.0018) * 27);
  }
  emit(x, y, burst = false, dx = 0, dy = 0) {
    this.hasInteracted = true;
    if (burst) this.hue = random(0, 360);
    const force = this.reducedMotion ? 1800 : 5600;
    this.splats.push({
      x: clamp(x / this.width, 0, 1), y: clamp(1 - y / this.height, 0, 1),
      dx: dx ? dx / this.width * force : random(-25, 25),
      dy: dy ? -dy / this.height * force : random(15, 35),
      color: this.color(), size: this.size, boost: burst ? 1.8 : 1,
    });
    this.splats = this.splats.slice(-30);
  }
  seed() {
    const mobile = this.width < 760;
    for (let index = 0; index < 25; index++) {
      const t = index / 24;
      this.splats.push({
        x: (mobile ? 0.54 : 0.72) + Math.sin(t * 5.5 - 1.2) * (mobile ? 0.16 : 0.09) + random(-0.018, 0.018),
        y: (mobile ? 0.26 : 0.27) + t * (mobile ? 0.21 : 0.39),
        dx: Math.cos(t * 5.5) * 40, dy: 10 + Math.sin(t * 7) * 20,
        color: hueColor(310 - t * 260, 0.15), size: mobile ? 63 : 78, boost: mobile ? 1.8 : 3.5,
      });
    }
  }
  render(now) {
    if (this.disposed) return;
    const delta = this.lastFrame ? Math.min(now - this.lastFrame, 48) : 16;
    this.lastFrame = now; this.time += delta;
    if (!this.hasInteracted && !this.reducedMotion && this.time - this.lastAmbient > 500) {
      const mobile = this.width < 760; const t = this.time * 0.0004;
      this.splats.push({ x: (mobile ? 0.54 : 0.72) + Math.sin(t) * 0.055, y: (mobile ? 0.32 : 0.35) + Math.cos(t * 1.4) * 0.06, dx: Math.cos(t) * 20, dy: 12, color: hueColor(265 + Math.sin(t * 0.7) * 110, 0.15), size: 74, boost: 1.7 });
      this.lastAmbient = this.time;
    }
    if (this.auto && this.time - this.lastAuto > 700) {
      const t = this.time * 0.0006;
      this.emit(this.width * (0.5 + Math.sin(t) * 0.28), this.height * (0.47 + Math.cos(t * 1.3) * 0.2), true, Math.cos(t) * 15, Math.sin(t) * 15);
      this.lastAuto = this.time;
    }
    this.pointers.forEach((point) => {
      if (this.time - point.held > 100) { this.emit(point.x, point.y); point.held = this.time; }
    });
    if (this.hoverPoint && this.time - this.hoverPoint.held > 160) {
      this.emit(this.hoverPoint.x, this.hoverPoint.y);
      this.hoverPoint.held = this.time;
    }
    this.splats.splice(0).forEach((splat) => this.renderer.splat(splat.x, splat.y, splat.dx, splat.dy, splat.color, splat.size, splat.boost));
    this.renderer.step(Math.min(delta / 1000, 0.028) * (this.reducedMotion ? 0.4 : 0.8));
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.drawImage(this.renderer.display(), 0, 0, this.width, this.height);
    this.frame = requestAnimationFrame((time) => this.render(time));
  }
  clear() {
    this.splats = []; this.renderer.clear(); this.auto = false; this.hasInteracted = true; this.releasePointers();
  }
  destroy() {
    this.disposed = true; cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.listeners.forEach((remove) => remove()); this.renderer.destroy();
  }
}
