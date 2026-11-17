import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import type { DamageKind } from '../shared/types';

export interface DamageDecalPack {
  materials: Record<DamageKind, THREE.MeshStandardMaterial>;
  textures: THREE.Texture[];
  dispose: () => void;
}

export interface BotDecalEntry {
  mesh: THREE.Mesh;
  parent: THREE.Object3D;
}

const MAX_DECALS_PER_BOT = 26;

const _raycaster = new THREE.Raycaster();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _worldNorm = new THREE.Vector3();
const _worldDummy = new THREE.Object3D();
const _up = new THREE.Vector3(0, 0, 1);
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _size = new THREE.Vector3();
const _invWorld = new THREE.Matrix4();
const _normMat = new THREE.Matrix3();
const _localPt = new THREE.Vector3();
const _localNrm = new THREE.Vector3();
const _v = new THREE.Vector3();
const _box = new THREE.Box3();

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function buildDentTextures(maxAnisotropy: number) {
  const [cCanvas, ctx] = makeCanvas(256);
  const [bCanvas, bCtx] = makeCanvas(256);

  // Albedo: dark compressed crater + bright torn steel rim + micro fractures
  const rad = ctx.createRadialGradient(128, 128, 8, 128, 128, 114);
  rad.addColorStop(0, 'rgba(18, 22, 28, 0.94)');
  rad.addColorStop(0.45, 'rgba(38, 44, 54, 0.84)');
  rad.addColorStop(0.72, 'rgba(210, 222, 236, 0.72)');
  rad.addColorStop(0.9, 'rgba(148, 163, 184, 0.25)');
  rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rad;
  ctx.beginPath();
  ctx.arc(128, 128, 116, 0, Math.PI * 2);
  ctx.fill();

  // Radial stress cracks & scrapes
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.22;
    const r0 = 18;
    const r1 = 78 + (i % 4) * 11;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(226, 232, 240, 0.7)' : 'rgba(15, 18, 24, 0.85)';
    ctx.lineWidth = i % 3 === 0 ? 3.2 : 1.8;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0);
    ctx.lineTo(128 + Math.cos(a + 0.09) * r1, 128 + Math.sin(a + 0.09) * r1);
    ctx.stroke();
  }

  // Bump: depressed center (dark) with raised lip (bright)
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  const bRad = bCtx.createRadialGradient(128, 128, 6, 128, 128, 110);
  bRad.addColorStop(0, '#101010');
  bRad.addColorStop(0.55, '#3a3a3a');
  bRad.addColorStop(0.8, '#d8d8d8');
  bRad.addColorStop(1, '#808080');
  bCtx.fillStyle = bRad;
  bCtx.beginPath();
  bCtx.arc(128, 128, 112, 0, Math.PI * 2);
  bCtx.fill();

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function buildBladeSlashTextures(maxAnisotropy: number) {
  const [cCanvas, ctx] = makeCanvas(256);
  const [bCanvas, bCtx] = makeCanvas(256);

  ctx.save();
  ctx.translate(128, 128);
  ctx.rotate(-0.48);

  // Outer bare-metal torn paint bevel
  const grad = ctx.createLinearGradient(0, -34, 0, 34);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.22, 'rgba(226, 232, 240, 0.78)');
  grad.addColorStop(0.45, 'rgba(18, 22, 28, 0.96)');
  grad.addColorStop(0.55, 'rgba(18, 22, 28, 0.96)');
  grad.addColorStop(0.78, 'rgba(226, 232, 240, 0.72)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 108, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Secondary parallel saw scratch
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.65)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-88, -16);
  ctx.lineTo(86, -12);
  ctx.stroke();
  ctx.restore();

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  bCtx.save();
  bCtx.translate(128, 128);
  bCtx.rotate(-0.48);
  const bGrad = bCtx.createLinearGradient(0, -28, 0, 28);
  bGrad.addColorStop(0, '#808080');
  bGrad.addColorStop(0.25, '#dcdcdc');
  bGrad.addColorStop(0.5, '#121212');
  bGrad.addColorStop(0.75, '#dcdcdc');
  bGrad.addColorStop(1, '#808080');
  bCtx.fillStyle = bGrad;
  bCtx.beginPath();
  bCtx.ellipse(0, 0, 106, 24, 0, 0, Math.PI * 2);
  bCtx.fill();
  bCtx.restore();

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function buildCrushTextures(maxAnisotropy: number) {
  const [cCanvas, ctx] = makeCanvas(256);
  const [bCanvas, bCtx] = makeCanvas(256);

  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 118);
  grad.addColorStop(0, 'rgba(10, 12, 16, 0.96)');
  grad.addColorStop(0.4, 'rgba(30, 35, 44, 0.9)');
  grad.addColorStop(0.68, 'rgba(203, 213, 225, 0.78)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fill();

  // Heavy anvil star fractures
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 14, 128 + Math.sin(a) * 14);
    ctx.lineTo(128 + Math.cos(a + 0.14) * 56, 128 + Math.sin(a + 0.14) * 56);
    ctx.lineTo(128 + Math.cos(a - 0.05) * 102, 128 + Math.sin(a - 0.05) * 102);
    ctx.stroke();
  }

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  const bRad = bCtx.createRadialGradient(128, 128, 8, 128, 128, 114);
  bRad.addColorStop(0, '#080808');
  bRad.addColorStop(0.5, '#2b2b2b');
  bRad.addColorStop(0.78, '#ebebeb');
  bRad.addColorStop(1, '#808080');
  bCtx.fillStyle = bRad;
  bCtx.beginPath();
  bCtx.arc(128, 128, 114, 0, Math.PI * 2);
  bCtx.fill();

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function buildScorchTexture(maxAnisotropy: number) {
  const [canvas, ctx] = makeCanvas(256);

  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
  grad.addColorStop(0, 'rgba(10, 10, 12, 0.94)');
  grad.addColorStop(0.45, 'rgba(24, 18, 16, 0.82)');
  grad.addColorStop(0.72, 'rgba(120, 53, 15, 0.42)');
  grad.addColorStop(0.88, 'rgba(56, 189, 248, 0.14)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();

  // Carbon soot flecks
  for (let i = 0; i < 42; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 16 + Math.random() * 88;
    const sz = 4 + Math.random() * 14;
    ctx.fillStyle = i % 5 === 0 ? 'rgba(194, 65, 12, 0.35)' : 'rgba(12, 12, 14, 0.55)';
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, sz, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;
  return map;
}

export function createDamageDecalPack(maxAnisotropy: number): DamageDecalPack {
  const dent = buildDentTextures(maxAnisotropy);
  const blade = buildBladeSlashTextures(maxAnisotropy);
  const crush = buildCrushTextures(maxAnisotropy);
  const scorchMap = buildScorchTexture(maxAnisotropy);

  const textures = [
    dent.map,
    dent.bumpMap,
    blade.map,
    blade.bumpMap,
    crush.map,
    crush.bumpMap,
    scorchMap,
  ];

  const makeDecalMat = (
    map: THREE.Texture,
    bumpMap: THREE.Texture | undefined,
    bumpScale: number,
    roughness: number,
    metalness: number,
  ) =>
    new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale,
      roughness,
      metalness,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });

  const materials: Record<DamageKind, THREE.MeshStandardMaterial> = {
    kinetic: makeDecalMat(dent.map, dent.bumpMap, 0.032, 0.36, 0.82),
    blade: makeDecalMat(blade.map, blade.bumpMap, 0.04, 0.24, 0.9),
    crush: makeDecalMat(crush.map, crush.bumpMap, 0.045, 0.34, 0.84),
    scorch: makeDecalMat(scorchMap, undefined, 0, 0.94, 0.06),
  };

  return {
    materials,
    textures,
    dispose: () => {
      Object.values(materials).forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

function deformMeshDent(
  mesh: THREE.Mesh,
  worldPoint: THREE.Vector3,
  worldNormal: THREE.Vector3,
  force: number,
  kind: DamageKind,
) {
  if (kind === 'scorch' || force < 3.0) return;

  const geometry = mesh.geometry;
  const posAttr = geometry.attributes.position;
  if (!posAttr) return;

  // Transform world impact point and normal into the target mesh's local space
  _invWorld.copy(mesh.matrixWorld).invert();
  _localPt.copy(worldPoint).applyMatrix4(_invWorld);
  _normMat.getNormalMatrix(_invWorld);
  _localNrm.copy(worldNormal).applyMatrix3(_normMat).normalize();

  const radius = THREE.MathUtils.clamp(0.24 + force * 0.018, 0.24, 0.56);
  const depth = THREE.MathUtils.clamp(0.025 + force * 0.0055, 0.025, 0.11);
  const radiusSq = radius * radius;
  let modified = false;

  for (let i = 0; i < posAttr.count; i++) {
    _v.fromBufferAttribute(posAttr, i);
    const dx = _v.x - _localPt.x;
    const dy = _v.y - _localPt.y;
    const dz = _v.z - _localPt.z;
    const dSq = dx * dx + dy * dy + dz * dz;
    if (dSq < radiusSq) {
      const distNorm = Math.sqrt(dSq) / radius;
      // Smooth concave inward dent at center, subtle raised rim lip near outer edge
      const falloff =
        distNorm < 0.72
          ? Math.pow(1 - distNorm / 0.72, 1.6)
          : -0.18 * Math.sin(((distNorm - 0.72) / 0.28) * Math.PI);
      _v.addScaledVector(_localNrm, -depth * falloff);
      posAttr.setXYZ(i, _v.x, _v.y, _v.z);
      modified = true;
    }
  }

  if (modified) {
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }
}

export function applyImpactToBotMeshes(params: {
  bodyPivot: THREE.Group;
  damageableMeshes: THREE.Mesh[];
  decalPool: BotDecalEntry[];
  decalPack: DamageDecalPack;
  localPos: THREE.Vector3;
  localNormal: THREE.Vector3;
  force: number;
  kind: DamageKind;
}) {
  const { bodyPivot, damageableMeshes, decalPool, decalPack, localPos, localNormal, force, kind } = params;
  if (damageableMeshes.length === 0) return;

  bodyPivot.updateMatrixWorld(true);

  // Convert local bodyPivot contact coordinates/normal to world space
  _worldPos.copy(localPos).applyMatrix4(bodyPivot.matrixWorld);
  _normMat.getNormalMatrix(bodyPivot.matrixWorld);
  _worldNorm.copy(localNormal).applyMatrix3(_normMat).normalize();

  // Raycast inward from outside the bot along -_worldNorm to hit the exact outer surface
  _rayOrigin.copy(_worldPos).addScaledVector(_worldNorm, 1.45);
  _rayDir.copy(_worldNorm).negate();
  _raycaster.set(_rayOrigin, _rayDir);
  _raycaster.near = 0.05;
  _raycaster.far = 3.6;

  const visibleTargets = damageableMeshes.filter((m) => m.visible);
  const hits = _raycaster.intersectObjects(visibleTargets, false);

  let targetMesh: THREE.Mesh;
  if (hits.length > 0) {
    const first = hits[0];
    targetMesh = first.object as THREE.Mesh;
    _worldPos.copy(first.point);
    if (first.face) {
      _normMat.getNormalMatrix(targetMesh.matrixWorld);
      _worldNorm.copy(first.face.normal).applyMatrix3(_normMat).normalize();
    }
  } else {
    // Fallback to chassis core mesh bounding box surface
    targetMesh = visibleTargets[0] || damageableMeshes[0];
    targetMesh.geometry.computeBoundingBox();
    if (targetMesh.geometry.boundingBox) {
      _box.copy(targetMesh.geometry.boundingBox).applyMatrix4(targetMesh.matrixWorld);
      _box.clampPoint(_worldPos, _worldPos);
    }
  }

  // 1. Physically dent the underlying mesh geometry
  deformMeshDent(targetMesh, _worldPos, _worldNorm, force, kind);

  // 2. Project a force-scaled PBR decal onto the surface (and transform into targetMesh local space)
  _worldDummy.position.copy(_worldPos);
  _quat.setFromUnitVectors(_up, _worldNorm);
  _worldDummy.quaternion.copy(_quat);
  _worldDummy.rotateZ((Math.random() - 0.5) * Math.PI * 2);
  _euler.setFromQuaternion(_worldDummy.quaternion);

  const scaleFactor = THREE.MathUtils.clamp(0.32 + force * 0.028, 0.3, 0.88);
  const depthBox = kind === 'blade' ? 0.45 : 0.38;
  if (kind === 'blade') {
    _size.set(scaleFactor * 1.35, scaleFactor * 0.65, depthBox);
  } else {
    _size.set(scaleFactor, scaleFactor, depthBox);
  }

  const decalGeo = new DecalGeometry(targetMesh, _worldPos, _euler, _size);
  const decalPosAttr = decalGeo.attributes.position;
  if (!decalPosAttr || decalPosAttr.count === 0) {
    decalGeo.dispose();
    return;
  }

  // DecalGeometry produces world-space vertices; transform them into targetMesh local space
  targetMesh.updateMatrixWorld(true);
  _invWorld.copy(targetMesh.matrixWorld).invert();
  decalGeo.applyMatrix4(_invWorld);
  decalGeo.computeBoundingSphere();

  const decalMesh = new THREE.Mesh(decalGeo, decalPack.materials[kind]);
  decalMesh.renderOrder = 2;
  targetMesh.add(decalMesh);
  decalPool.push({ mesh: decalMesh, parent: targetMesh });

  // Evict oldest decal if over budget to keep memory & draw calls flat
  while (decalPool.length > MAX_DECALS_PER_BOT) {
    const oldest = decalPool.shift();
    if (oldest) {
      oldest.parent.remove(oldest.mesh);
      oldest.mesh.geometry.dispose();
    }
  }
}
