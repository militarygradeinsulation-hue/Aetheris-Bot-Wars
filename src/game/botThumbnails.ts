import * as THREE from 'three';
import { buildArenaEnvMap } from './arenaEnvironment';
import { useEffect, useState } from 'react';
import { ARENA_CATALOG, type ArenaId, type BotConfig } from '../shared/types';
import { createInitialSnapshot } from '../shared/physicsEngine';
import { buildArenaEnvironment } from './arenaBuilder';
import { buildBotRig } from './botBuilder';
import { createProceduralTextures, type ProceduralTexturePack } from './materials';

/**
 * Renders real 3D portraits of bot configs with one shared offscreen renderer.
 * Results are cached as data URLs keyed by the config, so lists stay cheap.
 */
const W = 320;
const H = 240;
const cache = new Map<string, string>();
const listeners = new Map<string, Set<(url: string) => void>>();
export type ThumbFocus = 'full' | 'weapon' | 'chassis' | 'wheels';
const queue: Array<{ key: string; config: BotConfig; focus: ThumbFocus; arena?: ArenaId }> = [];
let studioEnv: THREE.Texture | null = null;
let floorDisc: THREE.Object3D | null = null;
let busy = false;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let textures: ProceduralTexturePack | null = null;
let failed = false;

export function thumbKey(config: BotConfig): string {
  const { aiStyle: _ai, fusionParents: _fp, ...visual } = config;
  return JSON.stringify(visual);
}

function init(): boolean {
  if (renderer || failed) return !failed;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    studioEnv = buildArenaEnvMap(renderer, '#f59e0b', '#1b2230');
    scene.environment = studioEnv;

    const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
    key.position.set(3.5, 5, 4);
    const rim = new THREE.DirectionalLight(0x8ec5ff, 1.6);
    rim.position.set(-4, 3, -4);
    scene.add(key, rim, new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.6));

    // Soft floor disc for grounding
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.3, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    scene.add(floor);
    floorDisc = floor;

    camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
    camera.position.set(3.4, 2.3, 4.0);
    camera.lookAt(0, 0.35, 0);

    textures = createProceduralTextures(4, 'foundry');
    return true;
  } catch {
    failed = true;
    return false;
  }
}

/** Wide overhead shot of a full arena (walls, crowd, props, traps) in its own lighting. */
function renderArenaShot(arenaId: ArenaId) {
  if (!renderer || !scene || !camera) return;
  const spec = ARENA_CATALOG[arenaId] ?? ARENA_CATALOG.foundry;
  const tex = createProceduralTextures(4, arenaId);
  const built = buildArenaEnvironment(arenaId, tex, false);
  const snap = createInitialSnapshot('duel_1v1', arenaId, [], 180);
  built.syncDynamicProps(snap.props, 0);
  built.syncHazards(snap.hazards, 0.016);
  built.syncCrowd(1.5, 0.6);
  const env = buildArenaEnvMap(renderer, spec.accentHex, spec.skyHex);
  const prevBg = scene.background;
  const prevFog = scene.fog;
  scene.background = new THREE.Color(spec.skyHex);
  scene.fog = new THREE.FogExp2(spec.skyHex, 0.01);
  scene.environment = env;
  if (floorDisc) floorDisc.visible = false;
  scene.add(built.group);
  const prevFov = camera.fov;
  camera.fov = 48;
  camera.updateProjectionMatrix();
  camera.position.set(14, 15, 21);
  camera.lookAt(0, 0, 0);
  renderer.toneMappingExposure = 1.0;
  renderer.render(scene, camera);
  scene.remove(built.group);
  built.dispose();
  tex.dispose();
  env.dispose();
  scene.background = prevBg;
  scene.fog = prevFog;
  scene.environment = studioEnv;
  if (floorDisc) floorDisc.visible = true;
  camera.fov = prevFov;
  camera.updateProjectionMatrix();
  renderer.toneMappingExposure = 1.15;
}

/** Forget a queued render nobody is waiting for any more (tab switched, list scrolled away). */
function dropIfUnwanted(key: string) {
  const set = listeners.get(key);
  if (set && set.size > 0) return;
  listeners.delete(key);
  const i = queue.findIndex((j) => j.key === key);
  if (i >= 0) queue.splice(i, 1);
}

function pump() {
  if (busy) return;
  // Newest requests first: what's on screen now beats what scrolled away
  let job = queue.pop();
  while (job && !listeners.has(job.key)) job = queue.pop();
  if (!job) return;
  busy = true;
  const run = () => {
    try {
      if (!init() || !renderer || !scene || !camera || !textures) throw new Error('no gl');
      if (job.arena) {
        renderArenaShot(job.arena);
        const url = renderer.domElement.toDataURL('image/jpeg', 0.86);
        cache.set(job.key, url);
        listeners.get(job.key)?.forEach((fn) => fn(url));
        listeners.delete(job.key);
        busy = false;
        window.setTimeout(pump, 16);
        return;
      }
      const rig = buildBotRig(job.config, textures.armorWeave, textures.contactShadow, false, textures.metalBrushBump);
      // Part shots: show only the part being picked
      if (job.focus !== 'full') {
        const keep = new Set<THREE.Object3D>();
        const keepTree = (o: THREE.Object3D | undefined) => o?.traverse((c) => keep.add(c));
        const drop = new Set<THREE.Object3D>();
        const dropTree = (o: THREE.Object3D | undefined) => o?.traverse((c) => drop.add(c));
        if (job.focus === 'weapon') {
          keepTree(rig.weaponEntries[0]?.mountGroup);
        } else if (job.focus === 'wheels' && rig.wheels.length > 0 && !rig.isHover) {
          rig.wheels.forEach((w) => keepTree(w));
        } else {
          rig.weaponEntries.forEach((w) => dropTree(w.mountGroup));
          dropTree(rig.accessoryPivot);
          dropTree(rig.shieldBubble);
        }
        rig.root.traverse((o) => {
          if (!(o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh) return;
          if (keep.size > 0) o.visible = keep.has(o);
          else if (drop.has(o)) o.visible = false;
        });
      }
      // Fit any size of bot into frame
      // Frame only solid parts: halos, glows and shadow decals would shrink the bot in the shot
      rig.root.rotation.y = job.focus === 'weapon' ? -0.75 : -0.35;
      rig.root.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const tmp = new THREE.Box3();
      rig.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible || !m.geometry) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        if (mats.some((mt) => mt.transparent || (mt as THREE.MeshBasicMaterial).blending === THREE.AdditiveBlending)) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        tmp.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);
        box.union(tmp);
      });
      if (box.isEmpty()) box.setFromObject(rig.root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 2.7 / Math.max(size.x, size.z, size.y * 1.5, 0.5);
      rig.root.scale.setScalar(scale);
      const isPart = job.focus === 'weapon' || job.focus === 'wheels';
      rig.root.position.set(-center.x * scale, isPart ? -center.y * scale + 0.35 : 0, -center.z * scale);
      scene.add(rig.root);
      if (job.focus === 'wheels') {
        camera.position.set(3.2, 1.1, 3.4);
        camera.lookAt(0, 0.25, 0);
      } else {
        camera.position.set(3.4, 2.3, 4.0);
        camera.lookAt(0, 0.35, 0);
      }
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(rig.root);
      rig.dispose();
      cache.set(job.key, url);
      listeners.get(job.key)?.forEach((fn) => fn(url));
      listeners.delete(job.key);
    } catch {
      cache.set(job.key, '');
      listeners.get(job.key)?.forEach((fn) => fn(''));
      listeners.delete(job.key);
    }
    busy = false;
    // Yield between renders so the UI stays responsive
    window.setTimeout(pump, 16);
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
    .requestIdleCallback;
  if (ric) ric(run, { timeout: 120 });
  else window.setTimeout(run, 0);
}

export function requestBotThumbnail(config: BotConfig, cb: (url: string) => void, focus: ThumbFocus = 'full'): () => void {
  const key = `${focus}|${thumbKey(config)}`;
  const hit = cache.get(key);
  if (hit !== undefined) {
    cb(hit);
    return () => {};
  }
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
    queue.push({ key, config, focus });
  }
  set.add(cb);
  pump();
  return () => {
    set?.delete(cb);
    dropIfUnwanted(key);
  };
}

/** React hook: data URL of a rendered bot portrait, '' if rendering is unavailable, null while pending. */
export function useBotThumbnail(config: BotConfig | null | undefined, focus: ThumbFocus = 'full'): string | null {
  const key = config ? `${focus}|${thumbKey(config)}` : '';
  const [url, setUrl] = useState<string | null>(() => (config ? cache.get(key) ?? null : null));
  useEffect(() => {
    if (!config) return;
    const hit = cache.get(key);
    if (hit !== undefined) {
      setUrl(hit);
      return;
    }
    setUrl(null);
    return requestBotThumbnail(config, setUrl, focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}

/** React hook: real 3D preview image of an arena theme ('' if unavailable, null while pending). */
export function useArenaThumbnail(arenaId: ArenaId | null | undefined): string | null {
  const key = arenaId ? `arena|${arenaId}` : '';
  const [url, setUrl] = useState<string | null>(() => (key ? cache.get(key) ?? null : null));
  useEffect(() => {
    if (!arenaId) return;
    const hit = cache.get(key);
    if (hit !== undefined) {
      setUrl(hit);
      return;
    }
    setUrl(null);
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
      queue.push({ key, config: {} as BotConfig, focus: 'full', arena: arenaId });
    }
    set.add(setUrl);
    pump();
    return () => {
      set?.delete(setUrl);
      dropIfUnwanted(key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}
