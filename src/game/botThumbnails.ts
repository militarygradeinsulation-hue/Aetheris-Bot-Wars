import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { useEffect, useState } from 'react';
import type { BotConfig } from '../shared/types';
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
const queue: Array<{ key: string; config: BotConfig }> = [];
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
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

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

function pump() {
  if (busy) return;
  const job = queue.shift();
  if (!job) return;
  busy = true;
  const run = () => {
    try {
      if (!init() || !renderer || !scene || !camera || !textures) throw new Error('no gl');
      const rig = buildBotRig(job.config, textures.armorWeave, textures.contactShadow, false, textures.metalBrushBump);
      // Fit any size of bot into frame
      // Frame only solid parts: halos, glows and shadow decals would shrink the bot in the shot
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
      rig.root.position.set(-center.x * scale, 0, -center.z * scale);
      rig.root.rotation.y = -0.35;
      scene.add(rig.root);
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

export function requestBotThumbnail(config: BotConfig, cb: (url: string) => void): () => void {
  const key = thumbKey(config);
  const hit = cache.get(key);
  if (hit !== undefined) {
    cb(hit);
    return () => {};
  }
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
    queue.push({ key, config });
  }
  set.add(cb);
  pump();
  return () => {
    set?.delete(cb);
  };
}

/** React hook: data URL of a rendered bot portrait, '' if rendering is unavailable, null while pending. */
export function useBotThumbnail(config: BotConfig | null | undefined): string | null {
  const key = config ? thumbKey(config) : '';
  const [url, setUrl] = useState<string | null>(() => (config ? cache.get(key) ?? null : null));
  useEffect(() => {
    if (!config) return;
    const hit = cache.get(key);
    if (hit !== undefined) {
      setUrl(hit);
      return;
    }
    setUrl(null);
    return requestBotThumbnail(config, setUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}
