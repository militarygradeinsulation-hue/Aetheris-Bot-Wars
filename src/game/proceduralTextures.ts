import * as THREE from 'three';

/** Small seeded RNG so textures look the same every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function finish(c: HTMLCanvasElement, srgb = true, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** Weathered plank crate face with grain, nail heads and scuffs. */
export function woodCrateTexture() {
  return cached('wood', () => {
    const [c, g] = makeCanvas(256, 256);
    const r = rng(11);
    g.fillStyle = '#8a5a2e';
    g.fillRect(0, 0, 256, 256);
    const planks = 5;
    for (let p = 0; p < planks; p++) {
      const y = (p * 256) / planks;
      const tone = 0.85 + r() * 0.3;
      g.fillStyle = `rgb(${Math.round(150 * tone)},${Math.round(98 * tone)},${Math.round(52 * tone)})`;
      g.fillRect(0, y + 2, 256, 256 / planks - 4);
      // Grain streaks
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `rgba(60,34,14,${0.08 + r() * 0.18})`;
        g.lineWidth = 0.6 + r() * 1.4;
        g.beginPath();
        const gy = y + 4 + r() * (256 / planks - 8);
        g.moveTo(0, gy);
        g.bezierCurveTo(80, gy + (r() - 0.5) * 6, 170, gy + (r() - 0.5) * 6, 256, gy + (r() - 0.5) * 4);
        g.stroke();
      }
      // Knots
      if (r() < 0.7) {
        const kx = r() * 256;
        const ky = y + 10 + r() * 20;
        const grad = g.createRadialGradient(kx, ky, 0, kx, ky, 7);
        grad.addColorStop(0, 'rgba(50,25,8,0.8)');
        grad.addColorStop(1, 'rgba(50,25,8,0)');
        g.fillStyle = grad;
        g.fillRect(kx - 8, ky - 8, 16, 16);
      }
      // Plank seams
      g.fillStyle = 'rgba(25,14,6,0.85)';
      g.fillRect(0, y, 256, 2);
    }
    // Cross brace
    g.save();
    g.translate(128, 128);
    g.rotate(Math.PI / 4);
    g.fillStyle = '#6e4420';
    g.fillRect(-180, -14, 360, 28);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(-180, 12, 360, 3);
    g.restore();
    // Frame
    g.strokeStyle = '#5a3818';
    g.lineWidth = 18;
    g.strokeRect(9, 9, 238, 238);
    // Nail heads
    g.fillStyle = '#9ca3af';
    for (const [x, y] of [
      [14, 14],
      [242, 14],
      [14, 242],
      [242, 242],
      [128, 14],
      [128, 242],
    ]) {
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
    }
    // Scuffs and dirt
    for (let k = 0; k < 90; k++) {
      g.fillStyle = `rgba(30,20,10,${r() * 0.12})`;
      g.beginPath();
      g.arc(r() * 256, r() * 256, 2 + r() * 10, 0, Math.PI * 2);
      g.fill();
    }
    return finish(c);
  });
}

/** Cast concrete with aggregate, pores and water stains. */
export function concreteTexture(base = '#8b8f94') {
  return cached(`concrete_${base}`, () => {
    const [c, g] = makeCanvas(256, 256);
    const r = rng(23);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    const img = g.getImageData(0, 0, 256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 34;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    for (let k = 0; k < 260; k++) {
      g.fillStyle = r() < 0.5 ? `rgba(40,40,44,${r() * 0.35})` : `rgba(220,220,225,${r() * 0.2})`;
      g.beginPath();
      g.arc(r() * 256, r() * 256, 0.6 + r() * 1.6, 0, Math.PI * 2);
      g.fill();
    }
    for (let k = 0; k < 5; k++) {
      const x = r() * 256;
      const grad = g.createLinearGradient(x, 0, x, 256);
      grad.addColorStop(0, 'rgba(30,30,30,0)');
      grad.addColorStop(0.5, `rgba(30,30,30,${0.08 + r() * 0.1})`);
      grad.addColorStop(1, 'rgba(30,30,30,0)');
      g.fillStyle = grad;
      g.fillRect(x - 10, 0, 20 + r() * 20, 256);
    }
    return finish(c);
  });
}

/** Yellow/black hazard stripes. */
export function hazardStripeTexture() {
  return cached('stripes', () => {
    const [c, g] = makeCanvas(256, 64);
    g.fillStyle = '#facc15';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#111111';
    for (let x = -64; x < 320; x += 48) {
      g.beginPath();
      g.moveTo(x, 64);
      g.lineTo(x + 24, 64);
      g.lineTo(x + 88, 0);
      g.lineTo(x + 64, 0);
      g.closePath();
      g.fill();
    }
    const r = rng(5);
    for (let k = 0; k < 120; k++) {
      g.fillStyle = `rgba(80,70,60,${r() * 0.25})`;
      g.fillRect(r() * 256, r() * 64, 1 + r() * 4, 1 + r() * 3);
    }
    return finish(c);
  });
}

/** Grayscale roughness variation (smudges, wear) to break up perfect specular. */
export function grimeRoughnessTexture() {
  return cached('grime', () => {
    const [c, g] = makeCanvas(256, 256);
    const r = rng(77);
    g.fillStyle = '#8a8a8a';
    g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 220; k++) {
      const v = Math.round(90 + r() * 120);
      g.fillStyle = `rgba(${v},${v},${v},${0.15 + r() * 0.25})`;
      g.beginPath();
      g.ellipse(r() * 256, r() * 256, 4 + r() * 26, 2 + r() * 12, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    for (let k = 0; k < 60; k++) {
      g.strokeStyle = `rgba(200,200,200,${r() * 0.3})`;
      g.lineWidth = 0.5 + r();
      g.beginPath();
      const x = r() * 256;
      const y = r() * 256;
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 20);
      g.stroke();
    }
    return finish(c, false);
  });
}

/** Brushed steel with fine directional streaks. */
export function brushedMetalTexture(tint = '#9aa3ad') {
  return cached(`brushed_${tint}`, () => {
    const [c, g] = makeCanvas(256, 256);
    const r = rng(41);
    g.fillStyle = tint;
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.07})`;
      g.fillRect(0, y, 256, 1);
    }
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
      g.beginPath();
      g.arc(r() * 256, r() * 256, 3 + r() * 14, 0, Math.PI * 2);
      g.fill();
    }
    return finish(c);
  });
}

/** Tire tread pattern for wrapping around a wheel. */
export function tireTreadTexture() {
  return cached('tread', () => {
    const [c, g] = makeCanvas(256, 64);
    g.fillStyle = '#16181b';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#0a0b0c';
    for (let x = 0; x < 256; x += 16) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 7, 0);
      g.lineTo(x + 12, 32);
      g.lineTo(x + 7, 64);
      g.lineTo(x, 64);
      g.lineTo(x + 5, 32);
      g.closePath();
      g.fill();
    }
    g.fillStyle = 'rgba(80,80,80,0.15)';
    g.fillRect(0, 30, 256, 4);
    return finish(c);
  });
}

/** Transparent overlay of a used arena floor: tire skids, scorch rings, gouges and oil stains. */
export function arenaWearTexture(seed = 3) {
  return cached(`wear_${seed}`, () => {
    const [c, g] = makeCanvas(1024, 1024);
    const r = rng(seed * 977 + 13);
    g.clearRect(0, 0, 1024, 1024);
    // Tire skid arcs
    for (let k = 0; k < 46; k++) {
      const cx = r() * 1024;
      const cy = r() * 1024;
      const rad = 60 + r() * 260;
      const a0 = r() * Math.PI * 2;
      const len = 0.4 + r() * 1.4;
      g.strokeStyle = `rgba(12,12,14,${0.08 + r() * 0.16})`;
      for (const off of [-9, 9]) {
        g.lineWidth = 5 + r() * 5;
        g.beginPath();
        g.arc(cx, cy, rad + off, a0, a0 + len);
        g.stroke();
      }
    }
    // Scorch rings
    for (let k = 0; k < 9; k++) {
      const x = r() * 1024;
      const y = r() * 1024;
      const rad = 30 + r() * 70;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, 'rgba(8,6,4,0.55)');
      grad.addColorStop(0.6, 'rgba(25,15,8,0.3)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
    // Oil stains
    for (let k = 0; k < 7; k++) {
      const x = r() * 1024;
      const y = r() * 1024;
      g.fillStyle = `rgba(10,10,20,${0.12 + r() * 0.12})`;
      g.beginPath();
      g.ellipse(x, y, 20 + r() * 50, 12 + r() * 30, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    // Weapon gouges: bright scratched steel
    for (let k = 0; k < 90; k++) {
      const x = r() * 1024;
      const y = r() * 1024;
      const a = r() * Math.PI;
      const l = 10 + r() * 60;
      g.strokeStyle = `rgba(210,215,222,${0.12 + r() * 0.25})`;
      g.lineWidth = 0.8 + r() * 1.6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    return finish(c);
  });
}

/** Soft vertical falloff for fake volumetric light cones (white at the top, clear at the bottom). */
export function lightShaftTexture() {
  return cached('shaft', () => {
    const [c, g] = makeCanvas(64, 256);
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 256);
    const t = finish(c, false);
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/** Round soft sprite for camera flashes and stadium bulbs. */
export function softDotTexture() {
  return cached('dot', () => {
    const [c, g] = makeCanvas(64, 64);
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return finish(c, false);
  });
}
