import * as THREE from 'three';
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

  if (arenaId === 'cyber_grid' || arenaId === 'aether_nexus') {
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

export function createArmorMaterial(
  armorId: ArmorId,
  colorHex: string,
  weaveMap: THREE.Texture,
  bumpMap?: THREE.Texture,
  finishStyle: FinishStyleId = 'standard',
): THREE.MeshPhysicalMaterial {
  const spec = ARMOR_CATALOG[armorId] || ARMOR_CATALOG.titanium;
  const fin = FINISH_CATALOG[finishStyle] || FINISH_CATALOG.standard;
  const isIridescentArmor = armorId === 'aetherium' || finishStyle === 'iridescent';

  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colorHex),
    map: weaveMap,
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
}
