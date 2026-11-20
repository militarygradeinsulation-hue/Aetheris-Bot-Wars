import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries as mergeBotGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { armorPanelNormalTexture, grimeRoughnessTexture, tireTreadTexture, treadNormalTexture } from './proceduralTextures';

/** Box with real rounded edges so every part catches a highlight instead of reading as a cube. */
function rbox(w: number, h: number, d: number, ..._segments: number[]): THREE.BufferGeometry {
  const r = Math.min(0.06, Math.min(w, h, d) * 0.2);
  if (r < 0.004) return new THREE.BoxGeometry(w, h, d);
  return new RoundedBoxGeometry(w, h, d, 3, r);
}

/** Tire: lathed profile with rounded shoulders and a bulged sidewall; axle along X. */
function makeTireGeometry(radius: number, width: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const hw = width / 2;
  const inner = radius * 0.64;
  const shoulder = Math.min(radius * 0.22, hw * 0.75);
  // Profile from inner bead on one side, over the tread, back to the other bead (x=radius, y=axial)
  pts.push(new THREE.Vector2(inner, -hw * 0.92));
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector2(inner + (radius - shoulder - inner) * t + Math.sin(t * Math.PI) * width * 0.06, -hw));
  }
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius - shoulder + Math.cos(a) * shoulder, -hw + shoulder + Math.sin(a) * shoulder));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius - shoulder + Math.cos(a) * shoulder, hw - shoulder + Math.sin(a) * shoulder));
  }
  for (let i = 0; i <= 6; i++) {
    const t = 1 - i / 6;
    pts.push(new THREE.Vector2(inner + (radius - shoulder - inner) * t + Math.sin(t * Math.PI) * width * 0.06, hw));
  }
  pts.push(new THREE.Vector2(inner, hw * 0.92));
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Five-spoke alloy rim with hub cap and lug bolts, merged into one mesh. */
function makeRimGeometry(radius: number, width: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rimR = radius * 0.64;
  const barrel = new THREE.CylinderGeometry(rimR, rimR, width * 0.8, 28, 1, true);
  parts.push(barrel);
  const lip = new THREE.TorusGeometry(rimR * 0.98, 0.018, 8, 28);
  lip.rotateX(Math.PI / 2);
  const lipA = lip.clone();
  lipA.translate(0, width * 0.4, 0);
  const lipB = lip.clone();
  lipB.translate(0, -width * 0.4, 0);
  parts.push(lipA, lipB);
  for (const side of [-1, 1]) {
    const face = new THREE.CylinderGeometry(rimR * 0.92, rimR * 0.92, 0.012, 28);
    face.translate(0, side * width * 0.32, 0);
    parts.push(face);
    for (let k = 0; k < 5; k++) {
      const spoke = new RoundedBoxGeometry(rimR * 0.18, 0.04, rimR * 0.85, 2, 0.012);
      spoke.translate(0, side * width * 0.36, rimR * 0.45);
      spoke.rotateY((k / 5) * Math.PI * 2);
      parts.push(spoke);
    }
    const cap = new THREE.SphereGeometry(rimR * 0.26, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    if (side < 0) cap.rotateX(Math.PI);
    cap.translate(0, side * width * 0.38, 0);
    parts.push(cap);
  }
  // Strip uv2/normal mismatches: merge needs identical attribute sets
  const clean = parts.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const key of Object.keys(ng.attributes)) {
      if (key !== 'position' && key !== 'normal' && key !== 'uv') ng.deleteAttribute(key);
    }
    return ng;
  });
  const merged = mergeBotGeometries(clean, false) ?? new THREE.CylinderGeometry(rimR, rimR, width * 0.8, 16);
  clean.forEach((g) => g.dispose());
  parts.forEach((g) => g.dispose());
  merged.rotateZ(Math.PI / 2);
  merged.computeVertexNormals();
  return merged;
}
import {
  type ArmorZones,
  type BotConfig,
  type BotPhysicsState,
  type ChassisId,
  type DamageKind,
  type WeaponId,
  getBotChassisStyles,
  getBotWeaponPlacements,
  getBotWeapons,
  getDefaultWeaponPlacement,
} from '../shared/types';
import {
  applyImpactToBotMeshes,
  type BotDecalEntry,
  type DamageDecalPack,
} from './damageDecals';
import {
  createArmorMaterial,
  createBotNameplateTexture,
  createLiveryTexture,
  createRaceNumberTexture,
} from './materials';

export interface BuiltWeaponEntry {
  weaponId: WeaponId;
  mountGroup: THREE.Group;
  pivot: THREE.Group;
  baseZ: number;
  secondarySpinners: THREE.Object3D[];
  flameJets: THREE.Mesh[];
  movingPart?: THREE.Object3D;
  glowMat?: THREE.MeshStandardMaterial;
}

export interface BuiltBotRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  weaponPivot: THREE.Group;
  weaponEntries: BuiltWeaponEntry[];
  secondarySpinners: THREE.Object3D[];
  flameJetMesh?: THREE.Mesh;
  wheels: THREE.Object3D[];
  accessoryPivot?: THREE.Object3D;
  shieldBubble?: THREE.Mesh;
  armorPlates: Record<keyof ArmorZones, THREE.Mesh>;
  armorMaterials: Record<keyof ArmorZones, THREE.MeshPhysicalMaterial>;
  damageableMeshes: THREE.Mesh[];
  decalPool: BotDecalEntry[];
  visorMat: THREE.MeshStandardMaterial;
  shadowPlane: THREE.Mesh;
  fans: THREE.Object3D[];
  isHover: boolean;
  /** Drive-unit corner (0 FL, 1 FR, 2 RL, 3 RR) for each entry in wheels. */
  wheelCorners: number[];
  iceShell: THREE.Mesh;
  heatMats: THREE.MeshPhysicalMaterial[];
  applyDamageDecal: (
    decalPack: DamageDecalPack,
    localPos: THREE.Vector3,
    localNormal: THREE.Vector3,
    force: number,
    kind: DamageKind,
  ) => void;
  dispose: () => void;
}

function makeChassisGeometry(chassis: ChassisId): THREE.BufferGeometry {
  const shape = new THREE.Shape();

  if (chassis === 'wedge') {
    shape.moveTo(-0.95, 0.14);
    shape.lineTo(1.05, 0.14);
    shape.lineTo(1.05, 0.24);
    shape.lineTo(0.2, 0.62);
    shape.lineTo(-0.88, 0.56);
    shape.lineTo(-0.95, 0.3);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 4,
      depth: 1.38,
      bevelEnabled: true,
      bevelThickness: 0.102,
      bevelSize: 0.085,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.translate(0, 0, -0.69);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'hex') {
    const r = 1.05;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 3,
      depth: 0.44,
      bevelEnabled: true,
      bevelThickness: 0.102,
      bevelSize: 0.102,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.18, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'rammer') {
    shape.moveTo(-0.76, -0.95);
    shape.lineTo(0.76, -0.95);
    shape.lineTo(0.88, -0.5);
    shape.lineTo(0.95, 0.96);
    shape.lineTo(0.42, 0.96);
    shape.lineTo(0.2, 0.56);
    shape.lineTo(-0.2, 0.56);
    shape.lineTo(-0.42, 0.96);
    shape.lineTo(-0.95, 0.96);
    shape.lineTo(-0.88, -0.5);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 3,
      depth: 0.44,
      bevelEnabled: true,
      bevelThickness: 0.085,
      bevelSize: 0.085,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.16, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'turtle') {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(1.04, 0),
      new THREE.Vector2(1.0, 0.14),
      new THREE.Vector2(0.9, 0.28),
      new THREE.Vector2(0.72, 0.48),
      new THREE.Vector2(0.45, 0.58),
      new THREE.Vector2(0.2, 0.63),
      new THREE.Vector2(0, 0.64),
    ];
    const geo = new THREE.LatheGeometry(pts, 18);
    geo.translate(0, 0.14, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'spider') {
    shape.moveTo(-0.55, -0.96);
    shape.lineTo(0.55, -0.96);
    shape.lineTo(0.6, -0.38);
    shape.lineTo(1.04, -0.2);
    shape.lineTo(1.04, 0.35);
    shape.lineTo(0.58, 0.52);
    shape.lineTo(0.45, 0.92);
    shape.lineTo(-0.45, 0.92);
    shape.lineTo(-0.58, 0.52);
    shape.lineTo(-1.04, 0.35);
    shape.lineTo(-1.04, -0.2);
    shape.lineTo(-0.6, -0.38);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 3,
      depth: 0.36,
      bevelEnabled: true,
      bevelThickness: 0.085,
      bevelSize: 0.068,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.17, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'micro') {
    shape.moveTo(0, 0.94);
    shape.lineTo(0.66, -0.35);
    shape.lineTo(0.54, -0.82);
    shape.lineTo(-0.54, -0.82);
    shape.lineTo(-0.66, -0.35);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 2,
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.068,
      bevelSize: 0.068,
      bevelSegments: 2,
      curveSegments: 6,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.15, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'behemoth') {
    shape.moveTo(-1.08, -1.02);
    shape.lineTo(1.08, -1.02);
    shape.lineTo(1.16, -0.45);
    shape.lineTo(1.12, 0.72);
    shape.lineTo(0.84, 1.02);
    shape.lineTo(-0.84, 1.02);
    shape.lineTo(-1.12, 0.72);
    shape.lineTo(-1.16, -0.45);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 4,
      depth: 0.56,
      bevelEnabled: true,
      bevelThickness: 0.110,
      bevelSize: 0.102,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.16, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'ufo') {
    const pts = [
      new THREE.Vector2(0, 0.04),
      new THREE.Vector2(0.88, 0.06),
      new THREE.Vector2(1.16, 0.18),
      new THREE.Vector2(1.14, 0.26),
      new THREE.Vector2(0.68, 0.36),
      new THREE.Vector2(0.48, 0.56),
      new THREE.Vector2(0.22, 0.65),
      new THREE.Vector2(0, 0.66),
    ];
    const geo = new THREE.LatheGeometry(pts, 24);
    geo.translate(0, 0.12, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'tripod') {
    shape.moveTo(-0.26, -1.06);
    shape.lineTo(0.26, -1.06);
    shape.lineTo(0.36, -0.18);
    shape.lineTo(1.08, 0.72);
    shape.lineTo(0.76, 0.98);
    shape.lineTo(0.18, 0.34);
    shape.lineTo(-0.18, 0.34);
    shape.lineTo(-0.76, 0.98);
    shape.lineTo(-1.08, 0.72);
    shape.lineTo(-0.36, -0.18);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 3,
      depth: 0.36,
      bevelEnabled: true,
      bevelThickness: 0.085,
      bevelSize: 0.068,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.17, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'monolith') {
    shape.moveTo(-0.56, -0.68);
    shape.lineTo(0.56, -0.68);
    shape.lineTo(0.68, -0.34);
    shape.lineTo(0.68, 0.44);
    shape.lineTo(0.46, 0.74);
    shape.lineTo(-0.46, 0.74);
    shape.lineTo(-0.68, 0.44);
    shape.lineTo(-0.68, -0.34);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 5,
      depth: 0.98,
      bevelEnabled: true,
      bevelThickness: 0.102,
      bevelSize: 0.085,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.16, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'claw') {
    shape.moveTo(-0.66, -0.96);
    shape.lineTo(0.66, -0.96);
    shape.lineTo(1.1, -0.25);
    shape.lineTo(1.06, 0.76);
    shape.lineTo(0.64, 1.06);
    shape.lineTo(0.46, 0.88);
    shape.lineTo(0.62, 0.25);
    shape.lineTo(0.28, -0.1);
    shape.lineTo(-0.28, -0.1);
    shape.lineTo(-0.62, 0.25);
    shape.lineTo(-0.46, 0.88);
    shape.lineTo(-0.64, 1.06);
    shape.lineTo(-1.06, 0.76);
    shape.lineTo(-1.1, -0.25);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 3,
      depth: 0.38,
      bevelEnabled: true,
      bevelThickness: 0.085,
      bevelSize: 0.085,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.16, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'scorpion') {
    // Predatory wide-front arachnid frame tapering to a raised tail base
    shape.moveTo(-0.42, -1.04);
    shape.lineTo(0.42, -1.04);
    shape.lineTo(0.64, -0.35);
    shape.lineTo(1.06, 0.25);
    shape.lineTo(0.92, 0.92);
    shape.lineTo(0.32, 0.76);
    shape.lineTo(-0.32, 0.76);
    shape.lineTo(-0.92, 0.92);
    shape.lineTo(-1.06, 0.25);
    shape.lineTo(-0.64, -0.35);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 3,
      depth: 0.42,
      bevelEnabled: true,
      bevelThickness: 0.085,
      bevelSize: 0.085,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.16, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'juggernaut') {
    // Heavy octagonal gothic siege dreadnought
    shape.moveTo(-0.88, -1.04);
    shape.lineTo(0.88, -1.04);
    shape.lineTo(1.14, -0.62);
    shape.lineTo(1.14, 0.56);
    shape.lineTo(0.66, 1.06);
    shape.lineTo(-0.66, 1.06);
    shape.lineTo(-1.14, 0.56);
    shape.lineTo(-1.14, -0.62);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 4,
      depth: 0.54,
      bevelEnabled: true,
      bevelThickness: 0.102,
      bevelSize: 0.102,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.16, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'hover_disc') {
    // Sleek 8-sided chamfered mag-lev disc with low profile
    const r = 1.08;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 2,
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.102,
      bevelSize: 0.110,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.2, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'hydra') {
    // Twin-pontoon catamaran hull with central bridge
    shape.moveTo(-1.02, -0.96);
    shape.lineTo(-0.44, -0.96);
    shape.lineTo(-0.44, -0.35);
    shape.lineTo(0.44, -0.35);
    shape.lineTo(0.44, -0.96);
    shape.lineTo(1.02, -0.96);
    shape.lineTo(1.06, 0.96);
    shape.lineTo(0.48, 0.98);
    shape.lineTo(0.38, 0.42);
    shape.lineTo(-0.38, 0.42);
    shape.lineTo(-0.48, 0.98);
    shape.lineTo(-1.06, 0.96);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 3,
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.085,
      bevelSize: 0.085,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.16, 0);
    geo.computeVertexNormals();
    return geo;
  }

  if (chassis === 'shell_spinner') {
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const r = i % 2 === 0 ? 1.18 : 0.96;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      steps: 3,
      depth: 0.44,
      bevelEnabled: true,
      bevelThickness: 0.102,
      bevelSize: 0.085,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.16, 0);
    geo.computeVertexNormals();
    return geo;
  }

  // Brawler frame (chamfered heavy rectangle)
  shape.moveTo(-0.78, -0.95);
  shape.lineTo(0.78, -0.95);
  shape.lineTo(0.92, -0.72);
  shape.lineTo(0.92, 0.78);
  shape.lineTo(0.72, 0.95);
  shape.lineTo(-0.72, 0.95);
  shape.lineTo(-0.92, 0.78);
  shape.lineTo(-0.92, -0.72);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 3,
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.102,
    bevelSize: 0.085,
    bevelSegments: 5,
    curveSegments: 8,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.16, 0);
  geo.computeVertexNormals();
  return geo;
}

function makeToothedDiscGeometry(radius: number, teeth: number, thickness: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const steps = teeth * 2;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.76;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.034,
    bevelSize: 0.034,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();
  return geo;
}

function appendHybridChassisStyle(
  style: ChassisId,
  bodyPivot: THREE.Group,
  chassisDarkMat: THREE.Material,
  armorTrimMat: THREE.Material,
  bareSteelMat: THREE.Material,
  castShadow: boolean,
  geometriesToDispose: THREE.BufferGeometry[],
  damageableMeshes: THREE.Mesh[],
) {
  if (style === 'wedge') {
    const prowGeo = rbox(1.24, 0.18, 0.42, 6, 2, 3);
    geometriesToDispose.push(prowGeo);
    const prow = new THREE.Mesh(prowGeo, armorTrimMat);
    prow.position.set(0, 0.22, 0.96);
    prow.rotation.x = 0.36;
    prow.castShadow = castShadow;
    bodyPivot.add(prow);
    damageableMeshes.push(prow);
  } else if (style === 'rammer') {
    const forkGeoL = rbox(0.24, 0.22, 0.62, 3, 2, 4);
    const forkGeoR = rbox(0.24, 0.22, 0.62, 3, 2, 4);
    geometriesToDispose.push(forkGeoL, forkGeoR);
    const forkL = new THREE.Mesh(forkGeoL, armorTrimMat);
    forkL.position.set(-0.62, 0.26, 0.98);
    forkL.rotation.y = 0.14;
    forkL.castShadow = castShadow;
    const forkR = new THREE.Mesh(forkGeoR, armorTrimMat);
    forkR.position.set(0.62, 0.26, 0.98);
    forkR.rotation.y = -0.14;
    forkR.castShadow = castShadow;
    bodyPivot.add(forkL, forkR);
    damageableMeshes.push(forkL, forkR);
  } else if (style === 'hex') {
    const sponsonGeoL = new THREE.CylinderGeometry(0.32, 0.38, 0.36, 6, 2);
    const sponsonGeoR = new THREE.CylinderGeometry(0.32, 0.38, 0.36, 6, 2);
    geometriesToDispose.push(sponsonGeoL, sponsonGeoR);
    const sponsonL = new THREE.Mesh(sponsonGeoL, chassisDarkMat);
    sponsonL.position.set(-0.92, 0.34, -0.05);
    sponsonL.scale.set(0.55, 1, 1.85);
    sponsonL.castShadow = castShadow;
    const sponsonR = new THREE.Mesh(sponsonGeoR, chassisDarkMat);
    sponsonR.position.set(0.92, 0.34, -0.05);
    sponsonR.scale.set(0.55, 1, 1.85);
    sponsonR.castShadow = castShadow;
    bodyPivot.add(sponsonL, sponsonR);
    damageableMeshes.push(sponsonL, sponsonR);
  } else if (style === 'turtle') {
    const shellGeo = new THREE.SphereGeometry(0.62, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45);
    geometriesToDispose.push(shellGeo);
    const shell = new THREE.Mesh(shellGeo, armorTrimMat);
    shell.scale.set(1.18, 0.55, 1.32);
    shell.position.set(0, 0.46, -0.06);
    shell.castShadow = castShadow;
    bodyPivot.add(shell);
    damageableMeshes.push(shell);
  } else if (style === 'spider') {
    const wingGeoL = rbox(0.46, 0.12, 0.66, 4, 2, 4);
    const wingGeoR = rbox(0.46, 0.12, 0.66, 4, 2, 4);
    geometriesToDispose.push(wingGeoL, wingGeoR);
    const wingL = new THREE.Mesh(wingGeoL, bareSteelMat);
    wingL.position.set(-1.04, 0.34, 0.04);
    wingL.rotation.z = -0.16;
    wingL.castShadow = castShadow;
    const wingR = new THREE.Mesh(wingGeoR, bareSteelMat);
    wingR.position.set(1.04, 0.34, 0.04);
    wingR.rotation.z = 0.16;
    wingR.castShadow = castShadow;
    bodyPivot.add(wingL, wingR);
    damageableMeshes.push(wingL, wingR);
  } else if (style === 'micro') {
    const finGeo = rbox(0.32, 0.08, 0.56, 3, 2, 3);
    geometriesToDispose.push(finGeo);
    [-0.76, 0.76].forEach((fx, idx) => {
      const fin = new THREE.Mesh(finGeo, bareSteelMat);
      fin.position.set(fx, 0.36, -0.28);
      fin.rotation.y = idx === 0 ? 0.36 : -0.36;
      fin.castShadow = castShadow;
      bodyPivot.add(fin);
      damageableMeshes.push(fin);
    });
  } else if (style === 'behemoth' || style === 'juggernaut') {
    const blockGeo = rbox(0.46, 0.34, 1.56, 3, 3, 6);
    geometriesToDispose.push(blockGeo);
    [-1.02, 1.02].forEach((bx) => {
      const blk = new THREE.Mesh(blockGeo, armorTrimMat);
      blk.position.set(bx, 0.44, 0.02);
      blk.castShadow = castShadow;
      bodyPivot.add(blk);
      damageableMeshes.push(blk);
    });
  } else if (style === 'ufo' || style === 'hover_disc' || style === 'shell_spinner') {
    const ringGeo =
      style === 'shell_spinner'
        ? makeToothedDiscGeometry(1.24, 12, 0.14)
        : new THREE.TorusGeometry(1.12, 0.09, 10, 28);
    ringGeo.rotateX(Math.PI / 2);
    geometriesToDispose.push(ringGeo);
    const ring = new THREE.Mesh(ringGeo, style === 'shell_spinner' ? armorTrimMat : bareSteelMat);
    ring.position.set(0, 0.32, 0);
    ring.castShadow = castShadow;
    bodyPivot.add(ring);
    damageableMeshes.push(ring);
  } else if (style === 'tripod') {
    const mandGeo = rbox(0.2, 0.18, 0.78, 2, 2, 4);
    geometriesToDispose.push(mandGeo);
    [-0.74, 0.74].forEach((mx, idx) => {
      const mand = new THREE.Mesh(mandGeo, armorTrimMat);
      mand.position.set(mx, 0.34, 0.78);
      mand.rotation.y = idx === 0 ? -0.42 : 0.42;
      mand.castShadow = castShadow;
      bodyPivot.add(mand);
      damageableMeshes.push(mand);
    });
  } else if (style === 'monolith' || style === 'scorpion') {
    const spireGeo = rbox(0.48, 0.56, 0.74, 4, 4, 4);
    geometriesToDispose.push(spireGeo);
    const spire = new THREE.Mesh(spireGeo, chassisDarkMat);
    spire.position.set(0, 0.74, -0.22);
    spire.rotation.x = style === 'scorpion' ? 0.35 : 0;
    spire.castShadow = castShadow;
    bodyPivot.add(spire);
    damageableMeshes.push(spire);
  } else if (style === 'claw' || style === 'hydra') {
    const clawGeo = rbox(0.28, 0.22, 0.74, 3, 2, 4);
    geometriesToDispose.push(clawGeo);
    [-0.84, 0.84].forEach((cx, idx) => {
      const pincer = new THREE.Mesh(clawGeo, armorTrimMat);
      pincer.position.set(cx, 0.3, 0.86);
      pincer.rotation.y = idx === 0 ? -0.28 : 0.28;
      pincer.castShadow = castShadow;
      bodyPivot.add(pincer);
      damageableMeshes.push(pincer);
    });
  } else {
    const railGeoL = rbox(0.14, 0.16, 1.56, 2, 2, 6);
    const railGeoR = rbox(0.14, 0.16, 1.56, 2, 2, 6);
    geometriesToDispose.push(railGeoL, railGeoR);
    const railL = new THREE.Mesh(railGeoL, bareSteelMat);
    railL.position.set(-0.92, 0.48, 0);
    railL.castShadow = castShadow;
    const railR = new THREE.Mesh(railGeoR, bareSteelMat);
    railR.position.set(0.92, 0.48, 0);
    railR.castShadow = castShadow;
    bodyPivot.add(railL, railR);
    damageableMeshes.push(railL, railR);
  }
}

export function buildBotRig(
  config: BotConfig,
  weaveTexture: THREE.Texture,
  contactShadowTex: THREE.Texture,
  castShadow = true,
  metalBrushBump?: THREE.Texture,
): BuiltBotRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];
  const texturesToDispose: THREE.Texture[] = [];
  const damageableMeshes: THREE.Mesh[] = [];
  const decalPool: BotDecalEntry[] = [];

  const chassisStyles = getBotChassisStyles(config);
  const primaryChassis = chassisStyles[0];
  const equippedWeapons = getBotWeapons(config);
  const finishStyle = config.finishStyle || 'standard';

  const chassisDarkMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d242e,
    bumpMap: metalBrushBump,
    bumpScale: 0.01,
    roughness: 0.36,
    roughnessMap: grimeRoughnessTexture(),
    normalMap: armorPanelNormalTexture(),
    normalScale: new THREE.Vector2(0.45, 0.45),
    metalness: 0.72,
    envMapIntensity: 1.0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
  });
  const bareSteelMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    bumpMap: metalBrushBump,
    bumpScale: 0.008,
    roughness: 0.24,
    metalness: 0.94,
    envMapIntensity: 1.0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.1,
    anisotropy: 0.85,
  });
  const treadTex = tireTreadTexture();
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d32,
    map: treadTex,
    normalMap: treadNormalTexture(),
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 0.92,
    metalness: 0.0,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.accentColor),
    emissive: new THREE.Color(config.accentColor),
    emissiveIntensity: 1.6,
    roughness: 0.2,
    metalness: 0.25,
  });
  const weaponAccentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(config.accentColor),
    bumpMap: metalBrushBump,
    bumpScale: 0.01,
    roughness: 0.16,
    metalness: 0.92,
    envMapIntensity: 1.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.12,
    anisotropy: 0.8,
  });

  materialsToDispose.push(chassisDarkMat, bareSteelMat, rubberMat, visorMat, weaponAccentMat);

  // 1. Primary Silhouette: Extruded / Lathed Chassis Core
  const chassisGeo = makeChassisGeometry(primaryChassis);
  geometriesToDispose.push(chassisGeo);
  const chassisMesh = new THREE.Mesh(chassisGeo, chassisDarkMat);
  chassisMesh.castShadow = castShadow;
  chassisMesh.receiveShadow = true;
  bodyPivot.add(chassisMesh);
  damageableMeshes.push(chassisMesh);

  // 2. Top Power Core Cap + Glowing Visor Strip
  const deckTopY =
    primaryChassis === 'monolith'
      ? 1.18
      : primaryChassis === 'behemoth' || primaryChassis === 'juggernaut'
        ? 0.78
        : primaryChassis === 'turtle' || primaryChassis === 'ufo'
          ? 0.78
          : primaryChassis === 'micro'
            ? 0.5
            : 0.64;

  const coreGeo = new THREE.CylinderGeometry(0.3, 0.36, 0.14, 8);
  geometriesToDispose.push(coreGeo);
  const coreMesh = new THREE.Mesh(coreGeo, bareSteelMat);
  coreMesh.position.set(0, deckTopY, -0.32);
  coreMesh.castShadow = castShadow;
  bodyPivot.add(coreMesh);

  const visorGeo = rbox(0.74, 0.08, 0.12);
  geometriesToDispose.push(visorGeo);
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(
    0,
    primaryChassis === 'monolith'
      ? 0.92
      : primaryChassis === 'behemoth' || primaryChassis === 'juggernaut'
        ? 0.66
        : primaryChassis === 'turtle' || primaryChassis === 'ufo'
          ? 0.56
          : 0.54,
    primaryChassis === 'monolith' ? 0.64 : 0.48,
  );
  bodyPivot.add(visorMesh);

  // 3. Physical Bot Nameplate Mounted on Dorsal Deck
  const nameplateTex = createBotNameplateTexture(config.name, config.accentColor);
  texturesToDispose.push(nameplateTex);
  const plateGeo = new THREE.PlaneGeometry(1.16, 0.36);
  geometriesToDispose.push(plateGeo);
  const plateMat = new THREE.MeshStandardMaterial({
    map: nameplateTex,
    roughness: 0.38,
    metalness: 0.35,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: nameplateTex,
    emissiveIntensity: 0.25,
  });
  materialsToDispose.push(plateMat);
  const nameplateMesh = new THREE.Mesh(plateGeo, plateMat);
  const plateY =
    primaryChassis === 'monolith'
      ? 1.24
      : primaryChassis === 'behemoth' || primaryChassis === 'juggernaut'
        ? 0.84
        : primaryChassis === 'turtle' || primaryChassis === 'ufo'
          ? 0.84
          : primaryChassis === 'micro'
            ? 0.56
            : 0.69;
  nameplateMesh.position.set(0, plateY, 0.06);
  nameplateMesh.rotation.x = -Math.PI * 0.36;
  bodyPivot.add(nameplateMesh);

  // 4. Directional Armor Plates
  const pattern = config.pattern ?? 'none';
  const liveryTex = pattern !== 'none' ? createLiveryTexture(pattern, config.primaryColor, config.accentColor) : undefined;
  if (liveryTex) texturesToDispose.push(liveryTex);
  const makeArmorMat = () =>
    createArmorMaterial(config.armor, config.primaryColor, weaveTexture, metalBrushBump, finishStyle, liveryTex);
  const armorMaterials: Record<keyof ArmorZones, THREE.MeshPhysicalMaterial> = {
    front: makeArmorMat(),
    left: makeArmorMat(),
    right: makeArmorMat(),
    rear: makeArmorMat(),
  };
  // Livery pattern also wraps the core hull, darkened so the plates still pop
  if (liveryTex) {
    const hullPaint = makeArmorMat();
    hullPaint.color.setRGB(0.62, 0.64, 0.68);
    hullPaint.userData.baseColor = `#${hullPaint.color.getHexString()}`;
    materialsToDispose.push(hullPaint);
    chassisMesh.material = hullPaint;
  }
  Object.values(armorMaterials).forEach((m) => materialsToDispose.push(m));

  const frontPlateGeo = rbox(1.32, 0.22, 0.18, 8, 3, 2);
  const leftPlateGeo = rbox(0.16, 0.28, 1.38, 2, 3, 8);
  const rightPlateGeo = rbox(0.16, 0.28, 1.38, 2, 3, 8);
  const rearPlateGeo = rbox(1.36, 0.32, 0.16, 8, 3, 2);
  geometriesToDispose.push(frontPlateGeo, leftPlateGeo, rightPlateGeo, rearPlateGeo);

  const frontPlate = new THREE.Mesh(frontPlateGeo, armorMaterials.front);
  frontPlate.position.set(0, 0.32, 0.96);
  frontPlate.rotation.x = primaryChassis === 'wedge' ? 0.42 : 0.15;
  frontPlate.castShadow = castShadow;

  const sideOffset = config.wheelLayout === '4wd_tucked' || config.wheelLayout === '8wd_crawler' ? 0.98 : 0.9;
  const leftPlate = new THREE.Mesh(leftPlateGeo, armorMaterials.left);
  leftPlate.position.set(-sideOffset, 0.36, -0.02);
  leftPlate.castShadow = castShadow;

  const rightPlate = new THREE.Mesh(rightPlateGeo, armorMaterials.right);
  rightPlate.position.set(sideOffset, 0.36, -0.02);
  rightPlate.castShadow = castShadow;

  const rearPlate = new THREE.Mesh(rearPlateGeo, armorMaterials.rear);
  rearPlate.position.set(0, 0.38, -0.96);
  rearPlate.castShadow = castShadow;

  bodyPivot.add(frontPlate, leftPlate, rightPlate, rearPlate);
  damageableMeshes.push(frontPlate, leftPlate, rightPlate, rearPlate);

  // Hex bolt rows along the outer face of each plate (one instanced draw per plate)
  const boltGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.022, 6);
  geometriesToDispose.push(boltGeo);
  const boltDummy = new THREE.Object3D();
  const addBolts = (plate: THREE.Mesh, axis: 'x' | 'z', face: number, length: number, height: number) => {
    const per = Math.max(3, Math.round(length / 0.26));
    const im = new THREE.InstancedMesh(boltGeo, bareSteelMat, per * 2);
    let k = 0;
    for (const yy of [height / 2 - 0.045, -height / 2 + 0.045]) {
      for (let i = 0; i < per; i++) {
        const t = (i + 0.5) / per - 0.5;
        if (axis === 'z') {
          boltDummy.position.set(t * length * 0.92, yy, face);
          boltDummy.rotation.set(Math.PI / 2, 0, 0);
        } else {
          boltDummy.position.set(face, yy, t * length * 0.92);
          boltDummy.rotation.set(0, 0, Math.PI / 2);
        }
        boltDummy.updateMatrix();
        im.setMatrixAt(k++, boltDummy.matrix);
      }
    }
    im.castShadow = false;
    plate.add(im);
  };
  addBolts(frontPlate, 'z', 0.095, 1.32, 0.22);
  addBolts(rearPlate, 'z', -0.085, 1.36, 0.32);
  addBolts(leftPlate, 'x', -0.085, 1.38, 0.28);
  addBolts(rightPlate, 'x', 0.085, 1.38, 0.28);

  const armorPlates: Record<keyof ArmorZones, THREE.Mesh> = {
    front: frontPlate,
    left: leftPlate,
    right: rightPlate,
    rear: rearPlate,
  };

  // Hybrid Body Style Fusions
  for (let i = 1; i < chassisStyles.length; i++) {
    appendHybridChassisStyle(
      chassisStyles[i],
      bodyPivot,
      chassisDarkMat,
      armorMaterials.front,
      bareSteelMat,
      castShadow,
      geometriesToDispose,
      damageableMeshes,
    );
  }

  // Race number roundels on both flanks
  if (typeof config.raceNumber === 'number' && config.raceNumber >= 0) {
    const numTex = createRaceNumberTexture(config.raceNumber, config.accentColor);
    texturesToDispose.push(numTex);
    const numGeo = new THREE.PlaneGeometry(0.34, 0.34);
    const numMat = new THREE.MeshStandardMaterial({
      map: numTex,
      transparent: true,
      roughness: 0.4,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    geometriesToDispose.push(numGeo);
    materialsToDispose.push(numMat);
    const sideX = sideOffset + 0.085;
    [-1, 1].forEach((side) => {
      const num = new THREE.Mesh(numGeo, numMat);
      num.position.set(side * sideX, 0.38, -0.05);
      num.rotation.y = side * Math.PI * 0.5;
      bodyPivot.add(num);
    });
  }

  // 5. Wheel Placements & Drive Functions
  const wheels: THREE.Object3D[] = [];
  const fans: THREE.Object3D[] = [];
  const wheelLayout = config.wheelLayout || '4wd_wide';
  const isHover = config.drive === 'hover';
  const glowHex = config.underglowColor && config.underglowColor !== 'none' ? config.underglowColor : config.accentColor;

  if (isHover) {
    // Ducted-fan hover skirt: rubber curtain ring + four lift fans + glowing cushion
    const skirtGeo = new THREE.TorusGeometry(1.0, 0.13, 8, 32);
    skirtGeo.rotateX(Math.PI / 2);
    skirtGeo.scale(1.02, 1, 1.12);
    const ductGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.16, 16, 1, true);
    const fanGeo = new THREE.BoxGeometry(0.46, 0.02, 0.07);
    const cushionGeo = new THREE.CircleGeometry(1.05, 32);
    cushionGeo.rotateX(-Math.PI / 2);
    const cushionMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(glowHex),
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    geometriesToDispose.push(skirtGeo, ductGeo, fanGeo, cushionGeo);
    materialsToDispose.push(cushionMat);
    const skirt = new THREE.Mesh(skirtGeo, rubberMat);
    skirt.position.y = 0.12;
    skirt.castShadow = castShadow;
    bodyPivot.add(skirt);
    const cushion = new THREE.Mesh(cushionGeo, cushionMat);
    cushion.position.y = 0.03;
    bodyPivot.add(cushion);
    [
      [-0.62, -0.55],
      [0.62, -0.55],
      [-0.62, 0.52],
      [0.62, 0.52],
    ].forEach(([fx, fz]) => {
      const duct = new THREE.Mesh(ductGeo, bareSteelMat);
      duct.position.set(fx * 1.25, 0.2, fz);
      bodyPivot.add(duct);
      const fan = new THREE.Group();
      fan.position.set(fx * 1.25, 0.2, fz);
      const b1 = new THREE.Mesh(fanGeo, chassisDarkMat);
      const b2 = new THREE.Mesh(fanGeo, chassisDarkMat);
      b2.rotation.y = Math.PI / 2;
      fan.add(b1, b2);
      bodyPivot.add(fan);
      fans.push(fan);
    });
  } else if (config.drive === 'tracks' || config.drive === 'crawler_nuclear') {
    const trackX = wheelLayout === 'outboard' ? 1.12 : wheelLayout === '4wd_tucked' ? 0.84 : 0.98;
    const trackGeo = new RoundedBoxGeometry(0.28, 0.36, 1.64, 4, 0.16);
    const treadRollerGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 12);
    treadRollerGeo.rotateZ(Math.PI / 2);
    geometriesToDispose.push(trackGeo, treadRollerGeo);

    [-trackX, trackX].forEach((sx) => {
      const trackPod = new THREE.Mesh(trackGeo, rubberMat);
      trackPod.position.set(sx, 0.18, -0.04);
      trackPod.castShadow = castShadow;
      bodyPivot.add(trackPod);

      const rollerZ =
        wheelLayout === '8wd_crawler'
          ? [-0.72, -0.24, 0.24, 0.72]
          : wheelLayout === '6wd_inline'
            ? [-0.66, 0, 0.66]
            : [-0.6, 0, 0.56];
      rollerZ.forEach((sz) => {
        const roller = new THREE.Mesh(
          treadRollerGeo,
          config.drive === 'crawler_nuclear' ? weaponAccentMat : bareSteelMat,
        );
        roller.position.set(sx, 0.18, sz);
        bodyPivot.add(roller);
        wheels.push(roller);
      });
    });
  } else {
    const wheelRadius =
      config.drive === 'turbo' ? 0.28 : config.drive === 'heavy_torque' ? 0.31 : 0.25;
    const wheelWidth = config.drive === 'heavy_torque' ? 0.28 : 0.22;
    const wheelGeo = makeTireGeometry(wheelRadius, wheelWidth);
    const hubMat =
      config.drive === 'turbo'
        ? weaponAccentMat
        : config.drive === 'mecanum' || config.drive === 'maglev'
          ? visorMat
          : bareSteelMat;
    const hubGeo = makeRimGeometry(wheelRadius, wheelWidth);
    const strutGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8);
    strutGeo.rotateZ(Math.PI / 2);
    geometriesToDispose.push(wheelGeo, hubGeo, strutGeo);

    let placements: Array<[number, number, number]> = [];
    if (wheelLayout === '8wd_crawler') {
      const xOff = 1.02;
      [-0.72, -0.24, 0.24, 0.72].forEach((z) => {
        placements.push([-xOff, wheelRadius * 0.92, z], [xOff, wheelRadius * 0.92, z]);
      });
    } else if (wheelLayout === '6wd_inline') {
      const xOff = 0.98;
      [-0.68, 0, 0.64].forEach((z) => {
        placements.push([-xOff, wheelRadius, z], [xOff, wheelRadius, z]);
      });
    } else if (wheelLayout === '4wd_tucked') {
      const xOff = 0.8;
      [-0.6, 0.54].forEach((z) => {
        placements.push([-xOff, wheelRadius, z], [xOff, wheelRadius, z]);
      });
    } else if (wheelLayout === 'rear_trike') {
      placements = [
        [-1.02, wheelRadius * 1.1, -0.62],
        [1.02, wheelRadius * 1.1, -0.62],
        [0, wheelRadius * 0.85, 0.72],
      ];
    } else if (wheelLayout === 'outboard' || wheelLayout === 'omni_quad') {
      const xOff = wheelLayout === 'outboard' ? 1.18 : 1.08;
      [-0.62, 0.56].forEach((z) => {
        placements.push([-xOff, wheelRadius, z], [xOff, wheelRadius, z]);
        const strut = new THREE.Mesh(strutGeo, bareSteelMat);
        strut.position.set(-0.94, wheelRadius, z);
        const strutR = new THREE.Mesh(strutGeo, bareSteelMat);
        strutR.position.set(0.94, wheelRadius, z);
        bodyPivot.add(strut, strutR);
      });
    } else {
      const xOff = 0.96;
      [-0.62, 0.56].forEach((z) => {
        placements.push([-xOff, wheelRadius, z], [xOff, wheelRadius, z]);
      });
    }

    for (const [px, py, pz] of placements) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(px, py, pz);
      if (wheelLayout === 'omni_quad') {
        wheelGroup.rotation.y = (px > 0 ? -1 : 1) * (pz > 0 ? 0.35 : -0.35);
      }
      const tire = new THREE.Mesh(wheelGeo, rubberMat);
      tire.castShadow = castShadow;
      const hub = new THREE.Mesh(hubGeo, hubMat);
      wheelGroup.add(tire, hub);
      bodyPivot.add(wheelGroup);
      wheels.push(wheelGroup);
    }
  }

  const wheelCorners = wheels.map((w) => {
    const left = w.position.x <= 0;
    const front = w.position.z > 0.05;
    return (front ? 0 : 2) + (left ? 0 : 1);
  });

  // Ice shell grows over the hull as cryo load builds
  const iceGeo = new THREE.BoxGeometry(2.25, 0.95, 2.35, 3, 2, 3);
  {
    const pos = iceGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) * (1 + (Math.random() - 0.5) * 0.08),
        pos.getY(i) * (1 + (Math.random() - 0.5) * 0.12),
        pos.getZ(i) * (1 + (Math.random() - 0.5) * 0.08),
      );
    }
    iceGeo.computeVertexNormals();
  }
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xcdefff,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.15,
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.4,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    depthWrite: false,
  });
  geometriesToDispose.push(iceGeo);
  materialsToDispose.push(iceMat);
  const iceShell = new THREE.Mesh(iceGeo, iceMat);
  iceShell.position.y = 0.42;
  iceShell.visible = false;
  bodyPivot.add(iceShell);

  // 6. Rear Twin Exhaust Nozzles + Whip Antenna + Cosmetic Dorsal Accessories
  const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.26, 10);
  exhaustGeo.rotateX(Math.PI / 2.6);
  geometriesToDispose.push(exhaustGeo);
  [-0.36, 0.36].forEach((ex) => {
    const exMesh = new THREE.Mesh(exhaustGeo, bareSteelMat);
    exMesh.position.set(ex, 0.56, -0.84);
    bodyPivot.add(exMesh);
  });

  const antennaGeo = new THREE.CylinderGeometry(0.018, 0.025, 0.58, 6);
  const tipGeo = new THREE.SphereGeometry(0.045, 8, 8);
  geometriesToDispose.push(antennaGeo, tipGeo);
  const antenna = new THREE.Mesh(antennaGeo, bareSteelMat);
  antenna.position.set(-0.56, 0.85, -0.68);
  const antennaTip = new THREE.Mesh(tipGeo, visorMat);
  antennaTip.position.set(-0.56, 1.15, -0.68);
  bodyPivot.add(antenna, antennaTip);

  let accessoryPivot: THREE.Object3D | undefined;
  const accessory = config.accessory || 'none';
  if (accessory !== 'none') {
    const accGroup = new THREE.Group();
    accGroup.position.set(0, deckTopY + 0.18, -0.28);
    bodyPivot.add(accGroup);
    accessoryPivot = accGroup;

    if (accessory === 'halo_crown') {
      const haloGeo = new THREE.TorusGeometry(0.46, 0.038, 10, 32);
      haloGeo.rotateX(Math.PI / 2);
      geometriesToDispose.push(haloGeo);
      const halo = new THREE.Mesh(haloGeo, visorMat);
      halo.position.y = 0.22;
      accGroup.add(halo);
    } else if (accessory === 'twin_flags') {
      const poleGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.72, 6);
      const bannerGeo = rbox(0.02, 0.26, 0.38);
      geometriesToDispose.push(poleGeo, bannerGeo);
      [-0.48, 0.48].forEach((fx) => {
        const pole = new THREE.Mesh(poleGeo, bareSteelMat);
        pole.position.set(fx, 0.25, -0.25);
        const banner = new THREE.Mesh(bannerGeo, weaponAccentMat);
        banner.position.set(fx, 0.44, -0.45);
        accGroup.add(pole, banner);
      });
    } else if (accessory === 'radar_dish') {
      const mastGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.24, 8);
      const dishGeo = new THREE.CylinderGeometry(0.32, 0.08, 0.12, 16);
      dishGeo.rotateX(Math.PI * 0.32);
      geometriesToDispose.push(mastGeo, dishGeo);
      const mast = new THREE.Mesh(mastGeo, bareSteelMat);
      const dish = new THREE.Mesh(dishGeo, weaponAccentMat);
      dish.position.y = 0.18;
      accGroup.add(mast, dish);
    } else if (accessory === 'thruster_wings') {
      const wingGeo = rbox(0.68, 0.06, 0.38);
      const jetGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.28, 10);
      jetGeo.rotateX(Math.PI / 2);
      geometriesToDispose.push(wingGeo, jetGeo);
      [-0.65, 0.65].forEach((wx, idx) => {
        const w = new THREE.Mesh(wingGeo, weaponAccentMat);
        w.position.set(wx, -0.04, -0.15);
        w.rotation.z = idx === 0 ? 0.22 : -0.22;
        const j = new THREE.Mesh(jetGeo, visorMat);
        j.position.set(wx * 0.85, -0.02, -0.35);
        accGroup.add(w, j);
      });
    } else if (accessory === 'tesla_horns') {
      const hornGeo = new THREE.ConeGeometry(0.09, 0.52, 10);
      geometriesToDispose.push(hornGeo);
      [-0.38, 0.38].forEach((hx, idx) => {
        const h = new THREE.Mesh(hornGeo, bareSteelMat);
        h.position.set(hx, 0.16, 0.15);
        h.rotation.z = idx === 0 ? 0.45 : -0.45;
        h.rotation.x = 0.28;
        accGroup.add(h);
      });
    } else if (accessory === 'boss_spikes') {
      const spikeGeo = new THREE.ConeGeometry(0.08, 0.32, 6);
      geometriesToDispose.push(spikeGeo);
      [-0.32, 0, 0.32].forEach((sz) => {
        const sp = new THREE.Mesh(spikeGeo, weaponAccentMat);
        sp.position.set(0, 0.08, sz);
        accGroup.add(sp);
      });
    }
  }

  // Underglow Neon Strip under chassis
  if (config.underglowColor && config.underglowColor !== 'none') {
    const glowRingGeo = new THREE.RingGeometry(0.75, 1.25, 32);
    glowRingGeo.rotateX(-Math.PI / 2);
    const glowRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(config.underglowColor),
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    geometriesToDispose.push(glowRingGeo);
    materialsToDispose.push(glowRingMat);
    const glowMesh = new THREE.Mesh(glowRingGeo, glowRingMat);
    glowMesh.position.y = 0.035;
    bodyPivot.add(glowMesh);
  }

  // Aetherium Shield Bubble Mesh (shown when bot has shieldHp > 0)
  const shieldGeo = new THREE.IcosahedronGeometry(1.42, 2);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  geometriesToDispose.push(shieldGeo);
  materialsToDispose.push(shieldMat);
  const shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
  shieldBubble.position.set(0, 0.48, 0);
  shieldBubble.visible = config.armor === 'aetherium';
  bodyPivot.add(shieldBubble);

  // 7. Multi-Weapon Mounting Assemblies (supports all weapons + full 3D placement customization)
  const weaponEntries: BuiltWeaponEntry[] = [];
  const allSecondarySpinners: THREE.Object3D[] = [];
  const weaponPlacements = getBotWeaponPlacements(config);
  let centerFrontTaken = false;

  for (let slotIdx = 0; slotIdx < equippedWeapons.length; slotIdx++) {
    const wId = equippedWeapons[slotIdx];
    const mountGroup = new THREE.Group();
    const pivot = new THREE.Group();
    const spinners: THREE.Object3D[] = [];
    const flameJets: THREE.Mesh[] = [];
    let movingPart: THREE.Object3D | undefined;
    let glowMat: THREE.MeshStandardMaterial | undefined;
    bodyPivot.add(mountGroup);
    mountGroup.add(pivot);

    if (wId === 'vspinner') {
      if (!centerFrontTaken) {
        centerFrontTaken = true;
        pivot.position.set(0, 0.42, 1.08);
        const discGeo = makeToothedDiscGeometry(0.46, 8, 0.18);
        discGeo.rotateY(Math.PI / 2);
        const axleGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.64, 12);
        axleGeo.rotateZ(Math.PI / 2);
        geometriesToDispose.push(discGeo, axleGeo);

        const disc = new THREE.Mesh(discGeo, weaponAccentMat);
        disc.castShadow = castShadow;
        const axle = new THREE.Mesh(axleGeo, bareSteelMat);
        pivot.add(disc, axle);

        const forkGeo = rbox(0.1, 0.22, 0.45);
        geometriesToDispose.push(forkGeo);
        [-0.26, 0.26].forEach((fx) => {
          const fork = new THREE.Mesh(forkGeo, bareSteelMat);
          fork.position.set(fx, -0.06, -0.14);
          pivot.add(fork);
        });
      } else {
        pivot.position.set(0, 0.4, 0.86);
        const miniDiscGeo = makeToothedDiscGeometry(0.32, 8, 0.12);
        miniDiscGeo.rotateY(Math.PI / 2);
        geometriesToDispose.push(miniDiscGeo);
        [-0.78, 0.78].forEach((sx) => {
          const disc = new THREE.Mesh(miniDiscGeo, weaponAccentMat);
          disc.position.set(sx, 0, 0);
          disc.castShadow = castShadow;
          pivot.add(disc);
        });
      }
    } else if (wId === 'drum') {
      // Wide cylindrical toothed drum spinner
      const yPos = centerFrontTaken ? 0.28 : 0.34;
      const zPos = centerFrontTaken ? 1.16 : 1.08;
      centerFrontTaken = true;
      pivot.position.set(0, yPos, zPos);
      const drumCylGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.18, 14);
      drumCylGeo.rotateZ(Math.PI / 2);
      const toothRingGeo = makeToothedDiscGeometry(0.34, 6, 0.08);
      toothRingGeo.rotateY(Math.PI / 2);
      geometriesToDispose.push(drumCylGeo, toothRingGeo);

      const drumCyl = new THREE.Mesh(drumCylGeo, weaponAccentMat);
      drumCyl.castShadow = castShadow;
      pivot.add(drumCyl);
      [-0.42, 0, 0.42].forEach((tx) => {
        const ring = new THREE.Mesh(toothRingGeo, bareSteelMat);
        ring.position.set(tx, 0, 0);
        pivot.add(ring);
      });
    } else if (wId === 'hbar') {
      const yPos = centerFrontTaken ? 0.24 : 0.34;
      const zPos = centerFrontTaken ? 1.12 : 1.05;
      centerFrontTaken = true;
      pivot.position.set(0, yPos, zPos);
      const barGeo = rbox(1.78, 0.1, 0.26);
      const tipBladeGeo = rbox(0.28, 0.14, 0.32);
      const hubGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.24, 12);
      geometriesToDispose.push(barGeo, tipBladeGeo, hubGeo);

      const bar = new THREE.Mesh(barGeo, bareSteelMat);
      bar.castShadow = castShadow;
      const tipL = new THREE.Mesh(tipBladeGeo, weaponAccentMat);
      tipL.position.set(-0.82, 0, 0);
      const tipR = new THREE.Mesh(tipBladeGeo, weaponAccentMat);
      tipR.position.set(0.82, 0, 0);
      const hub = new THREE.Mesh(hubGeo, chassisDarkMat);
      pivot.add(bar, tipL, tipR, hub);
    } else if (wId === 'body_spinner') {
      // Full-Body 360° Cyclone Shell Spinner encompassing the entire bot perimeter
      pivot.position.set(0, 0.32, 0);
      const outerShellGeo = makeToothedDiscGeometry(1.38, 12, 0.16);
      outerShellGeo.rotateX(Math.PI / 2);
      const upperRingGeo = makeToothedDiscGeometry(1.12, 8, 0.09);
      upperRingGeo.rotateX(Math.PI / 2);
      const toothBlockGeo = rbox(0.28, 0.22, 0.18);
      geometriesToDispose.push(outerShellGeo, upperRingGeo, toothBlockGeo);

      const outerShell = new THREE.Mesh(outerShellGeo, weaponAccentMat);
      outerShell.castShadow = castShadow;
      pivot.add(outerShell);

      for (let ti = 0; ti < 6; ti++) {
        const ta = (ti / 6) * Math.PI * 2;
        const tooth = new THREE.Mesh(toothBlockGeo, bareSteelMat);
        tooth.position.set(Math.cos(ta) * 1.32, 0.02, Math.sin(ta) * 1.32);
        tooth.rotation.y = -ta;
        tooth.castShadow = castShadow;
        pivot.add(tooth);
      }

      const upperRing = new THREE.Mesh(upperRingGeo, bareSteelMat);
      upperRing.position.y = 0.18;
      pivot.add(upperRing);
      spinners.push(upperRing);
      allSecondarySpinners.push(upperRing);
    } else if (wId === 'sawblade') {
      const wideWing = centerFrontTaken;
      if (!wideWing) centerFrontTaken = true;
      pivot.position.set(0, wideWing ? 0.38 : 0.32, wideWing ? 0.78 : 1.06);
      const sawGeo = makeToothedDiscGeometry(wideWing ? 0.32 : 0.36, 14, 0.07);
      sawGeo.rotateX(Math.PI / 2);
      const mountGeo = rbox(wideWing ? 1.78 : 1.12, 0.1, 0.28);
      geometriesToDispose.push(sawGeo, mountGeo);

      const mount = new THREE.Mesh(mountGeo, chassisDarkMat);
      mount.position.set(0, 0, -0.14);
      const sawX = wideWing ? 0.86 : 0.42;
      const sawL = new THREE.Mesh(sawGeo, bareSteelMat);
      sawL.position.set(-sawX, 0, 0.04);
      sawL.castShadow = castShadow;
      const sawR = new THREE.Mesh(sawGeo, weaponAccentMat);
      sawR.position.set(sawX, 0, 0.04);
      sawR.castShadow = castShadow;
      pivot.add(mount, sawL, sawR);
      spinners.push(sawL, sawR);
      allSecondarySpinners.push(sawL, sawR);
    } else if (wId === 'flipper') {
      centerFrontTaken = true;
      pivot.position.set(0, 0.22, 0.48);
      const armGeo = rbox(1.12, 0.1, 0.95);
      const wedgeTipGeo = rbox(1.12, 0.06, 0.36);
      geometriesToDispose.push(armGeo, wedgeTipGeo);

      const arm = new THREE.Mesh(armGeo, weaponAccentMat);
      arm.position.set(0, 0.04, 0.44);
      arm.castShadow = castShadow;
      const tip = new THREE.Mesh(wedgeTipGeo, bareSteelMat);
      tip.position.set(0, 0.01, 0.92);
      tip.rotation.x = 0.25;
      pivot.add(arm, tip);
    } else if (wId === 'crush_jaw') {
      // Twin hydraulic crushing pincer jaws
      centerFrontTaken = true;
      pivot.position.set(0, 0.32, 0.82);
      const jawArmGeo = rbox(0.18, 0.18, 0.78);
      const fangGeo = new THREE.ConeGeometry(0.12, 0.36, 6);
      fangGeo.rotateZ(Math.PI / 2);
      geometriesToDispose.push(jawArmGeo, fangGeo);

      const leftJaw = new THREE.Group();
      leftJaw.position.set(-0.48, 0, 0);
      const lArm = new THREE.Mesh(jawArmGeo, weaponAccentMat);
      lArm.position.set(0, 0, 0.34);
      const lFang = new THREE.Mesh(fangGeo, bareSteelMat);
      lFang.position.set(0.16, 0, 0.68);
      lFang.rotation.z = -Math.PI / 2;
      leftJaw.add(lArm, lFang);

      const rightJaw = new THREE.Group();
      rightJaw.position.set(0.48, 0, 0);
      const rArm = new THREE.Mesh(jawArmGeo, weaponAccentMat);
      rArm.position.set(0, 0, 0.34);
      const rFang = new THREE.Mesh(fangGeo, bareSteelMat);
      rFang.position.set(-0.16, 0, 0.68);
      rFang.rotation.z = Math.PI / 2;
      rightJaw.add(rArm, rFang);

      pivot.add(leftJaw, rightJaw);
      spinners.push(leftJaw, rightJaw);
    } else if (wId === 'flame' || wId === 'cryo_jet') {
      const isCryo = wId === 'cryo_jet';
      const isSecondary = equippedWeapons[0] !== wId;
      const offsets = isSecondary ? [-0.56, 0.56] : [0];
      pivot.position.set(0, isSecondary ? 0.58 : 0.46, isSecondary ? 0.62 : 0.95);

      const barrelGeo = new THREE.CylinderGeometry(
        isSecondary ? 0.075 : 0.11,
        isSecondary ? 0.1 : 0.15,
        isSecondary ? 0.44 : 0.56,
        12,
      );
      barrelGeo.rotateX(Math.PI / 2);
      const tankGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.42, 12);
      tankGeo.rotateZ(Math.PI / 2);
      const nozzleGeo = new THREE.CylinderGeometry(0.11, 0.08, 0.16, 12);
      nozzleGeo.rotateX(Math.PI / 2);
      const jetGeo = new THREE.ConeGeometry(isSecondary ? 0.3 : 0.46, isSecondary ? 2.1 : 2.5, 14, 1, true);
      jetGeo.rotateX(-Math.PI / 2);
      jetGeo.translate(0, 0, isSecondary ? 1.32 : 1.55);

      const streamMat = new THREE.MeshBasicMaterial({
        color: isCryo ? 0x38bdf8 : 0xf97316,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      geometriesToDispose.push(barrelGeo, tankGeo, nozzleGeo, jetGeo);
      materialsToDispose.push(streamMat);

      for (const ox of offsets) {
        const barrel = new THREE.Mesh(barrelGeo, bareSteelMat);
        barrel.position.set(ox, 0, 0.14);
        const tank = new THREE.Mesh(tankGeo, isCryo ? visorMat : weaponAccentMat);
        tank.position.set(ox, 0.07, -0.18);
        const nozzle = new THREE.Mesh(nozzleGeo, chassisDarkMat);
        nozzle.position.set(ox, 0, 0.4);
        const jet = new THREE.Mesh(jetGeo, streamMat);
        jet.position.set(ox, 0, 0);
        jet.visible = false;
        pivot.add(barrel, tank, nozzle, jet);
        flameJets.push(jet);
      }
    } else if (wId === 'tesla') {
      // Twin high-voltage Tesla coil emitters with glowing toroid rings
      pivot.position.set(0, deckTopY + 0.04, 0.42);
      const mastGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.42, 10);
      const ringGeo = new THREE.TorusGeometry(0.14, 0.03, 8, 20);
      ringGeo.rotateX(Math.PI / 2);
      const orbGeo = new THREE.SphereGeometry(0.09, 10, 10);
      geometriesToDispose.push(mastGeo, ringGeo, orbGeo);

      [-0.44, 0.44].forEach((tx) => {
        const coilGroup = new THREE.Group();
        coilGroup.position.set(tx, 0, 0);
        const mast = new THREE.Mesh(mastGeo, bareSteelMat);
        mast.position.y = 0.21;
        const r1 = new THREE.Mesh(ringGeo, weaponAccentMat);
        r1.position.y = 0.2;
        const r2 = new THREE.Mesh(ringGeo, visorMat);
        r2.position.y = 0.34;
        const orb = new THREE.Mesh(orbGeo, visorMat);
        orb.position.y = 0.45;
        coilGroup.add(mast, r1, r2, orb);
        pivot.add(coilGroup);
        spinners.push(coilGroup);
      });
    } else if (wId === 'laser') {
      // Twin-lens Aether Ruby Laser Beam Emitter
      pivot.position.set(0, deckTopY + 0.06, 0.24);
      const housingGeo = rbox(0.46, 0.22, 0.66);
      const barrelGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.88, 12);
      barrelGeo.rotateX(Math.PI / 2);
      const lensRingGeo = new THREE.TorusGeometry(0.068, 0.016, 8, 20);
      const crystalGeo = new THREE.OctahedronGeometry(0.11, 0);
      geometriesToDispose.push(housingGeo, barrelGeo, lensRingGeo, crystalGeo);

      const laserGlowMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 1.6,
        roughness: 0.15,
        metalness: 0.5,
      });
      materialsToDispose.push(laserGlowMat);

      const housing = new THREE.Mesh(housingGeo, chassisDarkMat);
      housing.position.set(0, 0.12, -0.06);
      housing.castShadow = castShadow;
      const crystal = new THREE.Mesh(crystalGeo, laserGlowMat);
      crystal.position.set(0, 0.26, -0.04);
      pivot.add(housing, crystal);
      spinners.push(crystal);

      [-0.13, 0.13].forEach((lx) => {
        const barrel = new THREE.Mesh(barrelGeo, bareSteelMat);
        barrel.position.set(lx, 0.13, 0.42);
        const lens = new THREE.Mesh(lensRingGeo, laserGlowMat);
        lens.position.set(lx, 0.13, 0.86);
        pivot.add(barrel, lens);
      });
      glowMat = laserGlowMat;
    } else if (wId === 'railgun') {
      // Long-barrel electromagnetic Gauss Railgun
      pivot.position.set(0, deckTopY + 0.06, 0.18);
      const breechGeo = rbox(0.42, 0.24, 0.68);
      const railGeo = rbox(0.07, 0.1, 1.48);
      const coreGlowGeo = rbox(0.1, 0.05, 1.38);
      geometriesToDispose.push(breechGeo, railGeo, coreGlowGeo);

      const breech = new THREE.Mesh(breechGeo, chassisDarkMat);
      breech.position.set(0, 0.12, -0.1);
      const railL = new THREE.Mesh(railGeo, bareSteelMat);
      railL.position.set(-0.12, 0.14, 0.56);
      const railR = new THREE.Mesh(railGeo, bareSteelMat);
      railR.position.set(0.12, 0.14, 0.56);
      const coreGlow = new THREE.Mesh(coreGlowGeo, visorMat);
      coreGlow.position.set(0, 0.14, 0.54);
      pivot.add(breech, railL, railR, coreGlow);
    } else if (wId === 'mortar') {
      // Dorsal dual-barrel plasma artillery mortar
      pivot.position.set(0, deckTopY + 0.08, -0.18);
      const baseGeo = rbox(0.56, 0.18, 0.52);
      const tubeGeo = new THREE.CylinderGeometry(0.14, 0.17, 0.62, 12);
      tubeGeo.rotateX(Math.PI * 0.28);
      geometriesToDispose.push(baseGeo, tubeGeo);

      const base = new THREE.Mesh(baseGeo, chassisDarkMat);
      pivot.add(base);
      [-0.16, 0.16].forEach((mx) => {
        const tube = new THREE.Mesh(tubeGeo, weaponAccentMat);
        tube.position.set(mx, 0.24, 0.12);
        pivot.add(tube);
      });
    } else if (wId === 'missiles') {
      // Shoulder rocket pod: 2x3 launch tubes angled slightly skyward
      pivot.position.set(-0.5, deckTopY + 0.04, -0.12);
      const podGeo = rbox(0.46, 0.32, 0.62);
      const tubeGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.66, 10, 1, true);
      tubeGeo.rotateX(Math.PI / 2);
      const noseGeo = new THREE.ConeGeometry(0.05, 0.12, 8);
      noseGeo.rotateX(Math.PI / 2);
      const mountGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.2, 8);
      geometriesToDispose.push(podGeo, tubeGeo, noseGeo, mountGeo);
      const mount = new THREE.Mesh(mountGeo, bareSteelMat);
      mount.position.y = -0.06;
      pivot.add(mount);
      const pod = new THREE.Group();
      pod.position.y = 0.2;
      pod.rotation.x = -0.22;
      const box = new THREE.Mesh(podGeo, weaponAccentMat);
      box.castShadow = castShadow;
      pod.add(box);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const tx = (c - 1) * 0.14;
          const ty = (r - 0.5) * 0.14;
          const tube = new THREE.Mesh(tubeGeo, chassisDarkMat);
          tube.position.set(tx, ty, 0.02);
          const nose = new THREE.Mesh(noseGeo, visorMat);
          nose.position.set(tx, ty, 0.3);
          pod.add(tube, nose);
        }
      }
      pivot.add(pod);
      movingPart = pod;
    } else if (wId === 'lance') {
      // Pneumatic lance: sleeve cylinder with a sliding armor-piercing spike
      const side = centerFrontTaken;
      centerFrontTaken = true;
      pivot.position.set(side ? -0.6 : 0, side ? 0.5 : 0.36, side ? 0.72 : 0.78);
      const sleeveGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.7, 12);
      sleeveGeo.rotateX(Math.PI / 2);
      const rodGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.9, 10);
      rodGeo.rotateX(Math.PI / 2);
      const spikeGeo = new THREE.ConeGeometry(0.11, 0.4, 10);
      spikeGeo.rotateX(Math.PI / 2);
      geometriesToDispose.push(sleeveGeo, rodGeo, spikeGeo);
      const sleeve = new THREE.Mesh(sleeveGeo, chassisDarkMat);
      sleeve.castShadow = castShadow;
      const rodGroup = new THREE.Group();
      const rod = new THREE.Mesh(rodGeo, bareSteelMat);
      rod.position.z = 0.36;
      const spike = new THREE.Mesh(spikeGeo, weaponAccentMat);
      spike.position.z = 0.98;
      spike.castShadow = castShadow;
      rodGroup.add(rod, spike);
      pivot.add(sleeve, rodGroup);
      movingPart = rodGroup;
    } else if (wId === 'magnet') {
      // Grapple electromagnet dish on an articulated arm
      const side = centerFrontTaken;
      centerFrontTaken = true;
      pivot.position.set(side ? 0.62 : 0, side ? 0.6 : 0.5, side ? 0.66 : 0.96);
      const armGeo = rbox(0.12, 0.12, 0.42);
      const dishGeo = new THREE.CylinderGeometry(0.3, 0.24, 0.12, 20);
      dishGeo.rotateX(Math.PI / 2);
      const faceGeo = new THREE.CircleGeometry(0.24, 20);
      const coilGeo = new THREE.TorusGeometry(0.17, 0.03, 6, 20);
      geometriesToDispose.push(armGeo, dishGeo, faceGeo, coilGeo);
      const magGlow = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.4,
      });
      materialsToDispose.push(magGlow);
      const arm = new THREE.Mesh(armGeo, bareSteelMat);
      arm.position.z = -0.12;
      const dish = new THREE.Mesh(dishGeo, chassisDarkMat);
      dish.position.z = 0.14;
      dish.castShadow = castShadow;
      const face = new THREE.Mesh(faceGeo, magGlow);
      face.position.z = 0.205;
      const coil = new THREE.Mesh(coilGeo, weaponAccentMat);
      coil.position.z = 0.21;
      pivot.add(arm, dish, face, coil);
      glowMat = magGlow;
    } else if (wId === 'lightning_strike') {
      // Dorsal Orbital Lightning Strike Spire with triple corona rings & skyward plasma rod
      pivot.position.set(0, deckTopY + 0.05, -0.04);
      const baseGeo = new THREE.CylinderGeometry(0.24, 0.3, 0.14, 12);
      const rodGeo = new THREE.CylinderGeometry(0.035, 0.065, 0.78, 10);
      const ringGeo = new THREE.TorusGeometry(0.2, 0.032, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const crownGeo = new THREE.OctahedronGeometry(0.13, 1);
      geometriesToDispose.push(baseGeo, rodGeo, ringGeo, crownGeo);

      const boltGlowMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.8,
        roughness: 0.15,
        metalness: 0.6,
      });
      materialsToDispose.push(boltGlowMat);

      const base = new THREE.Mesh(baseGeo, chassisDarkMat);
      base.position.y = 0.07;
      const rod = new THREE.Mesh(rodGeo, bareSteelMat);
      rod.position.y = 0.44;
      const crown = new THREE.Mesh(crownGeo, boltGlowMat);
      crown.position.y = 0.86;
      pivot.add(base, rod, crown);
      spinners.push(crown);

      [0.24, 0.44, 0.64].forEach((ry, rIdx) => {
        const ring = new THREE.Mesh(ringGeo, rIdx % 2 === 0 ? boltGlowMat : weaponAccentMat);
        ring.position.y = ry;
        ring.scale.setScalar(1 - rIdx * 0.16);
        pivot.add(ring);
        spinners.push(ring);
      });
      glowMat = boltGlowMat;
    } else if (wId === 'bomb_drop') {
      // Dorsal Aerial Bomb Bay Ordnance Rack with twin heavy finned bombs
      pivot.position.set(0, deckTopY + 0.06, -0.14);
      const rackGeo = rbox(0.76, 0.12, 0.58);
      const bombBodyGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.48, 12);
      bombBodyGeo.rotateX(Math.PI / 2);
      const bombNoseGeo = new THREE.SphereGeometry(0.11, 12, 10);
      const finGeo = rbox(0.26, 0.24, 0.04);
      geometriesToDispose.push(rackGeo, bombBodyGeo, bombNoseGeo, finGeo);

      const warheadMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.9,
        roughness: 0.25,
        metalness: 0.5,
      });
      materialsToDispose.push(warheadMat);

      const rack = new THREE.Mesh(rackGeo, chassisDarkMat);
      rack.position.y = 0.08;
      pivot.add(rack);

      const bombPair = new THREE.Group();
      [-0.24, 0.24].forEach((bx) => {
        const body = new THREE.Mesh(bombBodyGeo, bareSteelMat);
        body.position.set(bx, 0.22, 0.04);
        const nose = new THREE.Mesh(bombNoseGeo, warheadMat);
        nose.position.set(bx, 0.22, 0.28);
        const fins = new THREE.Mesh(finGeo, weaponAccentMat);
        fins.position.set(bx, 0.22, -0.2);
        bombPair.add(body, nose, fins);
      });
      pivot.add(bombPair);
      movingPart = bombPair;
      glowMat = warheadMat;
    } else {
      // Overhead Hammer
      const hammerY =
        primaryChassis === 'monolith'
          ? 1.16
          : primaryChassis === 'behemoth' || primaryChassis === 'juggernaut'
            ? 0.76
            : 0.64;
      pivot.position.set(0, hammerY, 0.08);
      const shaftGeo = rbox(0.14, 0.14, 1.08);
      const headGeo = rbox(0.54, 0.34, 0.34);
      const spikeGeo = new THREE.ConeGeometry(0.12, 0.26, 6);
      spikeGeo.rotateX(Math.PI);
      geometriesToDispose.push(shaftGeo, headGeo, spikeGeo);

      const shaft = new THREE.Mesh(shaftGeo, bareSteelMat);
      shaft.position.set(0, 0.18, 0.46);
      shaft.castShadow = castShadow;
      const head = new THREE.Mesh(headGeo, weaponAccentMat);
      head.position.set(0, 0.2, 0.98);
      head.castShadow = castShadow;
      const spike = new THREE.Mesh(spikeGeo, bareSteelMat);
      spike.position.set(0, 0.0, 0.98);
      pivot.add(shaft, head, spike);
    }

    const placement = weaponPlacements[slotIdx] ?? getDefaultWeaponPlacement(wId, slotIdx);
    const defPlacement = getDefaultWeaponPlacement(wId, slotIdx);
    if (placement.zone !== defPlacement.zone) {
      let ax = 0;
      let ay = 0.38;
      let az = 0;
      if (placement.zone === 'front') {
        ax = 0;
        ay = 0.36;
        az = 1.02;
      } else if (placement.zone === 'top_front') {
        ax = 0;
        ay = deckTopY + 0.06;
        az = 0.34;
      } else if (placement.zone === 'top_rear') {
        ax = 0;
        ay = deckTopY + 0.08;
        az = -0.32;
      } else if (placement.zone === 'left') {
        ax = -0.9;
        ay = 0.4;
        az = 0.08;
      } else if (placement.zone === 'right') {
        ax = 0.9;
        ay = 0.4;
        az = 0.08;
      } else if (placement.zone === 'rear') {
        ax = 0;
        ay = 0.38;
        az = -0.98;
      }
      pivot.position.set(0, 0, 0);
      mountGroup.position.set(
        ax + (placement.offsetX || 0),
        ay + (placement.offsetY || 0),
        az + (placement.offsetZ || 0),
      );
    } else {
      mountGroup.position.set(
        placement.offsetX || 0,
        placement.offsetY || 0,
        placement.offsetZ || 0,
      );
    }
    mountGroup.rotation.y = THREE.MathUtils.degToRad(placement.yawDeg || 0);
    mountGroup.scale.setScalar(Math.max(0.65, Math.min(1.45, placement.scale || 1)));

    weaponEntries.push({
      weaponId: wId,
      mountGroup,
      pivot,
      baseZ: pivot.position.z,
      secondarySpinners: spinners,
      flameJets,
      movingPart,
      glowMat,
    });
  }

  const primaryPivot = weaponEntries[0]?.pivot || new THREE.Group();
  const primaryFlameJet = weaponEntries.find((w) => w.flameJets.length > 0)?.flameJets[0];

  // 8. Contact Shadow Plane
  const shadowGeo = new THREE.PlaneGeometry(2.7, 2.7);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  geometriesToDispose.push(shadowGeo);
  materialsToDispose.push(shadowMat);
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  return {
    root,
    bodyPivot,
    weaponPivot: primaryPivot,
    weaponEntries,
    secondarySpinners: allSecondarySpinners,
    flameJetMesh: primaryFlameJet,
    wheels,
    accessoryPivot,
    shieldBubble,
    fans,
    isHover,
    wheelCorners,
    iceShell,
    heatMats: Array.from(
      new Set<THREE.MeshPhysicalMaterial>([
        ...(chassisMesh.material instanceof THREE.MeshPhysicalMaterial ? [chassisMesh.material] : []),
        chassisDarkMat,
        ...Object.values(armorMaterials),
      ]),
    ),
    armorPlates,
    armorMaterials,
    damageableMeshes,
    decalPool,
    visorMat,
    shadowPlane,
    applyDamageDecal: (decalPack, localPos, localNormal, force, kind) => {
      applyImpactToBotMeshes({
        bodyPivot,
        damageableMeshes,
        decalPool,
        decalPack,
        localPos,
        localNormal,
        force,
        kind,
      });
    },
    dispose: () => {
      decalPool.forEach((d) => {
        d.parent.remove(d.mesh);
        d.mesh.geometry.dispose();
      });
      decalPool.length = 0;
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      texturesToDispose.forEach((t) => t.dispose());
    },
  };
}

export function syncBotRigToState(
  rig: BuiltBotRig,
  state: BotPhysicsState,
  dt: number,
  isPlayer = false,
) {
  rig.root.position.set(state.x, 0, state.z);
  rig.root.scale.setScalar(state.scale || 1.0);
  const nowT = performance.now() * 0.001;
  const flipA = state.flipAngle ?? 0;
  rig.bodyPivot.position.y =
    state.y +
    (rig.isHover && !state.isDead && !state.flipped ? 0.1 + Math.sin(nowT * 4.2 + state.x) * 0.025 : 0) +
    0.66 * (1 - Math.cos(flipA)) * 0.5;
  const fullBodySpinOffset =
    !state.isDead &&
    (state.config.chassis === 'shell_spinner' || state.config.weapon === 'body_spinner') &&
    state.weaponSpin > 0.04
      ? state.weaponAngle * 1.15
      : 0;
  rig.bodyPivot.rotation.set(state.pitch, state.yaw + fullBodySpinOffset, state.roll + flipA, 'YXZ');

  // Lost parts are gone from the hull (they are lying on the floor as debris)
  const comp = state.components;
  if (comp) {
    rig.wheels.forEach((w, i) => {
      w.visible = (comp.wheels[rig.wheelCorners[i]] ?? 100) > 0;
    });
    rig.weaponEntries.forEach((entry, slot) => {
      const h = comp.weapons[slot] ?? 100;
      entry.mountGroup.visible = h > 0;
      entry.pivot.visible = h > 0;
      // Badly damaged weapons wobble on bent mounts
      if (h > 0 && h < 35) entry.pivot.rotation.z = Math.sin(nowT * 23 + slot) * 0.06 * (1 - h / 35);
    });
  }

  // Heat: plates glow cherry red, then sag as they melt
  const heat = state.heat ?? 0;
  const glow = Math.max(0, (heat - 28) / 72);
  for (const m of rig.heatMats) {
    if (m.userData.baseEmissive === undefined) {
      m.userData.baseEmissive = m.emissive.getHex();
      m.userData.baseEmissiveIntensity = m.emissiveIntensity;
    }
    if (glow > 0.01) {
      // Dull cherry red first, brighter orange as it approaches melting point
      m.emissive.setRGB(0.9, 0.08 + glow * 0.22, 0.01);
      m.emissiveIntensity = glow * (0.85 + Math.sin(nowT * 9) * 0.1);
    } else if (m.emissive.getHex() !== m.userData.baseEmissive) {
      m.emissive.setHex(m.userData.baseEmissive as number);
      m.emissiveIntensity = m.userData.baseEmissiveIntensity as number;
    }
  }

  // Cryo: ice shell builds up, full block when frozen solid
  const chill = state.chill ?? 0;
  const frozenSolid = (state.frozenTimer ?? 0) > 0;
  rig.iceShell.visible = !state.isDead && (chill > 10 || frozenSolid);
  if (rig.iceShell.visible) {
    const iceMat = rig.iceShell.material as THREE.MeshPhysicalMaterial;
    iceMat.opacity = frozenSolid ? 0.78 : 0.12 + (chill / 100) * 0.45;
    const sc = frozenSolid ? 1.06 : 0.8 + (chill / 100) * 0.22;
    rig.iceShell.scale.set(sc, frozenSolid ? 1.1 : 0.55 + (chill / 100) * 0.5, sc);
  }
  for (const f of rig.fans) f.rotation.y += dt * (state.isDead ? 2 : 38);

  rig.shadowPlane.position.y = 0.025;
  const heightFade = Math.max(0.15, 1 - state.y * 0.18);
  (rig.shadowPlane.material as THREE.MeshBasicMaterial).opacity = 0.65 * heightFade;
  rig.shadowPlane.scale.setScalar(1 + state.y * 0.12);

  const speed = Math.hypot(state.vx, state.vz);
  for (const w of rig.wheels) {
    w.rotation.x += speed * dt * 2.4;
  }

  if (rig.accessoryPivot) {
    rig.accessoryPivot.rotation.y += dt * 1.6;
  }

  if (rig.shieldBubble) {
    const hasShield = !state.isDead && (state.shieldHp ?? 0) > 1;
    rig.shieldBubble.visible = hasShield;
    if (hasShield) {
      rig.shieldBubble.rotation.y += dt * 0.9;
      const ratio = Math.min(1, (state.shieldHp ?? 0) / Math.max(1, state.maxShieldHp || 65));
      (rig.shieldBubble.material as THREE.MeshBasicMaterial).opacity = 0.08 + ratio * 0.18;
    }
  }

  // Animate ALL mounted weapons independently per slot on the hybrid bot
  rig.weaponEntries.forEach((entry, slotIdx) => {
    const angle = state.weaponAngles?.[slotIdx] ?? state.weaponAngle;
    const spin = state.weaponSpins?.[slotIdx] ?? state.weaponSpin;
    const active = state.weaponActives?.[slotIdx] ?? state.weaponActive;

    if (entry.weaponId === 'vspinner' || entry.weaponId === 'drum') {
      entry.pivot.rotation.x = angle;
    } else if (entry.weaponId === 'hbar') {
      entry.pivot.rotation.y = angle;
    } else if (entry.weaponId === 'body_spinner') {
      entry.pivot.rotation.y = angle * 1.35;
      entry.secondarySpinners.forEach((s) => {
        s.rotation.y = -angle * 0.95;
      });
    } else if (entry.weaponId === 'sawblade') {
      entry.secondarySpinners.forEach((s, idx) => {
        s.rotation.y = idx === 0 ? angle : -angle;
      });
    } else if (entry.weaponId === 'flipper') {
      entry.pivot.rotation.x = -spin * 0.95;
    } else if (entry.weaponId === 'crush_jaw') {
      entry.secondarySpinners.forEach((jaw, idx) => {
        jaw.rotation.y = (idx === 0 ? -1 : 1) * spin * 0.55;
      });
    } else if (entry.weaponId === 'flame' || entry.weaponId === 'cryo_jet') {
      for (const jet of entry.flameJets) {
        jet.visible = active && !state.isDead;
        if (jet.visible) {
          const flicker = 0.85 + Math.random() * 0.35;
          jet.scale.set(flicker, flicker, 0.88 + Math.random() * 0.28);
        }
      }
    } else if (entry.weaponId === 'tesla') {
      entry.secondarySpinners.forEach((c) => {
        c.rotation.y += dt * (active ? 8 : 2.5);
      });
    } else if (entry.weaponId === 'laser') {
      entry.secondarySpinners.forEach((c) => {
        c.rotation.y += dt * (active ? 10 : 3);
      });
      if (entry.glowMat) {
        entry.glowMat.emissiveIntensity = active || spin > 0.25 ? 3.2 : 1.2 + Math.sin(nowT * 5) * 0.3;
      }
    } else if (entry.weaponId === 'railgun') {
      entry.pivot.position.z = entry.baseZ - spin * 0.42;
    } else if (entry.weaponId === 'mortar') {
      entry.pivot.rotation.x = -spin * 0.55;
    } else if (entry.weaponId === 'hammer') {
      entry.pivot.rotation.x = spin > 0.5 ? -0.95 : spin * 1.3;
    } else if (entry.weaponId === 'lance') {
      if (entry.movingPart) entry.movingPart.position.z = spin > 0.55 ? 1.25 * spin : spin * 0.6;
    } else if (entry.weaponId === 'missiles') {
      if (entry.movingPart) entry.movingPart.position.z = -spin * 0.12;
    } else if (entry.weaponId === 'magnet') {
      if (entry.glowMat) {
        entry.glowMat.emissiveIntensity = spin > 0.3 ? 2.8 * spin : 0.35 + Math.sin(nowT * 3) * 0.1;
      }
    }
  });

  (['front', 'left', 'right', 'rear'] as Array<keyof ArmorZones>).forEach((zone) => {
    const plate = rig.armorPlates[zone];
    const mat = rig.armorMaterials[zone];
    const ratio = state.maxArmorZone > 0 ? state.armorZones[zone] / state.maxArmorZone : 0;
    if (ratio <= 0) {
      plate.visible = false;
    } else {
      plate.visible = true;
      const melt = state.meltZones?.[zone] ?? 0;
      const tint = (0.45 + ratio * 0.55) * (1 - melt * 0.45);
      plate.scale.y = 1 - melt * 0.5;
      plate.position.y = (plate.userData.baseY ??= plate.position.y) - melt * 0.07;
      if ((state.freezeTimer ?? 0) > 0) {
        mat.color.setHex(0x7dd3fc).multiplyScalar(tint);
      } else {
        mat.color.set((mat.userData.baseColor as string | undefined) ?? state.config.primaryColor).multiplyScalar(tint);
      }
      mat.roughness = Math.min(0.85, 0.25 + (1 - ratio) * 0.5);
    }
  });

  if (state.isDead) {
    rig.visorMat.emissiveIntensity = 0.1;
    rig.visorMat.color.setHex(0x334155);
  } else if (state.overdriveTimer > 0) {
    rig.visorMat.emissiveIntensity = 2.6;
    rig.visorMat.color.setHex(0x38bdf8);
    rig.visorMat.emissive.setHex(0x38bdf8);
  } else if ((state.damageBoostTimer ?? 0) > 0) {
    rig.visorMat.emissiveIntensity = 2.8;
    rig.visorMat.color.setHex(0xf97316);
    rig.visorMat.emissive.setHex(0xf97316);
  } else {
    rig.visorMat.emissiveIntensity = isPlayer ? 1.8 : 1.3;
    rig.visorMat.color.set(state.config.accentColor);
    rig.visorMat.emissive.set(state.config.accentColor);
  }
}
