import * as THREE from 'three';
import type { PatternId } from '../shared/types';
import type { ArenaId, ArmorId, FinishStyleId } from '../shared/types';
import { ARMOR_CATALOG, ARENA_CATALOG, FINISH_CATALOG } from '../shared/types';

export interface ProceduralTexturePack {
  arenaFloor: THREE.CanvasTexture;
  armorWeave: THREE.CanvasTexture;
  metalBrushBump: THREE.CanvasTexture;
  hazardStripe: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createBotNameplateTexture(
  botName: string,
  accentColor: string,
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 160);
  const label = (botName || 'BOT').trim().toUpperCase().slice(0, 18);

  // Dark machined plate backing
  ctx.fillStyle = '#0F1319';
  ctx.fillRect(0, 0, 512, 160);

  // Brushed horizontal grain
  for (let i = 0; i < 160; i += 3) {
    ctx.fillStyle = i % 6 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, i, 512, 1);
  }

  // Accent bevel frame
  ctx.strokeStyle = accentColor || '#F59E0B';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 496, 144);

  // Corner rivet studs
  ctx.fillStyle = '#CBD5E1';
  [
    [24, 24],
    [488, 24],
    [24, 136],
    [488, 136],
  ].forEach(([rx, ry]) => {
    ctx.beginPath();
    ctx.arc(rx, ry, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Crisp stenciled bot name
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = 54;
  ctx.font = `700 ${fontSize}px "Chakra Petch", system-ui, sans-serif`;
  while (ctx.measureText(label).width > 430 && fontSize > 24) {
    fontSize -= 4;
    ctx.font = `700 ${fontSize}px "Chakra Petch", system-ui, sans-serif`;
  }
  ctx.fillText(label, 256, 82);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createProceduralTextures(
  maxAnisotropy: number,
  arenaId: ArenaId,
): ProceduralTexturePack {
  const spec = ARENA_CATALOG[arenaId] || ARENA_CATALOG.foundry;
  const [floorCanvas, fCtx] = makeCanvas(512);
  const bg = spec.floorHex;
  const accent = spec.accentHex;
  const line =
    arenaId === 'cryo'
      ? '#34587a'
      : arenaId === 'reactor'
        ? '#3b2e5e'
        : arenaId === 'aether_nexus'
          ? '#1e3a5f'
          : arenaId === 'toxic_scrapyard'
            ? '#234233'
            : arenaId === 'volcano_caldera'
              ? '#4a2419'
              : arenaId === 'cyber_grid'
                ? '#4c1d6e'
                : arenaId === 'colosseum'
                  ? '#3b4454'
                  : arenaId === 'skyforge'
                    ? '#4a5a72'
                    : arenaId === 'storm'
                      ? '#2c3a66'
                      : '#2e3745';

  fCtx.fillStyle = bg;
  fCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 2200; i++) {
    fCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
    fCtx.fillRect(Math.random() * 512, Math.random() * 512, 28, 2);
  }

  fCtx.strokeStyle = line;
  fCtx.lineWidth = 4;
  fCtx.strokeRect(2, 2, 508, 508);
  fCtx.lineWidth = 2;
  fCtx.beginPath();
  fCtx.moveTo(256, 0);
  fCtx.lineTo(256, 512);
  fCtx.moveTo(0, 256);
  fCtx.lineTo(512, 256);
  fCtx.stroke();

  if (arenaId === 'cyber_grid' || arenaId === 'aether_nexus' || arenaId === 'storm') {
    fCtx.strokeStyle = accent;
    fCtx.globalAlpha = 0.22;
    fCtx.lineWidth = 2;
    fCtx.strokeRect(24, 24, 464, 464);
    fCtx.beginPath();
    fCtx.arc(256, 256, 92, 0, Math.PI * 2);
    fCtx.stroke();
    fCtx.globalAlpha = 1;
  }

  fCtx.fillStyle = 'rgba(255,255,255,0.075)';
  for (let gx = 32; gx < 512; gx += 64) {
    for (let gy = 32; gy < 512; gy += 64) {
      fCtx.save();
      fCtx.translate(gx, gy);
      fCtx.rotate(Math.PI / 4);
      fCtx.fillRect(-5, -2, 10, 4);
      fCtx.restore();
    }
  }
  fCtx.fillStyle = accent;
  fCtx.globalAlpha = 0.34;
  fCtx.fillRect(16, 16, 12, 12);
  fCtx.fillRect(484, 16, 12, 12);
  fCtx.fillRect(16, 484, 12, 12);
  fCtx.fillRect(484, 484, 12, 12);
  fCtx.globalAlpha = 1;

  const arenaFloor = new THREE.CanvasTexture(floorCanvas);
  arenaFloor.colorSpace = THREE.SRGBColorSpace;
  arenaFloor.wrapS = THREE.RepeatWrapping;
  arenaFloor.wrapT = THREE.RepeatWrapping;
  arenaFloor.repeat.set(9, 9);
  arenaFloor.anisotropy = maxAnisotropy;

  // 2. Armor Plate / Carbon Weave Texture
  const [armorCanvas, aCtx] = makeCanvas(256);
  aCtx.fillStyle = '#dde2ea';
  aCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    for (let x = 0; x < 256; x += 16) {
      aCtx.fillStyle = (x + y) % 32 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)';
      aCtx.fillRect(x, y, 14, 14);
    }
  }
  aCtx.strokeStyle = 'rgba(0,0,0,0.2)';
  aCtx.lineWidth = 3;
  aCtx.strokeRect(4, 4, 248, 248);

  const armorWeave = new THREE.CanvasTexture(armorCanvas);
  armorWeave.colorSpace = THREE.SRGBColorSpace;
  armorWeave.wrapS = THREE.RepeatWrapping;
  armorWeave.wrapT = THREE.RepeatWrapping;
  armorWeave.anisotropy = maxAnisotropy;

  // 3. Linear Brushed Metal Bump / Micro-machining Texture
  const [bumpCanvas, bCtx] = makeCanvas(256);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const shade = 112 + Math.floor(Math.random() * 34);
    bCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
    bCtx.fillRect(0, y, 256, 1);
  }
  bCtx.strokeStyle = '#505050';
  bCtx.lineWidth = 3;
  bCtx.strokeRect(6, 6, 244, 244);

  const metalBrushBump = new THREE.CanvasTexture(bumpCanvas);
  metalBrushBump.colorSpace = THREE.NoColorSpace;
  metalBrushBump.wrapS = THREE.RepeatWrapping;
  metalBrushBump.wrapT = THREE.RepeatWrapping;
  metalBrushBump.anisotropy = maxAnisotropy;

  // 4. Hazard Chevron Texture
  const [hazCanvas, hCtx] = makeCanvas(256);
  hCtx.fillStyle = '#181c22';
  hCtx.fillRect(0, 0, 256, 256);
  hCtx.fillStyle = '#f59e0b';
  for (let i = -256; i < 512; i += 48) {
    hCtx.beginPath();
    hCtx.moveTo(i, 0);
    hCtx.lineTo(i + 24, 0);
    hCtx.lineTo(i + 280, 256);
    hCtx.lineTo(i + 256, 256);
    hCtx.closePath();
    hCtx.fill();
  }
  const hazardStripe = new THREE.CanvasTexture(hazCanvas);
  hazardStripe.colorSpace = THREE.SRGBColorSpace;
  hazardStripe.wrapS = THREE.RepeatWrapping;
  hazardStripe.wrapT = THREE.RepeatWrapping;
  hazardStripe.anisotropy = maxAnisotropy;

  // 5. Radial Soft Contact Shadow Texture
  const [shadCanvas, sCtx] = makeCanvas(128);
  const grad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.72)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  return {
    arenaFloor,
    armorWeave,
    metalBrushBump,
    hazardStripe,
    contactShadow,
    dispose: () => {
      arenaFloor.dispose();
      armorWeave.dispose();
      metalBrushBump.dispose();
      hazardStripe.dispose();
      contactShadow.dispose();
    },
  };
}

function shade(hex: string, factor: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return `#${c.getHexString()}`;
}

/** Procedural livery pattern painted in the bot's body + accent colors. */
export function createLiveryTexture(
  pattern: PatternId,
  primary: string,
  accent: string,
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, size, size);
  const dark = shade(primary, 0.55);

  if (pattern === 'stripes') {
    ctx.fillStyle = accent;
    ctx.fillRect(size * 0.36, 0, size * 0.1, size);
    ctx.fillRect(size * 0.54, 0, size * 0.1, size);
    ctx.fillStyle = dark;
    ctx.fillRect(size * 0.46, 0, size * 0.08, size);
  } else if (pattern === 'flames') {
    const drawFlame = (y0: number, color: string, scale: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let i = 0; i <= 8; i++) {
        const x = (i / 8) * size;
        const tip = y0 - (30 + ((i * 37) % 50)) * scale;
        ctx.quadraticCurveTo(x - 10, tip, x + 14, y0 - 6 * scale);
      }
      ctx.lineTo(size, size);
      ctx.lineTo(0, size);
      ctx.closePath();
      ctx.fill();
    };
    drawFlame(size * 0.82, '#B91C1C', 1.4);
    drawFlame(size * 0.9, '#F97316', 1.0);
    drawFlame(size * 0.97, accent, 0.6);
  } else if (pattern === 'digital_camo') {
    const cols = [dark, accent, shade(primary, 0.8), shade(accent, 0.6)];
    const cell = 16;
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const r = rnd();
        if (r < 0.45) continue;
        ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
        ctx.fillRect(x, y, cell * (1 + Math.floor(rnd() * 2)), cell);
      }
    }
  } else if (pattern === 'hex') {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    const r = 18;
    const h = Math.sqrt(3) * r;
    for (let row = -1; row < size / h + 1; row++) {
      for (let col = -1; col < size / (r * 1.5) + 1; col++) {
        const cx = col * r * 1.5;
        const cy = row * h + (col % 2 ? h / 2 : 0);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const px = cx + Math.cos(a) * r * 0.92;
          const py = cy + Math.sin(a) * r * 0.92;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  } else if (pattern === 'checker') {
    const cell = 32;
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        if (((x + y) / cell) % 2 === 0) {
          ctx.fillStyle = accent;
          ctx.fillRect(x, y, cell, cell);
        }
      }
    }
  } else if (pattern === 'tiger') {
    ctx.fillStyle = dark;
    for (let i = 0; i < 9; i++) {
      const y = (i / 9) * size + 6;
      ctx.beginPath();
      ctx.moveTo(-10, y);
      ctx.quadraticCurveTo(size * 0.3, y - 22, size * 0.55, y + 4);
      ctx.quadraticCurveTo(size * 0.35, y + 10, -10, y + 14);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(size + 10, y + 12);
      ctx.quadraticCurveTo(size * 0.7, y - 10, size * 0.48, y + 14);
      ctx.quadraticCurveTo(size * 0.68, y + 22, size + 10, y + 26);
      ctx.fill();
    }
  } else if (pattern === 'circuit') {
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 2.5;
    let seed = 13;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 22; i++) {
      let x = Math.floor(rnd() * 16) * 16;
      let y = Math.floor(rnd() * 16) * 16;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        if (rnd() < 0.5) x += (rnd() < 0.5 ? -1 : 1) * 32;
        else y += (rnd() < 0.5 ? -1 : 1) * 32;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Subtle panel wear so solid patterns still read as painted metal
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.2, 1.2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/** Circular race-number roundel for side plates. */
export function createRaceNumberTexture(num: number, accent: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 64px "Chakra Petch", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), 64, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft radial glow sprite used for underglow pools and team rings. */
export function createArmorMaterial(
  armorId: ArmorId,
  colorHex: string,
  weaveMap: THREE.Texture,
  bumpMap?: THREE.Texture,
  finishStyle: FinishStyleId = 'standard',
  liveryMap?: THREE.Texture,
): THREE.MeshPhysicalMaterial {
  const spec = ARMOR_CATALOG[armorId] || ARMOR_CATALOG.titanium;
  const fin = FINISH_CATALOG[finishStyle] || FINISH_CATALOG.standard;
  const isIridescentArmor = armorId === 'aetherium' || finishStyle === 'iridescent';

  const baseColor = liveryMap ? '#FFFFFF' : colorHex;
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(baseColor),
    map: liveryMap ?? weaveMap,
    bumpMap,
    bumpScale: armorId === 'reactive_era' ? 0.022 : 0.014,
    roughness: THREE.MathUtils.clamp(spec.roughness * 0.78 * fin.roughnessMult, 0.08, 0.88),
    metalness: THREE.MathUtils.clamp(spec.metalness + 0.06 + fin.metalnessAdd, 0.1, 0.99),
    envMapIntensity: finishStyle === 'chrome' || isIridescentArmor ? 1.9 : 1.55,
    clearcoat: armorId === 'kevlar' && finishStyle === 'standard' ? 0.35 : fin.clearcoat,
    clearcoatRoughness: finishStyle === 'matte' ? 0.45 : 0.12,
    iridescence: isIridescentArmor ? 0.95 : fin.iridescence,
    iridescenceIOR: 1.45,
    anisotropy:
      armorId === 'titanium' || armorId === 'steel' || armorId === 'tungsten' || finishStyle === 'chrome'
        ? 0.85
        : 0.25,
  });
  mat.userData.baseColor = baseColor;
  return mat;
}
