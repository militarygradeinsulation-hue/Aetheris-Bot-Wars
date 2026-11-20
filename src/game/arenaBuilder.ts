import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ARENA_CATALOG,
  type ArenaId,
  type ColorBlindMode,
  type DestructibleProp,
  type HazardState,
} from '../shared/types';
import type { ProceduralTexturePack } from './materials';

export interface HazardMeshEntry {
  root: THREE.Group;
  movingPart: THREE.Object3D;
  ringMat?: THREE.MeshBasicMaterial;
  emissiveMat?: THREE.MeshStandardMaterial;
}

export interface BuiltArenaScene {
  group: THREE.Group;
  propMeshes: Map<string, THREE.Group>;
  hazardMeshes: Map<string, HazardMeshEntry>;
  syncDynamicProps: (props: DestructibleProp[], time: number) => void;
  syncHazards: (hazards: HazardState[], dt: number, colorBlindMode?: ColorBlindMode) => void;
  syncCrowd: (time: number, excitement: number) => void;
  dispose: () => void;
}

type CrowdArchetype = 'cheer' | 'clap' | 'phone' | 'pennant' | 'watch';

interface CrowdMemberSeed {
  x: number;
  baseY: number;
  z: number;
  yaw: number;
  phase: number;
  swayPhase: number;
  scale: number;
  archetype: CrowdArchetype;
  seatedBias: number;
  hasCap: boolean;
  propIndex: number;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

function createCrowdTextures(maxAnisotropy: number): {
  faceTex: THREE.CanvasTexture;
  jacketTex: THREE.CanvasTexture;
} {
  // Procedural face albedo map (neutral ivory base tinted per instance by skinPalette)
  const fCanvas = document.createElement('canvas');
  fCanvas.width = 128;
  fCanvas.height = 128;
  const fCtx = fCanvas.getContext('2d')!;
  fCtx.fillStyle = '#f2ece6';
  fCtx.fillRect(0, 0, 128, 128);

  // Subtle jaw & forehead shading
  const faceGrad = fCtx.createLinearGradient(0, 24, 0, 114);
  faceGrad.addColorStop(0, 'rgba(0,0,0,0.06)');
  faceGrad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  faceGrad.addColorStop(1, 'rgba(0,0,0,0.16)');
  fCtx.fillStyle = faceGrad;
  fCtx.fillRect(0, 0, 128, 128);

  // Face features centered at u=0.5 (x=64) facing +Z
  // Brow shadow & eyebrows
  fCtx.fillStyle = 'rgba(38,24,18,0.68)';
  fCtx.fillRect(50, 52, 10, 2.5);
  fCtx.fillRect(68, 52, 10, 2.5);

  // Eyes (sclera + dark iris)
  fCtx.fillStyle = '#f8fafc';
  fCtx.fillRect(51, 57, 8, 4);
  fCtx.fillRect(69, 57, 8, 4);
  fCtx.fillStyle = '#1e1b18';
  fCtx.beginPath();
  fCtx.arc(55, 59, 2.2, 0, Math.PI * 2);
  fCtx.arc(73, 59, 2.2, 0, Math.PI * 2);
  fCtx.fill();

  // Nose bridge shadow & mouth
  fCtx.fillStyle = 'rgba(0,0,0,0.14)';
  fCtx.fillRect(62.5, 59, 3, 10);
  fCtx.fillStyle = 'rgba(95,45,42,0.58)';
  fCtx.fillRect(58, 76, 12, 2.2);

  const faceTex = new THREE.CanvasTexture(fCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = maxAnisotropy;

  // Procedural jacket / jersey weave & collar detail (tinted per instance)
  const jCanvas = document.createElement('canvas');
  jCanvas.width = 128;
  jCanvas.height = 128;
  const jCtx = jCanvas.getContext('2d')!;
  jCtx.fillStyle = '#ebebeb';
  jCtx.fillRect(0, 0, 128, 128);

  for (let y = 0; y < 128; y += 3) {
    jCtx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    jCtx.fillRect(0, y, 128, 1);
  }
  // Collar & center zipper placket at u=0.5 (x=64)
  jCtx.fillStyle = 'rgba(15,23,42,0.28)';
  jCtx.fillRect(62.5, 22, 3, 106);
  jCtx.beginPath();
  jCtx.moveTo(52, 16);
  jCtx.lineTo(64, 34);
  jCtx.lineTo(76, 16);
  jCtx.closePath();
  jCtx.fill();
  // Subtle athletic chest stripe
  jCtx.fillStyle = 'rgba(255,255,255,0.22)';
  jCtx.fillRect(0, 48, 128, 8);

  const jacketTex = new THREE.CanvasTexture(jCanvas);
  jacketTex.colorSpace = THREE.SRGBColorSpace;
  jacketTex.anisotropy = maxAnisotropy;

  return { faceTex, jacketTex };
}

function prepGeo(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIdx = g.index ? g.toNonIndexed() : g.clone();
  if (!nonIdx.attributes.normal) nonIdx.computeVertexNormals();
  if (!nonIdx.attributes.uv) {
    const count = nonIdx.attributes.position.count;
    nonIdx.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return nonIdx;
}

export function buildArenaEnvironment(
  arenaId: ArenaId,
  textures: ProceduralTexturePack,
  castShadow = true,
): BuiltArenaScene {
  const spec = ARENA_CATALOG[arenaId];
  const half = spec.halfSize;
  const group = new THREE.Group();

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // 1. Extended Industrial Stadium Deck (never floating in void)
  const outerDeckGeo = new THREE.PlaneGeometry(160, 160);
  outerDeckGeo.rotateX(-Math.PI / 2);
  const outerDeckMat = new THREE.MeshStandardMaterial({
    color:
      arenaId === 'cryo'
        ? 0x0b141e
        : arenaId === 'reactor'
          ? 0x100c1b
          : arenaId === 'colosseum'
            ? 0x10131a
            : 0x0d1015,
    roughness: 0.85,
    metalness: 0.35,
  });
  geometries.push(outerDeckGeo);
  materials.push(outerDeckMat);
  const outerDeck = new THREE.Mesh(outerDeckGeo, outerDeckMat);
  outerDeck.position.y = -0.05;
  outerDeck.receiveShadow = true;
  group.add(outerDeck);

  // 2. Shiny Reflective BattleBox Floor Deck
  const floorGeo = new THREE.PlaneGeometry(half * 2, half * 2);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshPhysicalMaterial({
    map: textures.arenaFloor,
    bumpMap: textures.metalBrushBump,
    bumpScale: 0.012,
    roughness: arenaId === 'cryo' ? 0.14 : 0.28,
    metalness: arenaId === 'cryo' ? 0.35 : 0.84,
    envMapIntensity: 1.4,
    clearcoat: arenaId === 'cryo' ? 0.9 : 0.52,
    clearcoatRoughness: 0.16,
  });
  geometries.push(floorGeo);
  materials.push(floorMat);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // 3. Recessed Center Battle Ring Decal + Arena Floor Branding Murals
  const ringGeo = new THREE.RingGeometry(5.2, 5.75, 64);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(spec.accentHex),
    transparent: true,
    opacity: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  geometries.push(ringGeo);
  materials.push(ringMat);
  const centerRing = new THREE.Mesh(ringGeo, ringMat);
  centerRing.position.y = 0.02;
  group.add(centerRing);

  // Official Aetheris Bot Wars / Lovable Expert Partner '26 Brand Texture + THE ARCHITECT Developer Logo
  const brandTex = new THREE.TextureLoader().load(
    '/assets/aistudio/WhatsApp_Image_2026-11-16_at_3.53.53_PM_9a533155.jpeg',
  );
  brandTex.colorSpace = THREE.SRGBColorSpace;
  brandTex.anisotropy = textures.armorWeave.anisotropy || 4;

  const devLogoTex = new THREE.TextureLoader().load(
    '/assets/aistudio/nano-banana-2_take_this_image_and_create_a_logo_out_of_it_Token_HSL_Usage_--background_220_15_-0_1__11fa74ed.jpg',
  );
  devLogoTex.colorSpace = THREE.SRGBColorSpace;
  devLogoTex.anisotropy = textures.armorWeave.anisotropy || 4;

  const floorBrandMat = new THREE.MeshStandardMaterial({
    map: brandTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: brandTex,
    emissiveIntensity: 0.58,
    roughness: 0.24,
    metalness: 0.32,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const wallBrandMat = new THREE.MeshStandardMaterial({
    map: brandTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: brandTex,
    emissiveIntensity: 0.72,
    roughness: 0.2,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
  const devBrandMat = new THREE.MeshStandardMaterial({
    map: devLogoTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: devLogoTex,
    emissiveIntensity: 0.68,
    roughness: 0.22,
    metalness: 0.28,
    side: THREE.DoubleSide,
  });
  materials.push(floorBrandMat, wallBrandMat, devBrandMat);

  // Center Floor Giant Brand Mural + North/South Floor Apron Banners
  const centerFloorBannerGeo = new THREE.PlaneGeometry(14.4, 4.0);
  centerFloorBannerGeo.rotateX(-Math.PI / 2);
  const deckLaneBannerGeo = new THREE.PlaneGeometry(11.2, 3.1);
  deckLaneBannerGeo.rotateX(-Math.PI / 2);
  const centerBannerFrameGeo = new THREE.RingGeometry(7.35, 7.55, 4);
  centerBannerFrameGeo.rotateX(-Math.PI / 2);
  centerBannerFrameGeo.rotateY(Math.PI / 4);
  geometries.push(centerFloorBannerGeo, deckLaneBannerGeo, centerBannerFrameGeo);

  const centerFloorBanner = new THREE.Mesh(centerFloorBannerGeo, floorBrandMat);
  centerFloorBanner.position.set(0, 0.026, 0);
  centerFloorBanner.receiveShadow = true;
  group.add(centerFloorBanner);

  const northFloorBanner = new THREE.Mesh(deckLaneBannerGeo, floorBrandMat);
  northFloorBanner.position.set(0, 0.024, -8.2);
  northFloorBanner.receiveShadow = true;
  group.add(northFloorBanner);

  const southFloorBanner = new THREE.Mesh(deckLaneBannerGeo, floorBrandMat);
  southFloorBanner.position.set(0, 0.024, 8.2);
  southFloorBanner.rotation.y = Math.PI;
  southFloorBanner.receiveShadow = true;
  group.add(southFloorBanner);

  // 4. Perimeter Steel Walls + Lexan Polycarbonate Blast Shields
  const wallMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e2530,
    bumpMap: textures.metalBrushBump,
    bumpScale: 0.01,
    roughness: 0.34,
    metalness: 0.85,
    envMapIntensity: 1.4,
    clearcoat: 0.4,
  });
  const bumperMat = new THREE.MeshStandardMaterial({
    map: textures.hazardStripe,
    roughness: 0.38,
    metalness: 0.4,
  });
  const railGlowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.accentHex),
    emissive: new THREE.Color(spec.accentHex),
    emissiveIntensity: 1.25,
    roughness: 0.2,
    metalness: 0.5,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: arenaId === 'cryo' ? 0xbae6fd : 0xe2e8f0,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.18,
    reflectivity: 0.9,
    clearcoat: 1.0,
    depthWrite: false,
  });
  materials.push(wallMat, bumperMat, railGlowMat, glassMat);

  const wallLongGeo = new THREE.BoxGeometry(half * 2 + 1.2, 1.35, 0.9);
  const railGeo = new THREE.BoxGeometry(half * 2, 0.14, 0.18);
  const lexanGeo = new THREE.BoxGeometry(half * 2, 2.2, 0.08);
  const pylonGeo = new THREE.BoxGeometry(1.6, 4.6, 1.6);
  const strutPostGeo = new THREE.BoxGeometry(0.18, 2.4, 0.22);
  const wallBannerGeo = new THREE.PlaneGeometry(8.6, 2.38);
  const wallBannerBackingGeo = new THREE.BoxGeometry(8.85, 2.58, 0.08);
  geometries.push(wallLongGeo, railGeo, lexanGeo, pylonGeo, strutPostGeo, wallBannerGeo, wallBannerBackingGeo);

  const wallConfigs: Array<{ x: number; z: number; ry: number }> = [
    { x: 0, z: -half - 0.45, ry: 0 },
    { x: 0, z: half + 0.45, ry: 0 },
    { x: -half - 0.45, z: 0, ry: Math.PI / 2 },
    { x: half + 0.45, z: 0, ry: Math.PI / 2 },
  ];
  for (const wc of wallConfigs) {
    const wGroup = new THREE.Group();
    wGroup.position.set(wc.x, 0, wc.z);
    wGroup.rotation.y = wc.ry;

    const inwardSign = wc.z < 0 || wc.x < 0 ? 1 : -1;

    const base = new THREE.Mesh(wallLongGeo, wallMat);
    base.position.y = 0.675;
    base.castShadow = castShadow;
    base.receiveShadow = true;

    const strip = new THREE.Mesh(railGeo, bumperMat);
    strip.position.set(0, 0.45, inwardSign * 0.46);

    const glow = new THREE.Mesh(railGeo, railGlowMat);
    glow.position.set(0, 1.38, 0);

    // Clear Lexan shield + vertical steel frame posts
    const shield = new THREE.Mesh(lexanGeo, glassMat);
    shield.position.set(0, 2.52, 0);

    const topRail = new THREE.Mesh(railGeo, wallMat);
    topRail.position.set(0, 3.65, 0);

    for (let px = -half + 6; px <= half - 6; px += 6) {
      const post = new THREE.Mesh(strutPostGeo, wallMat);
      post.position.set(px, 2.52, 0);
      wGroup.add(post);
    }

    // Perimeter Ringside Brand Billboards + THE ARCHITECT Developer Medallions mounted along North, East & West walls
    // Leave South wall (wc.z > 0) Lexan glass completely clear for the ringside fan/driver booth view!
    const isSouthDriverGlass = wc.z > 0;
    if (!isSouthDriverGlass) {
      for (const bx of [-6.2, 6.2]) {
        const backing = new THREE.Mesh(wallBannerBackingGeo, wallMat);
        backing.position.set(bx, 2.52, inwardSign * 0.1);
        const banner = new THREE.Mesh(wallBannerGeo, wallBrandMat);
        banner.position.set(bx, 2.52, inwardSign * 0.16);
        if (inwardSign < 0) {
          banner.rotation.y = Math.PI;
        }
        wGroup.add(backing, banner);
      }
      const devBadgeGeo = new THREE.CircleGeometry(1.18, 28);
      geometries.push(devBadgeGeo);
      const devBadge = new THREE.Mesh(devBadgeGeo, devBrandMat);
      devBadge.position.set(0, 2.52, inwardSign * 0.17);
      if (inwardSign < 0) {
        devBadge.rotation.y = Math.PI;
      }
      wGroup.add(devBadge);
    }

    wGroup.add(base, strip, glow, shield, topRail);
    group.add(wGroup);
  }

  // Corner Pylons
  [
    [-half - 0.6, -half - 0.6],
    [half + 0.6, -half - 0.6],
    [-half - 0.6, half + 0.6],
    [half + 0.6, half + 0.6],
  ].forEach(([px, pz]) => {
    const pylon = new THREE.Mesh(pylonGeo, wallMat);
    pylon.position.set(px, 2.3, pz);
    pylon.castShadow = castShadow;
    group.add(pylon);
  });

  // 5. Distinct Arena Architecture Beyond the BattleBox Walls
  const accentGlowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.accentHex),
    emissive: new THREE.Color(spec.accentHex),
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  materials.push(accentGlowMat);

  if (arenaId === 'foundry') {
    // Glowing molten trenches & furnace crucibles outside perimeter
    const troughGeo = new THREE.BoxGeometry(half * 2 + 4, 0.16, 1.5);
    const crucibleGeo = new THREE.CylinderGeometry(1.5, 1.8, 6.5, 12);
    geometries.push(troughGeo, crucibleGeo);
    [
      [0, -half - 2.1, 0],
      [0, half + 2.1, 0],
      [-half - 2.1, 0, Math.PI / 2],
      [half + 2.1, 0, Math.PI / 2],
    ].forEach(([tx, tz, ry]) => {
      const t = new THREE.Mesh(troughGeo, accentGlowMat);
      t.position.set(tx, 0.04, tz);
      t.rotation.y = ry;
      group.add(t);
    });
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 === 0 ? -half - 11 : half + 11;
      const sz = i < 2 ? -half - 11 : half + 11;
      const cru = new THREE.Mesh(crucibleGeo, wallMat);
      cru.position.set(sx, 3.25, sz);
      group.add(cru);
    }
  } else if (arenaId === 'cryo') {
    // Cryo coolant pipes & frosted monolith towers
    const pipeGeo = new THREE.CylinderGeometry(0.45, 0.45, half * 2 + 4, 12);
    pipeGeo.rotateZ(Math.PI / 2);
    const cryoColGeo = new THREE.OctahedronGeometry(2.1, 0);
    geometries.push(pipeGeo, cryoColGeo);
    [-half - 2.0, half + 2.0].forEach((pz) => {
      const p = new THREE.Mesh(pipeGeo, accentGlowMat);
      p.position.set(0, 0.45, pz);
      group.add(p);
    });
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 === 0 ? -half - 11 : half + 11;
      const sz = i < 2 ? -half - 11 : half + 11;
      const crystal = new THREE.Mesh(cryoColGeo, accentGlowMat);
      crystal.position.set(sx, 3.5, sz);
      group.add(crystal);
    }
  } else if (arenaId === 'reactor' || arenaId === 'aether_nexus') {
    // High-voltage capacitor coils & quantum pylons at corners
    const coilGeo = new THREE.TorusGeometry(2.0, 0.32, 10, 24);
    coilGeo.rotateX(Math.PI / 2);
    const coreColGeo = new THREE.CylinderGeometry(0.9, 1.1, 7.5, 12);
    geometries.push(coilGeo, coreColGeo);
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 === 0 ? -half - 10 : half + 10;
      const sz = i < 2 ? -half - 10 : half + 10;
      const col = new THREE.Mesh(coreColGeo, wallMat);
      col.position.set(sx, 3.75, sz);
      group.add(col);
      [2.2, 4.2, 6.2].forEach((cy) => {
        const coil = new THREE.Mesh(coilGeo, accentGlowMat);
        coil.position.set(sx, cy, sz);
        group.add(coil);
      });
    }
  } else if (arenaId === 'toxic_scrapyard') {
    // Acid reclamation vats & industrial gantry pipes
    const vatGeo = new THREE.CylinderGeometry(2.2, 2.2, 5.2, 16);
    const vatTopGeo = new THREE.CircleGeometry(2.05, 16);
    vatTopGeo.rotateX(-Math.PI / 2);
    geometries.push(vatGeo, vatTopGeo);
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 === 0 ? -half - 10.5 : half + 10.5;
      const sz = i < 2 ? -half - 10.5 : half + 10.5;
      const vat = new THREE.Mesh(vatGeo, wallMat);
      vat.position.set(sx, 2.6, sz);
      const pool = new THREE.Mesh(vatTopGeo, accentGlowMat);
      pool.position.set(sx, 5.22, sz);
      group.add(vat, pool);
    }
  } else if (arenaId === 'volcano_caldera') {
    // Volcanic basalt spires & magma moat
    const troughGeo = new THREE.BoxGeometry(half * 2 + 4, 0.18, 1.8);
    const spireGeo = new THREE.ConeGeometry(2.4, 8.5, 7);
    geometries.push(troughGeo, spireGeo);
    [
      [0, -half - 2.2, 0],
      [0, half + 2.2, 0],
      [-half - 2.2, 0, Math.PI / 2],
      [half + 2.2, 0, Math.PI / 2],
    ].forEach(([tx, tz, ry]) => {
      const t = new THREE.Mesh(troughGeo, accentGlowMat);
      t.position.set(tx, 0.04, tz);
      t.rotation.y = ry;
      group.add(t);
    });
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 === 0 ? -half - 11 : half + 11;
      const sz = i < 2 ? -half - 11 : half + 11;
      const sp = new THREE.Mesh(spireGeo, wallMat);
      sp.position.set(sx, 4.25, sz);
      group.add(sp);
    }
  } else if (arenaId === 'skyforge') {
    // Floating sky platform: deep void ring, hovering rock islands and thruster pylons
    const voidGeo = new THREE.RingGeometry(half + 3, half + 30, 48);
    voidGeo.rotateX(-Math.PI / 2);
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x0b1324, transparent: true, opacity: 0.85, depthWrite: false });
    const islandGeo = new THREE.DodecahedronGeometry(2.2, 0);
    const thrusterGeo = new THREE.CylinderGeometry(0.9, 1.4, 2.2, 12);
    const cloudGeo = new THREE.TorusGeometry(half + 14, 1.6, 6, 48);
    cloudGeo.rotateX(Math.PI / 2);
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.35, depthWrite: false });
    geometries.push(voidGeo, islandGeo, thrusterGeo, cloudGeo);
    materials.push(voidMat, cloudMat);
    const voidMesh = new THREE.Mesh(voidGeo, voidMat);
    voidMesh.position.y = -0.03;
    group.add(voidMesh);
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.y = -6;
    group.add(cloud);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const r = half + 13 + (i % 2) * 4;
      const island = new THREE.Mesh(islandGeo, wallMat);
      island.position.set(Math.cos(a) * r, 2 + (i % 3) * 2.5, Math.sin(a) * r);
      island.scale.set(1.2, 0.7, 1.1);
      island.rotation.set(i, i * 0.7, 0);
      group.add(island);
      const glow = new THREE.Mesh(thrusterGeo, accentGlowMat);
      glow.position.set(Math.cos(a) * r, island.position.y - 1.6, Math.sin(a) * r);
      group.add(glow);
    }
  } else if (arenaId === 'storm') {
    // Tesla Stormcage: ring of lightning rods with glowing orbs and arcing coils
    const rodGeo = new THREE.CylinderGeometry(0.22, 0.4, 9, 10);
    const orbGeo = new THREE.SphereGeometry(0.9, 16, 12);
    const coilGeo = new THREE.TorusGeometry(1.1, 0.14, 8, 20);
    coilGeo.rotateX(Math.PI / 2);
    geometries.push(rodGeo, orbGeo, coilGeo);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const r = half + 7;
      const rod = new THREE.Mesh(rodGeo, wallMat);
      rod.position.set(Math.cos(a) * r, 4.5, Math.sin(a) * r);
      const orb = new THREE.Mesh(orbGeo, accentGlowMat);
      orb.position.set(Math.cos(a) * r, 9.4, Math.sin(a) * r);
      group.add(rod, orb);
      [2.5, 4.5, 6.5].forEach((cy) => {
        const coil = new THREE.Mesh(coilGeo, accentGlowMat);
        coil.position.set(Math.cos(a) * r, cy, Math.sin(a) * r);
        coil.scale.setScalar(0.7);
        group.add(coil);
      });
    }
  } else {
    // Apex Colosseum & Cyber Grid: Stadium floodlight towers & neon arches
    const towerGeo = new THREE.BoxGeometry(1.4, 11, 1.4);
    const lightBarGeo = new THREE.BoxGeometry(4.2, 1.3, 0.6);
    geometries.push(towerGeo, lightBarGeo);
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 === 0 ? -half - 10.5 : half + 10.5;
      const sz = i < 2 ? -half - 10.5 : half + 10.5;
      const tower = new THREE.Mesh(towerGeo, wallMat);
      tower.position.set(sx, 5.5, sz);
      const flood = new THREE.Mesh(lightBarGeo, accentGlowMat);
      flood.position.set(sx, 10.6, sz);
      flood.lookAt(0, 0, 0);
      group.add(tower, flood);
    }
  }

  // 6. Tiered Stadium Bleachers & Realistic Articulated Spectators
  const bleacherMat = new THREE.MeshStandardMaterial({
    color: 0x151a22,
    roughness: 0.72,
    metalness: 0.35,
  });
  const benchMat = new THREE.MeshStandardMaterial({
    color: 0x262f3d,
    roughness: 0.6,
    metalness: 0.45,
  });
  const standRailMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.32,
    metalness: 0.85,
  });
  materials.push(bleacherMat, benchMat, standRailMat);

  const standWidth = half * 2 - 2;
  const standTierGeo = new THREE.BoxGeometry(standWidth, 1.05, 1.85);
  const benchPlankGeo = new THREE.BoxGeometry(standWidth - 0.6, 0.14, 0.52);
  const frontRailGeo = new THREE.BoxGeometry(standWidth, 0.08, 0.08);
  const jumboBoardGeo = new THREE.PlaneGeometry(16.8, 4.65);
  const jumboCabinetGeo = new THREE.BoxGeometry(17.4, 5.15, 0.42);
  const jumboTrimGeo = new THREE.BoxGeometry(17.5, 0.16, 0.48);
  const jumboStrutGeo = new THREE.CylinderGeometry(0.22, 0.26, 6.2, 10);
  geometries.push(
    standTierGeo,
    benchPlankGeo,
    frontRailGeo,
    jumboBoardGeo,
    jumboCabinetGeo,
    jumboTrimGeo,
    jumboStrutGeo,
  );

  const crowdSeeds: CrowdMemberSeed[] = [];
  const standSides = [
    { axis: 'z' as const, sign: -1, yaw: 0 },
    { axis: 'z' as const, sign: 1, yaw: Math.PI },
    { axis: 'x' as const, sign: -1, yaw: Math.PI / 2 },
    { axis: 'x' as const, sign: 1, yaw: -Math.PI / 2 },
  ];

  const archetypes: CrowdArchetype[] = ['cheer', 'clap', 'phone', 'pennant', 'watch'];
  let phoneCount = 0;
  let pennantCount = 0;

  for (const side of standSides) {
    // Overhead Stadium Jumbo Brand Billboard above each bleacher stand
    const jumboDist = half + 9.2;
    const jumboGroup = new THREE.Group();
    if (side.axis === 'z') {
      jumboGroup.position.set(0, 6.4, side.sign * jumboDist);
      jumboGroup.rotation.y = side.yaw;
    } else {
      jumboGroup.position.set(side.sign * jumboDist, 6.4, 0);
      jumboGroup.rotation.y = side.yaw;
    }
    const cabinet = new THREE.Mesh(jumboCabinetGeo, wallMat);
    const screen = new THREE.Mesh(jumboBoardGeo, wallBrandMat);
    screen.position.z = 0.23;
    const topTrim = new THREE.Mesh(jumboTrimGeo, railGlowMat);
    topTrim.position.y = 2.6;
    const botTrim = new THREE.Mesh(jumboTrimGeo, railGlowMat);
    botTrim.position.y = -2.6;
    const leftStrut = new THREE.Mesh(jumboStrutGeo, wallMat);
    leftStrut.position.set(-6.8, -3.3, -0.1);
    const rightStrut = new THREE.Mesh(jumboStrutGeo, wallMat);
    rightStrut.position.set(6.8, -3.3, -0.1);
    jumboGroup.add(cabinet, screen, topTrim, botTrim, leftStrut, rightStrut);
    group.add(jumboGroup);

    // Front safety handrail along row 1
    const frontDist = half + 2.85;
    const rail = new THREE.Mesh(frontRailGeo, standRailMat);
    if (side.axis === 'z') {
      rail.position.set(0, 1.15, side.sign * frontDist);
    } else {
      rail.position.set(side.sign * frontDist, 1.15, 0);
      rail.rotation.y = Math.PI / 2;
    }
    group.add(rail);

    for (let tier = 0; tier < 3; tier++) {
      const dist = half + 3.85 + tier * 1.92;
      const tierY = 0.62 + tier * 1.15;
      const riser = new THREE.Mesh(standTierGeo, bleacherMat);
      const bench = new THREE.Mesh(benchPlankGeo, benchMat);
      if (side.axis === 'z') {
        riser.position.set(0, tierY - 0.52, side.sign * dist);
        bench.position.set(0, tierY + 0.14, side.sign * (dist + 0.25));
      } else {
        riser.position.set(side.sign * dist, tierY - 0.52, 0);
        riser.rotation.y = Math.PI / 2;
        bench.position.set(side.sign * (dist + 0.25), tierY + 0.14, 0);
        bench.rotation.y = Math.PI / 2;
      }
      riser.receiveShadow = true;
      bench.receiveShadow = true;
      group.add(riser, bench);

      // Seed 20 spectators per tier per side with natural stadium aisle gaps (240 total people)
      for (let s = 0; s < 20; s++) {
        // Skip two aisle columns so stands look like real sectioned stadium seating
        if (s === 6 || s === 13) continue;
        const along = -standWidth * 0.46 + (s / 19) * (standWidth * 0.92) + (Math.random() - 0.5) * 0.28;
        const depthJitter = (Math.random() - 0.5) * 0.26;
        const arch = archetypes[(s * 3 + tier * 2 + Math.floor(Math.random() * 2)) % archetypes.length];
        let propIndex = -1;
        if (arch === 'phone') propIndex = phoneCount++;
        else if (arch === 'pennant') propIndex = pennantCount++;

        crowdSeeds.push({
          x: side.axis === 'z' ? along : side.sign * (dist + depthJitter),
          baseY: tierY + 0.04,
          z: side.axis === 'z' ? side.sign * (dist + depthJitter) : along,
          yaw: side.yaw + (Math.random() - 0.5) * 0.28,
          phase: Math.random() * Math.PI * 2,
          swayPhase: Math.random() * Math.PI * 2,
          scale: 0.9 + Math.random() * 0.2,
          archetype: arch,
          seatedBias: tier === 0 ? 0.25 : 0.45 + Math.random() * 0.45,
          hasCap: (s + tier) % 3 === 0,
          propIndex,
        });
      }
    }
  }

  const crowdCount = crowdSeeds.length;
  const maxAniso = textures.armorWeave.anisotropy || 4;
  const { faceTex, jacketTex } = createCrowdTextures(maxAniso);

  // Sculpted Anatomical Lower Body (thighs + shins + shoes, grounded at y=0)
  const legParts: THREE.BufferGeometry[] = [];
  for (const sx of [-0.095, 0.095]) {
    const thigh = new THREE.CylinderGeometry(0.072, 0.058, 0.34, 8);
    thigh.translate(sx, 0.46, 0.01);
    const shin = new THREE.CylinderGeometry(0.056, 0.044, 0.32, 8);
    shin.translate(sx, 0.19, 0.0);
    const shoe = new THREE.BoxGeometry(0.095, 0.065, 0.16);
    shoe.translate(sx, 0.032, 0.035);
    legParts.push(prepGeo(thigh), prepGeo(shin), prepGeo(shoe));
    thigh.dispose();
    shin.dispose();
    shoe.dispose();
  }
  const hipGeo = new THREE.CylinderGeometry(0.155, 0.15, 0.14, 10);
  hipGeo.scale(1.18, 1, 0.72);
  hipGeo.translate(0, 0.64, 0);
  legParts.push(prepGeo(hipGeo));
  hipGeo.dispose();
  const legsGeo = mergeGeometries(legParts, false)!;
  legParts.forEach((p) => p.dispose());

  // Sculpted Upper Torso + Shoulders + Neck (facing +Z for jacket placket alignment)
  const chestGeo = new THREE.CylinderGeometry(0.185, 0.145, 0.46, 12);
  chestGeo.rotateY(Math.PI);
  chestGeo.scale(1.18, 1, 0.7);
  chestGeo.translate(0, 0.92, 0);
  const shouldersGeo = new THREE.SphereGeometry(0.19, 10, 8);
  shouldersGeo.scale(1.32, 0.46, 0.72);
  shouldersGeo.translate(0, 1.12, 0);
  const neckGeo = new THREE.CylinderGeometry(0.058, 0.068, 0.12, 8);
  neckGeo.translate(0, 1.2, 0);
  const torsoGeo = mergeGeometries([prepGeo(chestGeo), prepGeo(shouldersGeo), prepGeo(neckGeo)], false)!;
  chestGeo.dispose();
  shouldersGeo.dispose();
  neckGeo.dispose();

  // Anatomical Head (face UV centered at +Z)
  const headGeo = new THREE.SphereGeometry(0.128, 14, 12, -Math.PI / 2);
  headGeo.scale(0.88, 1.07, 0.96);

  // Hair Crown & Baseball Cap Geometries (sized cleanly outside head cranium)
  const hairCrown = new THREE.SphereGeometry(0.142, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
  hairCrown.scale(0.93, 1.12, 1.02);
  hairCrown.translate(0, 0.01, -0.005);
  const hairNape = new THREE.SphereGeometry(0.108, 8, 6);
  hairNape.scale(1.0, 1.15, 0.65);
  hairNape.translate(0, -0.025, -0.068);
  const hairGeo = mergeGeometries([prepGeo(hairCrown), prepGeo(hairNape)], false)!;
  hairCrown.dispose();
  hairNape.dispose();

  const capDome = new THREE.SphereGeometry(0.144, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
  capDome.scale(0.94, 1.1, 1.04);
  capDome.translate(0, 0.014, 0);
  const capBrim = new THREE.CylinderGeometry(0.135, 0.145, 0.018, 10, 1, false, -Math.PI * 0.4, Math.PI * 0.8);
  capBrim.translate(0, 0.03, 0.098);
  const capGeo = mergeGeometries([prepGeo(capDome), prepGeo(capBrim)], false)!;
  capDome.dispose();
  capBrim.dispose();

  // Articulated Arm Geometry (pivoted at shoulder joint y=0, extending downward along -Y)
  const upperArm = new THREE.CylinderGeometry(0.054, 0.044, 0.27, 8);
  upperArm.translate(0, -0.135, 0);
  const foreArm = new THREE.CylinderGeometry(0.043, 0.035, 0.25, 8);
  foreArm.rotateX(-0.48);
  foreArm.translate(0, -0.35, 0.055);
  const handMesh = new THREE.SphereGeometry(0.042, 8, 6);
  handMesh.translate(0, -0.46, 0.11);
  const armGeo = mergeGeometries([prepGeo(upperArm), prepGeo(foreArm), prepGeo(handMesh)], false)!;
  upperArm.dispose();
  foreArm.dispose();
  handMesh.dispose();

  // Handheld Props: Smartphone & Team Pennant Flag
  const phoneGeo = new THREE.BoxGeometry(0.085, 0.14, 0.016);
  const stickGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6);
  stickGeo.translate(0, 0.21, 0);
  const flagGeo = new THREE.BoxGeometry(0.012, 0.18, 0.28);
  flagGeo.translate(0, 0.34, 0.14);
  const pennantGeo = mergeGeometries([prepGeo(stickGeo), prepGeo(flagGeo)], false)!;
  stickGeo.dispose();
  flagGeo.dispose();

  geometries.push(legsGeo, torsoGeo, headGeo, hairGeo, capGeo, armGeo, phoneGeo, pennantGeo);

  const legsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.03 });
  const torsoMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: jacketTex,
    roughness: 0.82,
    metalness: 0.04,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: faceTex,
    roughness: 0.62,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.06 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68, metalness: 0.08 });
  const armMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.05 });
  const phoneMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const pennantMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.65,
    metalness: 0.05,
  });
  materials.push(legsMat, torsoMat, headMat, hairMat, capMat, armMat, phoneMat, pennantMat);

  const crowdLegs = new THREE.InstancedMesh(legsGeo, legsMat, crowdCount);
  const crowdTorsos = new THREE.InstancedMesh(torsoGeo, torsoMat, crowdCount);
  const crowdHeads = new THREE.InstancedMesh(headGeo, headMat, crowdCount);
  const crowdHair = new THREE.InstancedMesh(hairGeo, hairMat, crowdCount);
  const crowdCaps = new THREE.InstancedMesh(capGeo, capMat, crowdCount);
  const crowdLeftArms = new THREE.InstancedMesh(armGeo, armMat, crowdCount);
  const crowdRightArms = new THREE.InstancedMesh(armGeo, armMat, crowdCount);
  const crowdPhones = new THREE.InstancedMesh(phoneGeo, phoneMat, Math.max(1, phoneCount));
  const crowdPennants = new THREE.InstancedMesh(pennantGeo, pennantMat, Math.max(1, pennantCount));

  [
    crowdLegs,
    crowdTorsos,
    crowdHeads,
    crowdHair,
    crowdCaps,
    crowdLeftArms,
    crowdRightArms,
    crowdPhones,
    crowdPennants,
  ].forEach((m) => {
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  });

  const jacketPalette = [
    0xb91c1c, 0x1d4ed8, 0xd97706, 0x047857, 0xdbeafe, 0x475569, 0x7c3aed, 0x334155, 0x0f766e, 0xe2e8f0,
  ];
  const pantsPalette = [0x1e293b, 0x27272a, 0x334155, 0x3f3a34, 0x172554];
  const skinPalette = [0xf5cfa0, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xb57445];
  const hairPalette = [0x18181b, 0x3b2416, 0x6b3e26, 0xb88b4a, 0x8c3b2b, 0x94a3b8];
  const capPalette = [0xef4444, 0xf59e0b, 0x2563eb, 0x18181b, 0x10b981];

  for (let i = 0; i < crowdCount; i++) {
    const c = crowdSeeds[i];
    const jHex = jacketPalette[(i * 7 + (c.hasCap ? 3 : 0)) % jacketPalette.length];
    const pHex = pantsPalette[(i * 3) % pantsPalette.length];
    const sHex = skinPalette[(i * 5) % skinPalette.length];
    const hHex = hairPalette[(i * 11) % hairPalette.length];
    const capHex = capPalette[i % capPalette.length];

    crowdLegs.setColorAt(i, _color.setHex(pHex));
    crowdTorsos.setColorAt(i, _color.setHex(jHex));
    crowdHeads.setColorAt(i, _color.setHex(sHex));
    crowdHair.setColorAt(i, _color.setHex(hHex));
    crowdCaps.setColorAt(i, _color.setHex(capHex));
    crowdLeftArms.setColorAt(i, _color.setHex(jHex));
    crowdRightArms.setColorAt(i, _color.setHex(jHex));

    if (c.archetype === 'pennant' && c.propIndex >= 0) {
      crowdPennants.setColorAt(c.propIndex, _color.setHex(capHex));
    }
  }
  [
    crowdLegs,
    crowdTorsos,
    crowdHeads,
    crowdHair,
    crowdCaps,
    crowdLeftArms,
    crowdRightArms,
    crowdPennants,
  ].forEach((m) => {
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  group.add(
    crowdLegs,
    crowdTorsos,
    crowdHeads,
    crowdHair,
    crowdCaps,
    crowdLeftArms,
    crowdRightArms,
    crowdPhones,
    crowdPennants,
  );

  const updateCrowdTransforms = (time: number, excitement: number) => {
    const jumpAmp = 0.02 + excitement * 0.22;
    const speed = 2.0 + excitement * 4.8;

    for (let i = 0; i < crowdCount; i++) {
      const c = crowdSeeds[i];
      const sc = c.scale;
      const wave = Math.max(0, Math.sin(time * speed + c.phase));
      // Seated spectators stand up excitedly when arena action spikes
      const standBlend = Math.min(1, Math.max(0, 1 - c.seatedBias + excitement * 1.15));
      const seatSink = (1 - standBlend) * 0.2;
      const yOff = wave * jumpAmp * (0.35 + standBlend * 0.65) - seatSink;

      const sway = Math.sin(time * 1.3 + c.swayPhase) * 0.045;
      const forwardLean = 0.06 + excitement * 0.14 + Math.sin(time * 2.1 + c.phase) * 0.04;
      const headLookYaw = c.yaw + Math.sin(time * 0.85 + c.swayPhase) * 0.18;
      const headPitch = -0.08 + Math.sin(time * 2.4 + c.phase) * (0.04 + excitement * 0.08);

      // 1. Legs (compress slightly when seated on bench)
      _dummy.position.set(c.x, c.baseY + Math.max(0, yOff), c.z);
      _dummy.rotation.set(0, c.yaw, 0);
      _dummy.scale.set(sc, sc * (1 - (1 - standBlend) * 0.28), sc);
      _dummy.updateMatrix();
      crowdLegs.setMatrixAt(i, _dummy.matrix);

      // 2. Torso
      _dummy.position.set(c.x, c.baseY + yOff, c.z);
      _dummy.rotation.set(forwardLean, c.yaw + sway, 0);
      _dummy.scale.setScalar(sc);
      _dummy.updateMatrix();
      crowdTorsos.setMatrixAt(i, _dummy.matrix);

      // 3. Head (follows arena action naturally)
      const headY = c.baseY + 1.34 * sc + yOff;
      const fwdX = Math.sin(c.yaw) * forwardLean * 0.55 * sc;
      const fwdZ = Math.cos(c.yaw) * forwardLean * 0.55 * sc;
      _dummy.position.set(c.x + fwdX, headY, c.z + fwdZ);
      _dummy.rotation.set(headPitch, headLookYaw, sway * 0.6);
      _dummy.scale.setScalar(sc);
      _dummy.updateMatrix();
      crowdHeads.setMatrixAt(i, _dummy.matrix);

      // 4. Hair or Cap
      if (c.hasCap) {
        _dummy.scale.setScalar(sc);
        crowdCaps.setMatrixAt(i, _dummy.matrix);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        crowdHair.setMatrixAt(i, _dummy.matrix);
      } else {
        _dummy.scale.setScalar(sc);
        crowdHair.setMatrixAt(i, _dummy.matrix);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        crowdCaps.setMatrixAt(i, _dummy.matrix);
      }

      // 5. Left & Right Articulated Arms driven by spectator archetype
      const rightAxisX = Math.cos(c.yaw);
      const rightAxisZ = -Math.sin(c.yaw);
      const shoulderY = c.baseY + 1.1 * sc + yOff;
      const shoulderOffset = 0.255 * sc;

      let lPitch = -0.25;
      let lRoll = 0.12;
      let rPitch = -0.25;
      let rRoll = -0.12;

      if (c.archetype === 'cheer') {
        const pump = Math.sin(time * (4.2 + excitement * 4.5) + c.phase) * (0.35 + excitement * 0.45);
        lPitch = -2.2 - pump;
        rPitch = -2.2 + pump * 0.7;
        lRoll = 0.35;
        rRoll = -0.35;
      } else if (c.archetype === 'clap') {
        const clapBeat = Math.abs(Math.sin(time * (5.5 + excitement * 5.0) + c.phase));
        lPitch = -1.15;
        rPitch = -1.15;
        lRoll = -0.35 + clapBeat * 0.28;
        rRoll = 0.35 - clapBeat * 0.28;
      } else if (c.archetype === 'phone') {
        lPitch = -0.35;
        rPitch = -1.72 + Math.sin(time * 1.4 + c.phase) * 0.08;
        rRoll = 0.14;
      } else if (c.archetype === 'pennant') {
        const waveFlag = Math.sin(time * (4.8 + excitement * 4.0) + c.phase) * 0.45;
        lPitch = -0.45 - excitement * 0.8;
        rPitch = -2.05 + waveFlag * 0.5;
        rRoll = -0.25 + waveFlag * 0.35;
      } else {
        // Watch / leaning intently
        lPitch = -0.55 - excitement * 0.9;
        rPitch = -0.55 - excitement * 0.9;
        lRoll = 0.16;
        rRoll = -0.16;
      }

      // Left arm (+rightAxis in viewer right or -rightAxis depending on facing)
      _dummy.position.set(
        c.x + fwdX - rightAxisX * shoulderOffset,
        shoulderY,
        c.z + fwdZ - rightAxisZ * shoulderOffset,
      );
      _dummy.rotation.order = 'YXZ';
      _dummy.rotation.set(lPitch, c.yaw, lRoll);
      _dummy.scale.setScalar(sc);
      _dummy.updateMatrix();
      crowdLeftArms.setMatrixAt(i, _dummy.matrix);

      // Right arm
      _dummy.position.set(
        c.x + fwdX + rightAxisX * shoulderOffset,
        shoulderY,
        c.z + fwdZ + rightAxisZ * shoulderOffset,
      );
      _dummy.rotation.order = 'YXZ';
      _dummy.rotation.set(rPitch, c.yaw, rRoll);
      _dummy.scale.setScalar(sc);
      _dummy.updateMatrix();
      crowdRightArms.setMatrixAt(i, _dummy.matrix);

      // 6. Handheld Phones & Pennants attached near right hand
      if (c.archetype === 'phone' && c.propIndex >= 0) {
        const fx = Math.sin(c.yaw);
        const fz = Math.cos(c.yaw);
        _dummy.position.set(
          c.x + fwdX + rightAxisX * (shoulderOffset * 0.72) + fx * 0.42 * sc,
          shoulderY + 0.18 * sc,
          c.z + fwdZ + rightAxisZ * (shoulderOffset * 0.72) + fz * 0.42 * sc,
        );
        _dummy.rotation.order = 'YXZ';
        _dummy.rotation.set(-0.2, c.yaw, 0);
        _dummy.scale.setScalar(sc);
        _dummy.updateMatrix();
        crowdPhones.setMatrixAt(c.propIndex, _dummy.matrix);
      } else if (c.archetype === 'pennant' && c.propIndex >= 0) {
        const fx = Math.sin(c.yaw);
        const fz = Math.cos(c.yaw);
        const waveFlag = Math.sin(time * (4.8 + excitement * 4.0) + c.phase) * 0.38;
        _dummy.position.set(
          c.x + fwdX + rightAxisX * (shoulderOffset * 1.1) + fx * 0.25 * sc,
          shoulderY + 0.34 * sc,
          c.z + fwdZ + rightAxisZ * (shoulderOffset * 1.1) + fz * 0.25 * sc,
        );
        _dummy.rotation.order = 'YXZ';
        _dummy.rotation.set(0.25 + waveFlag * 0.4, c.yaw, waveFlag);
        _dummy.scale.setScalar(sc);
        _dummy.updateMatrix();
        crowdPennants.setMatrixAt(c.propIndex, _dummy.matrix);
      }
    }

    _dummy.rotation.order = 'XYZ';
    crowdLegs.instanceMatrix.needsUpdate = true;
    crowdTorsos.instanceMatrix.needsUpdate = true;
    crowdHeads.instanceMatrix.needsUpdate = true;
    crowdHair.instanceMatrix.needsUpdate = true;
    crowdCaps.instanceMatrix.needsUpdate = true;
    crowdLeftArms.instanceMatrix.needsUpdate = true;
    crowdRightArms.instanceMatrix.needsUpdate = true;
    if (phoneCount > 0) crowdPhones.instanceMatrix.needsUpdate = true;
    if (pennantCount > 0) crowdPennants.instanceMatrix.needsUpdate = true;
  };
  updateCrowdTransforms(0, 0.15);

  const disposeCrowdTextures = () => {
    faceTex.dispose();
    jacketTex.dispose();
    brandTex.dispose();
    devLogoTex.dispose();
  };

  // 7. Hazard & Destructible Prop Registries
  const hazardMeshes = new Map<string, HazardMeshEntry>();
  const propMeshes = new Map<string, THREE.Group>();

  const crateGeo = new THREE.BoxGeometry(1.3, 1.1, 1.3);
  const crateFrameGeo = new THREE.BoxGeometry(1.38, 0.2, 1.38);
  const barrelGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.35, 16);
  const barrelBandGeo = new THREE.CylinderGeometry(0.57, 0.57, 0.24, 16);
  const pillarGeo = new THREE.CylinderGeometry(0.82, 0.96, 2.3, 8);
  const pillarCapGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.22, 8);
  const pickupCoreGeo = new THREE.OctahedronGeometry(0.52, 0);
  const pickupRingGeo = new THREE.TorusGeometry(0.65, 0.06, 8, 24);
  pickupRingGeo.rotateX(Math.PI / 2);

  const crateMat = new THREE.MeshStandardMaterial({ color: 0x926239, roughness: 0.72, metalness: 0.15 });
  const crateTrimMat = new THREE.MeshPhysicalMaterial({
    color: 0x475569,
    roughness: 0.25,
    metalness: 0.9,
    envMapIntensity: 1.4,
  });
  const barrelMat = new THREE.MeshPhysicalMaterial({
    color: 0xdc2626,
    roughness: 0.26,
    metalness: 0.75,
    clearcoat: 0.5,
    envMapIntensity: 1.4,
  });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.82, metalness: 0.18 });
  const repairMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.4,
  });
  const energyMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.4,
  });
  const overchargeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xf97316,
    emissiveIntensity: 1.7,
    roughness: 0.18,
    metalness: 0.5,
  });
  const shieldPickupMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0xa855f7,
    emissiveIntensity: 1.6,
    roughness: 0.18,
    metalness: 0.5,
  });

  geometries.push(
    crateGeo,
    crateFrameGeo,
    barrelGeo,
    barrelBandGeo,
    pillarGeo,
    pillarCapGeo,
    pickupCoreGeo,
    pickupRingGeo,
  );
  materials.push(crateMat, crateTrimMat, barrelMat, pillarMat, repairMat, energyMat, overchargeMat, shieldPickupMat);

  const sawBladeGeo = new THREE.CylinderGeometry(1.35, 1.35, 0.1, 18);
  const sawBaseGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.06, 20);
  const flipPadGeo = new THREE.BoxGeometry(2.6, 0.14, 2.6);
  const empRingGeo = new THREE.RingGeometry(2.4, 2.9, 32);
  empRingGeo.rotateX(-Math.PI / 2);

  // Hydraulic Crusher Shared Geometries (overhead gantry + octagonal anvil ram + impact pad)
  const crusherPadGeo = new THREE.CylinderGeometry(1.82, 1.94, 0.07, 24);
  const crusherWarnRingGeo = new THREE.RingGeometry(1.74, 2.02, 32);
  crusherWarnRingGeo.rotateX(-Math.PI / 2);
  const crusherPillarGeo = new THREE.BoxGeometry(0.28, 5.1, 0.44);
  const crusherFootGeo = new THREE.BoxGeometry(0.46, 0.22, 0.68);
  const crusherBeamGeo = new THREE.BoxGeometry(4.9, 0.38, 0.62);
  const crusherSleeveGeo = new THREE.CylinderGeometry(0.36, 0.42, 1.55, 14);
  const crusherPistonGeo = new THREE.CylinderGeometry(0.2, 0.2, 3.3, 14);
  const crusherAnvilGeo = new THREE.CylinderGeometry(1.48, 1.62, 0.78, 8);
  const crusherFaceGeo = new THREE.CylinderGeometry(1.56, 1.58, 0.14, 8);
  const crusherCollarGeo = new THREE.TorusGeometry(1.52, 0.065, 8, 24);
  crusherCollarGeo.rotateX(Math.PI / 2);

  // Spinning Floor Blade Shared Geometries (recessed hatch + rising swept tungsten rotor bar)
  const sbladePitGeo = new THREE.CylinderGeometry(1.12, 1.2, 0.06, 24);
  const sbladeSweepRingGeo = new THREE.RingGeometry(2.68, 2.94, 40);
  sbladeSweepRingGeo.rotateX(-Math.PI / 2);
  const sbladeHubGeo = new THREE.CylinderGeometry(0.64, 0.76, 0.42, 16);
  const sbladeCapGeo = new THREE.CylinderGeometry(0.42, 0.62, 0.16, 16);
  const sbladeBarGeo = new THREE.BoxGeometry(5.68, 0.14, 0.38);
  const sbladeEdgeGeo = new THREE.BoxGeometry(5.76, 0.06, 0.46);
  const sbladeTipGeo = new THREE.BoxGeometry(0.42, 0.16, 0.48);

  geometries.push(
    sawBladeGeo,
    sawBaseGeo,
    flipPadGeo,
    empRingGeo,
    crusherPadGeo,
    crusherWarnRingGeo,
    crusherPillarGeo,
    crusherFootGeo,
    crusherBeamGeo,
    crusherSleeveGeo,
    crusherPistonGeo,
    crusherAnvilGeo,
    crusherFaceGeo,
    crusherCollarGeo,
    sbladePitGeo,
    sbladeSweepRingGeo,
    sbladeHubGeo,
    sbladeCapGeo,
    sbladeBarGeo,
    sbladeEdgeGeo,
    sbladeTipGeo,
  );

  const sawMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    roughness: 0.14,
    metalness: 0.96,
    envMapIntensity: 1.7,
    clearcoat: 0.6,
  });
  const sawSlotMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8, metalness: 0.3 });
  const gantrySteelMat = new THREE.MeshStandardMaterial({
    color: 0x262f3d,
    roughness: 0.42,
    metalness: 0.82,
    envMapIntensity: 1.2,
  });
  const chromePistonMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    roughness: 0.1,
    metalness: 0.98,
    envMapIntensity: 1.8,
  });
  const hazardBladeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.14,
    metalness: 0.96,
    clearcoat: 0.7,
    envMapIntensity: 1.75,
  });
  const hazardTipMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.75,
    roughness: 0.28,
    metalness: 0.55,
  });
  materials.push(sawMat, sawSlotMat, gantrySteelMat, chromePistonMat, hazardBladeMat, hazardTipMat);

  // Drop pit, lightning strike, bomb drop, oil slick & laser grid shared geometries
  const pitHoleGeo = new THREE.CircleGeometry(1.0, 32);
  pitHoleGeo.rotateX(-Math.PI / 2);
  const pitRimGeo = new THREE.RingGeometry(1.0, 1.18, 32);
  pitRimGeo.rotateX(-Math.PI / 2);
  const pitDoorGeo = new THREE.CircleGeometry(1.0, 32, 0, Math.PI);
  pitDoorGeo.rotateX(-Math.PI / 2);
  const boltGeo = new THREE.CylinderGeometry(0.12, 0.35, 16, 6, 8, true);
  const targetRingGeo = new THREE.RingGeometry(0.85, 1.0, 40);
  targetRingGeo.rotateX(-Math.PI / 2);
  const bombBodyGeo = new THREE.CylinderGeometry(0.32, 0.22, 1.05, 12);
  const bombNoseGeo = new THREE.SphereGeometry(0.32, 12, 10);
  const bombFinGeo = new THREE.BoxGeometry(0.75, 0.32, 0.06);
  const oilDiscGeo = new THREE.CircleGeometry(1.0, 32);
  oilDiscGeo.rotateX(-Math.PI / 2);
  const laserTurretGeo = new THREE.CylinderGeometry(0.38, 0.52, 0.62, 12);
  const laserBeamBarGeo = new THREE.CylinderGeometry(0.055, 0.055, 1.0, 8);
  laserBeamBarGeo.rotateZ(Math.PI / 2);
  geometries.push(
    pitHoleGeo,
    pitRimGeo,
    pitDoorGeo,
    boltGeo,
    targetRingGeo,
    bombBodyGeo,
    bombNoseGeo,
    bombFinGeo,
    oilDiscGeo,
    laserTurretGeo,
    laserBeamBarGeo,
  );

  function ensurePropMesh(prop: DestructibleProp): THREE.Group {
    let pGroup = propMeshes.get(prop.id);
    if (pGroup) return pGroup;

    pGroup = new THREE.Group();
    if (prop.kind === 'crate') {
      const box = new THREE.Mesh(crateGeo, crateMat);
      box.position.y = 0.55;
      box.castShadow = castShadow;
      box.receiveShadow = true;
      const topRim = new THREE.Mesh(crateFrameGeo, crateTrimMat);
      topRim.position.y = 1.02;
      const botRim = new THREE.Mesh(crateFrameGeo, crateTrimMat);
      botRim.position.y = 0.1;
      pGroup.add(box, topRim, botRim);
    } else if (prop.kind === 'barrel') {
      const cyl = new THREE.Mesh(barrelGeo, barrelMat);
      cyl.position.y = 0.675;
      cyl.castShadow = castShadow;
      const band = new THREE.Mesh(barrelBandGeo, bumperMat);
      band.position.y = 0.68;
      pGroup.add(cyl, band);
    } else if (prop.kind === 'pillar') {
      const col = new THREE.Mesh(pillarGeo, pillarMat);
      col.position.y = 1.15;
      col.castShadow = castShadow;
      col.receiveShadow = true;
      const cap = new THREE.Mesh(pillarCapGeo, crateTrimMat);
      cap.position.y = 2.3;
      const base = new THREE.Mesh(pillarCapGeo, crateTrimMat);
      base.position.y = 0.11;
      pGroup.add(col, cap, base);
    } else if (
      prop.kind === 'pickup_repair' ||
      prop.kind === 'pickup_energy' ||
      prop.kind === 'pickup_overcharge' ||
      prop.kind === 'pickup_shield'
    ) {
      const mat =
        prop.kind === 'pickup_repair'
          ? repairMat
          : prop.kind === 'pickup_energy'
            ? energyMat
            : prop.kind === 'pickup_overcharge'
              ? overchargeMat
              : shieldPickupMat;
      const core = new THREE.Mesh(pickupCoreGeo, mat);
      core.position.y = 0.72;
      const ring = new THREE.Mesh(pickupRingGeo, mat);
      ring.position.y = 0.14;
      pGroup.add(core, ring);
    } else if (prop.kind === 'ramp') {
      // Sloped steel launch ramp wedge with glowing directional chevrons
      const rampShape = new THREE.Shape();
      rampShape.moveTo(-1.35, 0);
      rampShape.lineTo(1.35, 0);
      rampShape.lineTo(1.35, 0.68);
      rampShape.lineTo(-1.35, 0.06);
      rampShape.closePath();
      const rampGeo = new THREE.ExtrudeGeometry(rampShape, {
        depth: 2.2,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.04,
        bevelSegments: 2,
      });
      rampGeo.translate(0, 0, -1.1);
      rampGeo.rotateY(-Math.PI / 2);
      geometries.push(rampGeo);
      const rampMesh = new THREE.Mesh(rampGeo, crateTrimMat);
      rampMesh.castShadow = castShadow;
      rampMesh.receiveShadow = true;
      const stripGeo = new THREE.BoxGeometry(2.1, 0.06, 0.22);
      geometries.push(stripGeo);
      const strip = new THREE.Mesh(stripGeo, bumperMat);
      strip.position.set(0, 0.68, 1.22);
      pGroup.add(rampMesh, strip);
      pGroup.rotation.y = prop.yaw ?? 0;
    } else if (prop.kind === 'debris_chunk') {
      // Persistent shattered obstacle rubble chunk on the arena floor that bumps/snags bots
      const chunkGeo = new THREE.DodecahedronGeometry(prop.radius * 0.85, 0);
      geometries.push(chunkGeo);
      const chunkMat = new THREE.MeshStandardMaterial({
        color: prop.color ? new THREE.Color(prop.color) : new THREE.Color(0x64748b),
        roughness: 0.82,
        metalness: 0.35,
      });
      materials.push(chunkMat);
      const mainChunk = new THREE.Mesh(chunkGeo, chunkMat);
      mainChunk.scale.set(1.25, 0.52, 1.05);
      mainChunk.position.y = 0.18;
      mainChunk.rotation.set(0.3, prop.yaw ?? 0.7, 0.2);
      mainChunk.castShadow = castShadow;
      mainChunk.receiveShadow = true;

      const shardGeo = new THREE.BoxGeometry(prop.radius * 1.1, 0.14, prop.radius * 0.55);
      geometries.push(shardGeo);
      const shard = new THREE.Mesh(shardGeo, crateTrimMat);
      shard.position.set(0.18, 0.09, -0.14);
      shard.rotation.set(0.15, -0.5, 0.22);
      pGroup.add(mainChunk, shard);
    }

    pGroup.position.set(prop.x, prop.y, prop.z);
    group.add(pGroup);
    propMeshes.set(prop.id, pGroup);
    return pGroup;
  }

  function ensureHazardMesh(h: HazardState): HazardMeshEntry {
    if (hazardMeshes.has(h.id)) return hazardMeshes.get(h.id)!;
    const hRoot = new THREE.Group();
    hRoot.position.set(h.x, 0, h.z);

    if (h.kind === 'saw') {
      const slot = new THREE.Mesh(sawBaseGeo, sawSlotMat);
      slot.position.y = 0.03;
      const blade = new THREE.Mesh(sawBladeGeo, sawMat);
      blade.position.y = 0.14;
      hRoot.add(slot, blade);
      group.add(hRoot);
      const entry: HazardMeshEntry = { root: hRoot, movingPart: blade };
      hazardMeshes.set(h.id, entry);
      return entry;
    }

    if (h.kind === 'flipper_pad') {
      const pad = new THREE.Mesh(flipPadGeo, bumperMat);
      pad.position.y = 0.07;
      hRoot.add(pad);
      group.add(hRoot);
      const entry: HazardMeshEntry = { root: hRoot, movingPart: pad };
      hazardMeshes.set(h.id, entry);
      return entry;
    }

    if (h.kind === 'crusher') {
      const pad = new THREE.Mesh(crusherPadGeo, sawSlotMat);
      pad.position.y = 0.035;
      pad.receiveShadow = true;

      const warnRingMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      });
      materials.push(warnRingMat, glowMat);

      const warnRing = new THREE.Mesh(crusherWarnRingGeo, warnRingMat);
      warnRing.position.y = 0.04;

      // Overhead steel hydraulic gantry frame spanning outside impact pad
      const leftCol = new THREE.Mesh(crusherPillarGeo, gantrySteelMat);
      leftCol.position.set(-2.22, 2.55, 0);
      leftCol.castShadow = castShadow;
      const rightCol = new THREE.Mesh(crusherPillarGeo, gantrySteelMat);
      rightCol.position.set(2.22, 2.55, 0);
      rightCol.castShadow = castShadow;
      const leftFoot = new THREE.Mesh(crusherFootGeo, gantrySteelMat);
      leftFoot.position.set(-2.22, 0.11, 0);
      const rightFoot = new THREE.Mesh(crusherFootGeo, gantrySteelMat);
      rightFoot.position.set(2.22, 0.11, 0);
      const topBeam = new THREE.Mesh(crusherBeamGeo, gantrySteelMat);
      topBeam.position.set(0, 5.15, 0);
      topBeam.castShadow = castShadow;
      const sleeve = new THREE.Mesh(crusherSleeveGeo, bumperMat);
      sleeve.position.set(0, 4.4, 0);

      // Descending Anvil Hammer Ram Assembly (y=0.04 on floor, y=3.9 raised)
      const ramGroup = new THREE.Group();
      ramGroup.position.y = 3.9;
      const piston = new THREE.Mesh(crusherPistonGeo, chromePistonMat);
      piston.position.y = 2.05;
      const anvil = new THREE.Mesh(crusherAnvilGeo, gantrySteelMat);
      anvil.position.y = 0.48;
      anvil.castShadow = castShadow;
      const strikeFace = new THREE.Mesh(crusherFaceGeo, chromePistonMat);
      strikeFace.position.y = 0.07;
      const collar = new THREE.Mesh(crusherCollarGeo, glowMat);
      collar.position.y = 0.82;
      ramGroup.add(piston, anvil, strikeFace, collar);

      hRoot.add(pad, warnRing, leftCol, rightCol, leftFoot, rightFoot, topBeam, sleeve, ramGroup);
      group.add(hRoot);
      const entry: HazardMeshEntry = {
        root: hRoot,
        movingPart: ramGroup,
        ringMat: warnRingMat,
        emissiveMat: glowMat,
      };
      hazardMeshes.set(h.id, entry);
      return entry;
    }

    if (h.kind === 'spinner_blade') {
      const pit = new THREE.Mesh(sbladePitGeo, sawSlotMat);
      pit.position.y = 0.03;

      const sweepRingMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const hubGlowMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 0.5,
        roughness: 0.25,
      });
      materials.push(sweepRingMat, hubGlowMat);

      const sweepRing = new THREE.Mesh(sbladeSweepRingGeo, sweepRingMat);
      sweepRing.position.y = 0.035;
      const ringScale = (h.armLength ?? 2.85) / 2.85;
      sweepRing.scale.setScalar(ringScale);

      const rotorGroup = new THREE.Group();
      rotorGroup.position.y = -0.38;
      const hub = new THREE.Mesh(sbladeHubGeo, gantrySteelMat);
      hub.position.y = 0.21;
      const cap = new THREE.Mesh(sbladeCapGeo, hubGlowMat);
      cap.position.y = 0.48;
      const bar = new THREE.Mesh(sbladeBarGeo, hazardBladeMat);
      bar.position.y = 0.24;
      bar.scale.x = ringScale;
      bar.castShadow = castShadow;
      const edge = new THREE.Mesh(sbladeEdgeGeo, chromePistonMat);
      edge.position.y = 0.24;
      edge.scale.x = ringScale;
      const tipPos = new THREE.Mesh(sbladeTipGeo, hazardTipMat);
      tipPos.position.set(2.75 * ringScale, 0.24, 0);
      const tipNeg = new THREE.Mesh(sbladeTipGeo, hazardTipMat);
      tipNeg.position.set(-2.75 * ringScale, 0.24, 0);
      rotorGroup.add(hub, cap, bar, edge, tipPos, tipNeg);

      hRoot.add(pit, sweepRing, rotorGroup);
      group.add(hRoot);
      const entry: HazardMeshEntry = {
        root: hRoot,
        movingPart: rotorGroup,
        ringMat: sweepRingMat,
        emissiveMat: hubGlowMat,
      };
      hazardMeshes.set(h.id, entry);
      return entry;
    }

    if (h.kind === 'pit') {
      const holeMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
      const glowRimMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const doorMat = new THREE.MeshStandardMaterial({ map: textures.hazardStripe, roughness: 0.4, metalness: 0.6 });
      materials.push(holeMat, glowRimMat, doorMat);
      const r = h.radius;
      const hole = new THREE.Mesh(pitHoleGeo, holeMat);
      hole.scale.setScalar(r);
      hole.position.y = 0.012;
      const rim = new THREE.Mesh(pitRimGeo, glowRimMat);
      rim.scale.setScalar(r);
      rim.position.y = 0.02;
      const doors = new THREE.Group();
      const doorA = new THREE.Mesh(pitDoorGeo, doorMat);
      doorA.scale.setScalar(r);
      const doorB = new THREE.Mesh(pitDoorGeo, doorMat);
      doorB.scale.setScalar(r);
      doorB.rotation.y = Math.PI;
      doors.add(doorA, doorB);
      doors.position.y = 0.03;
      hRoot.add(hole, rim, doors);
      group.add(hRoot);
      const entry: HazardMeshEntry = { root: hRoot, movingPart: doors, ringMat: glowRimMat };
      hazardMeshes.set(h.id, entry);
      return entry;
    }

    if (h.kind === 'lightning') {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const boltMat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      materials.push(ringMat, boltMat);
      const ring = new THREE.Mesh(targetRingGeo, ringMat);
      ring.scale.setScalar(h.radius);
      ring.position.y = 0.03;
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.y = 8;
      hRoot.add(ring, bolt);
      group.add(hRoot);
      const entry: HazardMeshEntry = { root: hRoot, movingPart: bolt, ringMat };
      hazardMeshes.set(h.id, entry);
      return entry;
    }

    if (h.kind === 'bomb_drop') {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const bombGlowMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xf97316,
        emissiveIntensity: 1.5,
        roughness: 0.3,
        metalness: 0.6,
      });
      materials.push(ringMat, bombGlowMat);

      const ring = new THREE.Mesh(targetRingGeo, ringMat);
      ring.scale.setScalar(h.radius);
      ring.position.y = 0.035;

      const innerRing = new THREE.Mesh(targetRingGeo, ringMat);
      innerRing.scale.setScalar(h.radius * 0.48);
      innerRing.position.y = 0.038;

      const bombGroup = new THREE.Group();
      bombGroup.position.y = 14;
      const body = new THREE.Mesh(bombBodyGeo, gantrySteelMat);
      const nose = new THREE.Mesh(bombNoseGeo, bombGlowMat);
      nose.position.y = -0.52;
      const finA = new THREE.Mesh(bombFinGeo, hazardTipMat);
      finA.position.y = 0.42;
      const finB = new THREE.Mesh(bombFinGeo, hazardTipMat);
      finB.position.y = 0.42;
      finB.rotation.y = Math.PI / 2;
      bombGroup.add(body, nose, finA, finB);

      hRoot.add(ring, innerRing, bombGroup);
      group.add(hRoot);
      const entry: HazardMeshEntry = { root: hRoot, movingPart: bombGroup, ringMat, emissiveMat: bombGlowMat };
      hazardMeshes.set(h.id, entry);
      return entry;
    }

    if (h.kind === 'oil_slick') {
      const oilMat = new THREE.MeshPhysicalMaterial({
        color: 0x090b10,
        emissive: 0x1e1b4b,
        emissiveIntensity: 0.25,
        roughness: 0.06,
        metalness: 0.92,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        iridescence: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const fireRingMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      materials.push(oilMat, fireRingMat);

      const puddle = new THREE.Mesh(oilDiscGeo, oilMat);
      puddle.scale.setScalar(h.radius);
      puddle.position.y = 0.022;

      const fireRing = new THREE.Mesh(targetRingGeo, fireRingMat);
      fireRing.scale.setScalar(h.radius * 0.95);
      fireRing.position.y = 0.08;

      hRoot.add(puddle, fireRing);
      group.add(hRoot);
      const entry: HazardMeshEntry = { root: hRoot, movingPart: fireRing, ringMat: fireRingMat, emissiveMat: oilMat };
      hazardMeshes.set(h.id, entry);
      return entry;
    }

    if (h.kind === 'laser_grid') {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const beamMat = new THREE.MeshStandardMaterial({
        color: 0xff2a55,
        emissive: 0xf43f5e,
        emissiveIntensity: 2.4,
        roughness: 0.1,
        metalness: 0.2,
      });
      materials.push(ringMat, beamMat);

      const arm = h.armLength ?? 3.6;
      const sweepRing = new THREE.Mesh(targetRingGeo, ringMat);
      sweepRing.scale.setScalar(arm);
      sweepRing.position.y = 0.032;

      const turretGroup = new THREE.Group();
      const base = new THREE.Mesh(laserTurretGeo, gantrySteelMat);
      base.position.y = 0.31;
      const cap = new THREE.Mesh(sbladeCapGeo, beamMat);
      cap.position.y = 0.64;

      const beamBar = new THREE.Mesh(laserBeamBarGeo, beamMat);
      beamBar.scale.y = arm * 2;
      beamBar.position.y = 0.46;

      turretGroup.add(base, cap, beamBar);
      hRoot.add(sweepRing, turretGroup);
      group.add(hRoot);
      const entry: HazardMeshEntry = { root: hRoot, movingPart: turretGroup, ringMat, emissiveMat: beamMat };
      hazardMeshes.set(h.id, entry);
      return entry;
    }

    const rMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    materials.push(rMat);
    const ring = new THREE.Mesh(empRingGeo, rMat);
    ring.position.y = 0.05;
    hRoot.add(ring);
    group.add(hRoot);
    const entry: HazardMeshEntry = { root: hRoot, movingPart: ring, ringMat: rMat };
    hazardMeshes.set(h.id, entry);
    return entry;
  }

  return {
    group,
    propMeshes,
    hazardMeshes,
    syncDynamicProps: (props: DestructibleProp[], time: number) => {
      for (const prop of props) {
        const mesh = ensurePropMesh(prop);
        mesh.visible = !prop.destroyed;
        mesh.position.set(prop.x, prop.y, prop.z);
        if (!prop.destroyed) {
          if (
            prop.kind === 'pickup_repair' ||
            prop.kind === 'pickup_energy' ||
            prop.kind === 'pickup_overcharge' ||
            prop.kind === 'pickup_shield'
          ) {
            mesh.children[0].rotation.y = time * 2.4;
            mesh.children[0].position.y = 0.72 + Math.sin(time * 3.5) * 0.14;
          } else if (prop.kind === 'crate' || prop.kind === 'barrel' || prop.kind === 'pillar') {
            const hpRatio = prop.maxHp > 0 ? Math.max(0.2, prop.hp / prop.maxHp) : 1;
            const dmg = 1 - hpRatio;
            mesh.rotation.z = dmg * 0.24;
            mesh.rotation.x = -dmg * 0.16;
            mesh.scale.set(1 + dmg * 0.06, 1 - dmg * 0.18, 1 + dmg * 0.06);
          } else if (prop.kind === 'debris_chunk') {
            mesh.rotation.y = prop.yaw ?? 0;
          }
        }
      }
    },
    syncHazards: (hazards: HazardState[], dt: number, colorBlindMode: ColorBlindMode = 'none') => {
      const nowSec = performance.now() * 0.001;
      const warnColorHex =
        colorBlindMode === 'blue_orange'
          ? 0xf97316
          : colorBlindMode === 'cyan_yellow'
            ? 0xfacc15
            : 0xf59e0b;
      const activeDangerHex =
        colorBlindMode === 'blue_orange'
          ? 0x38bdf8
          : colorBlindMode === 'cyan_yellow'
            ? 0x06b6d4
            : 0xef4444;

      for (const h of hazards) {
        const entry = ensureHazardMesh(h);
        // Accelerating 3-second floor plate strobe frequency as activation approaches
        const rem = h.warningTimeLeft ?? 1.5;
        const urgencyFreq = rem <= 1.0 ? 22 : rem <= 2.0 ? 15 : 10;
        const flashPulse = Math.abs(Math.sin(nowSec * urgencyFreq));

        if (h.kind === 'saw') {
          entry.movingPart.rotation.y += dt * (h.active ? 16 : h.warning ? 7 : 2);
          entry.movingPart.position.y = h.active ? 0.16 : h.warning ? 0.03 : -0.05;
        } else if (h.kind === 'flipper_pad') {
          entry.movingPart.position.y = h.active ? 0.36 : h.warning ? 0.09 + flashPulse * 0.05 : 0.07;
        } else if ((h.kind === 'emp_ring' || h.kind === 'lava_vent' || h.kind === 'acid_pool') && entry.ringMat) {
          const baseColor =
            colorBlindMode !== 'none'
              ? activeDangerHex
              : h.kind === 'lava_vent'
                ? 0xf97316
                : h.kind === 'acid_pool'
                  ? 0x10b981
                  : 0xa855f7;
          if (h.active) {
            entry.ringMat.color.setHex(baseColor);
            entry.ringMat.opacity = 0.88;
            entry.movingPart.scale.setScalar(1.06);
          } else if (h.warning) {
            entry.ringMat.color.setHex(warnColorHex);
            entry.ringMat.opacity = 0.35 + flashPulse * 0.58;
            entry.movingPart.scale.setScalar(0.98 + flashPulse * 0.06);
          } else {
            entry.ringMat.color.setHex(baseColor);
            entry.ringMat.opacity = 0.22;
            entry.movingPart.scale.setScalar(0.96);
          }
        } else if (h.kind === 'crusher') {
          const cy = h.crusherY ?? 1;
          const vib = h.warning ? (Math.random() - 0.5) * 0.04 : 0;
          entry.movingPart.position.set(vib, 0.04 + cy * 3.85, vib);
          if (entry.ringMat) {
            if (h.active) {
              entry.ringMat.color.setHex(activeDangerHex);
              entry.ringMat.opacity = 0.92;
            } else if (h.warning) {
              entry.ringMat.color.setHex(warnColorHex);
              entry.ringMat.opacity = 0.38 + flashPulse * 0.55;
            } else {
              entry.ringMat.color.setHex(warnColorHex);
              entry.ringMat.opacity = 0.14;
            }
          }
          if (entry.emissiveMat) {
            entry.emissiveMat.emissive.setHex(
              h.active ? activeDangerHex : h.warning ? warnColorHex : 0xf59e0b,
            );
            entry.emissiveMat.emissiveIntensity = h.active ? 2.1 : h.warning ? 1.2 + flashPulse * 0.8 : 0.35;
          }
        } else if (h.kind === 'pit') {
          // Trap doors slide apart when the pit opens
          const open = h.active ? 1 : h.warning ? 0.15 + flashPulse * 0.12 : 0;
          const doors = entry.movingPart;
          const cur = doors.userData.open ?? 0;
          const next = cur + (open - cur) * Math.min(1, dt * 7);
          doors.userData.open = next;
          doors.children[0].position.z = -next * h.radius * 1.05;
          doors.children[1].position.z = next * h.radius * 1.05;
          if (entry.ringMat) {
            entry.ringMat.color.setHex(h.active ? activeDangerHex : h.warning ? warnColorHex : 0x22d3ee);
            entry.ringMat.opacity = h.warning ? 0.4 + flashPulse * 0.52 : h.active ? 0.85 : 0.35;
          }
        } else if (h.kind === 'lightning') {
          entry.root.position.set(h.x, 0, h.z);
          const boltMat = (entry.movingPart as THREE.Mesh).material as THREE.MeshBasicMaterial;
          if (h.active) {
            boltMat.opacity = 0.95;
            entry.movingPart.scale.set(0.8 + Math.random() * 0.8, 1, 0.8 + Math.random() * 0.8);
            entry.movingPart.rotation.y = Math.random() * Math.PI;
          } else {
            boltMat.opacity *= Math.exp(-dt * 14);
          }
          if (entry.ringMat) {
            entry.ringMat.color.setHex(h.active ? 0xffffff : h.warning ? warnColorHex : 0x60a5fa);
            entry.ringMat.opacity = h.active ? 0.95 : h.warning ? 0.35 + flashPulse * 0.58 : 0;
          }
        } else if (h.kind === 'bomb_drop') {
          entry.root.position.set(h.x, 0, h.z);
          const by = h.bombY ?? 1;
          entry.movingPart.visible = Boolean(h.warning);
          entry.movingPart.position.y = 0.6 + by * 13.5;
          entry.movingPart.rotation.y += dt * 6;
          if (entry.ringMat) {
            entry.ringMat.color.setHex(h.active ? activeDangerHex : warnColorHex);
            entry.ringMat.opacity = h.active ? 0.95 : h.warning ? 0.38 + flashPulse * 0.58 : 0;
          }
        } else if (h.kind === 'oil_slick') {
          const ignited = Boolean(h.ignited);
          if (entry.ringMat) {
            entry.ringMat.opacity = ignited ? 0.65 + Math.sin(nowSec * 18) * 0.25 : 0;
            entry.movingPart.rotation.y += dt * 2.5;
          }
          if (entry.emissiveMat) {
            entry.emissiveMat.emissive.setHex(ignited ? warnColorHex : 0x1e1b4b);
            entry.emissiveMat.emissiveIntensity = ignited ? 1.8 : 0.25;
          }
        } else if (h.kind === 'laser_grid') {
          entry.movingPart.rotation.y = h.sweepAngle ?? 0;
          const beamMesh = entry.movingPart.children[2];
          if (beamMesh) {
            beamMesh.visible = h.active || Boolean(h.warning);
            beamMesh.scale.x = h.active ? 1.0 : 0.35;
            beamMesh.scale.z = h.active ? 1.0 : 0.35;
          }
          if (entry.ringMat) {
            entry.ringMat.color.setHex(h.active ? activeDangerHex : h.warning ? warnColorHex : 0x64748b);
            entry.ringMat.opacity = h.active ? 0.65 : h.warning ? 0.35 + flashPulse * 0.52 : 0.14;
          }
          if (entry.emissiveMat) {
            entry.emissiveMat.emissiveIntensity = h.active ? 2.8 : h.warning ? 1.2 + flashPulse * 0.8 : 0.25;
          }
        } else if (h.kind === 'spinner_blade') {
          const targetY = h.active ? 0.14 : h.warning ? -0.14 : -0.44;
          entry.movingPart.position.y += (targetY - entry.movingPart.position.y) * Math.min(1, dt * 10);
          entry.movingPart.rotation.y = h.sweepAngle ?? 0;
          if (entry.ringMat) {
            if (h.active) {
              entry.ringMat.color.setHex(activeDangerHex);
              entry.ringMat.opacity = 0.65;
            } else if (h.warning) {
              entry.ringMat.color.setHex(warnColorHex);
              entry.ringMat.opacity = 0.35 + flashPulse * 0.52;
            } else {
              entry.ringMat.color.setHex(0x64748b);
              entry.ringMat.opacity = 0.12;
            }
          }
          if (entry.emissiveMat) {
            entry.emissiveMat.emissive.setHex(h.active ? activeDangerHex : h.warning ? warnColorHex : 0x475569);
            entry.emissiveMat.emissiveIntensity = h.active ? 1.6 : h.warning ? 1.1 + flashPulse * 0.6 : 0.2;
          }
        }
      }
    },
    syncCrowd: updateCrowdTransforms,
    dispose: () => {
      disposeCrowdTextures();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
