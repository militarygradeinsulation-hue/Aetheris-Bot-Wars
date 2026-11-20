import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ARENA_CATALOG } from '../shared/types';
import { buildCustomArena, CUSTOM_ITEM_INFO, type CustomArenaSpec, type CustomItemKind } from '../shared/arenaLayouts';
import { buildArenaEnvironment, type BuiltArenaScene } from '../game/arenaBuilder';
import { buildArenaEnvMap } from '../game/arenaEnvironment';
import { createProceduralTextures, type ProceduralTexturePack } from '../game/materials';

interface Props {
  spec: CustomArenaSpec;
  tool: CustomItemKind | 'select';
  selectedId: string | null;
  onPlace: (x: number, z: number) => void;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, z: number) => void;
}

const LIMIT = 16;
const snap = (v: number) => Math.max(-LIMIT, Math.min(LIMIT, Math.round(v * 2) / 2));

/**
 * Live 3D editing view of a custom arena: the real theme (walls, crowd, lights) with every
 * placed piece rendered as it will appear in the fight. Click the floor to place, drag a
 * piece to move it, drag empty space to orbit, scroll to zoom.
 */
export const ArenaBuilder3D: React.FC<Props> = ({ spec, tool, selectedId, onPlace, onSelect, onMove }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ spec, tool, selectedId, onPlace, onSelect, onMove });
  stateRef.current = { spec, tool, selectedId, onPlace, onSelect, onMove };
  const apiRef = useRef<{ sync: () => void; rebuildTheme: () => void } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.2, 260);
    camera.position.set(0, 19, 23);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.set(0, 0, 0);
    orbit.enableDamping = true;
    orbit.maxPolarAngle = Math.PI * 0.47;
    orbit.minDistance = 8;
    orbit.maxDistance = 60;

    scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1e293b, 0.5));
    const key = new THREE.DirectionalLight(0xfff3db, 2.2);
    key.position.set(14, 26, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -22;
    sc.right = 22;
    sc.top = 22;
    sc.bottom = -22;
    sc.far = 70;
    key.shadow.bias = -0.0004;
    scene.add(key);

    // Placement ghost and selection marker
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.35, depthWrite: false });
    const ghostGeo = new THREE.RingGeometry(0.8, 1, 40);
    ghostGeo.rotateX(-Math.PI / 2);
    const ghost = new THREE.Mesh(ghostGeo, ghostMat);
    ghost.position.y = 0.03;
    ghost.visible = false;
    scene.add(ghost);
    const selMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9, depthWrite: false });
    const selGeo = new THREE.RingGeometry(0.92, 1.05, 48);
    selGeo.rotateX(-Math.PI / 2);
    const selRing = new THREE.Mesh(selGeo, selMat);
    selRing.position.y = 0.04;
    selRing.visible = false;
    scene.add(selRing);
    // Start positions
    const startMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.5, depthWrite: false });
    const startGeo = new THREE.RingGeometry(1.1, 1.35, 40);
    startGeo.rotateX(-Math.PI / 2);
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((a) => {
      const m = new THREE.Mesh(startGeo, startMat);
      m.position.set(Math.sin(a) * 11, 0.035, Math.cos(a) * 11);
      scene.add(m);
    });

    let textures: ProceduralTexturePack | null = null;
    let built: BuiltArenaScene | null = null;
    let env: THREE.Texture | null = null;
    let theme = '';
    let liveIds = new Set<string>();

    const rebuildTheme = () => {
      const s = stateRef.current.spec;
      if (s.theme === theme && built) return;
      theme = s.theme;
      if (built) {
        scene.remove(built.group);
        built.dispose();
      }
      textures?.dispose();
      env?.dispose();
      const aSpec = ARENA_CATALOG[s.theme] ?? ARENA_CATALOG.foundry;
      textures = createProceduralTextures(8, s.theme);
      built = buildArenaEnvironment(s.theme, textures, true);
      scene.add(built.group);
      env = buildArenaEnvMap(renderer, aSpec.accentHex, aSpec.skyHex);
      scene.environment = env;
      (scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.65;
      scene.background = new THREE.Color(aSpec.skyHex);
      scene.fog = new THREE.FogExp2(aSpec.skyHex, 0.008);
      liveIds = new Set();
      sync();
    };

    const sync = () => {
      if (!built) return;
      const s = stateRef.current.spec;
      const { props, hazards } = buildCustomArena(s, { tier2Unlock: 0, tier3Unlock: 0 });
      const ids = new Set<string>();
      built.syncDynamicProps(props, 0);
      for (const p of props) {
        ids.add(p.id);
        const m = built.propMeshes.get(p.id);
        if (m && (p.kind === 'ramp' || p.kind === 'barrier')) m.rotation.y = p.yaw ?? 0;
      }
      const shown = hazards.map((h) => ({
        ...h,
        active: h.kind === 'saw' || h.kind === 'spinner_blade' || h.kind === 'laser_grid' || h.kind === 'oil_slick' || h.kind === 'acid_pool',
        warning: h.kind === 'crusher' || h.kind === 'emp_ring' || h.kind === 'lava_vent',
      }));
      built.syncHazards(shown, 0.016);
      for (const h of shown) {
        ids.add(h.id);
        const e = built.hazardMeshes.get(h.id);
        if (e) {
          e.root.visible = true;
          e.root.position.set(h.x, 0, h.z);
        }
      }
      // Hide pieces that were deleted
      for (const id of liveIds) {
        if (ids.has(id)) continue;
        const pm = built.propMeshes.get(id);
        if (pm) pm.visible = false;
        const hm = built.hazardMeshes.get(id);
        if (hm) hm.root.visible = false;
      }
      liveIds = ids;
      const sel = s.items.find((it) => it.id === stateRef.current.selectedId);
      selRing.visible = Boolean(sel);
      if (sel) {
        const r = sel.kind === 'barrier' ? 2.4 : CUSTOM_ITEM_INFO[sel.kind].radius + 0.25;
        selRing.scale.setScalar(r);
        selRing.position.set(sel.x, 0.04, sel.z);
      }
    };
    apiRef.current = { sync, rebuildTheme };
    rebuildTheme();

    // Pointer: place, select, drag
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const floorPoint = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(floorPlane, hit) ? hit : null;
    };
    const itemAt = (x: number, z: number) => {
      let best: { id: string; d: number } | null = null;
      for (const it of stateRef.current.spec.items) {
        const r = it.kind === 'barrier' ? 1.6 : CUSTOM_ITEM_INFO[it.kind].radius;
        const d = Math.hypot(it.x - x, it.z - z);
        if (d < r && (!best || d < best.d)) best = { id: it.id, d };
      }
      return best?.id ?? null;
    };
    let drag: { id: string; moved: boolean } | null = null;
    let downAt: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      const p = floorPoint(e);
      downAt = { x: e.clientX, y: e.clientY };
      if (!p) return;
      const id = itemAt(p.x, p.z);
      if (id) {
        drag = { id, moved: false };
        orbit.enabled = false;
        stateRef.current.onSelect(id);
      }
    };
    const onMoveEv = (e: PointerEvent) => {
      const p = floorPoint(e);
      const t = stateRef.current.tool;
      if (p && !drag && t !== 'select') {
        ghost.visible = Math.abs(p.x) <= LIMIT && Math.abs(p.z) <= LIMIT;
        ghost.position.set(snap(p.x), 0.03, snap(p.z));
        ghost.scale.setScalar(t === 'barrier' ? 2.2 : CUSTOM_ITEM_INFO[t].radius);
      } else {
        ghost.visible = false;
      }
      if (drag && p) {
        drag.moved = true;
        stateRef.current.onMove(drag.id, snap(p.x), snap(p.z));
      }
    };
    const onUp = (e: PointerEvent) => {
      const wasDrag = drag;
      drag = null;
      orbit.enabled = true;
      const clickLike = downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5;
      downAt = null;
      if (wasDrag || !clickLike) return;
      const p = floorPoint(e);
      if (!p) return;
      if (stateRef.current.tool === 'select') {
        stateRef.current.onSelect(null);
        return;
      }
      if (Math.abs(p.x) <= LIMIT && Math.abs(p.z) <= LIMIT) stateRef.current.onPlace(snap(p.x), snap(p.z));
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMoveEv);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointerleave', () => (ghost.visible = false));

    const resize = () => {
      const w = mount.clientWidth || 600;
      const h = mount.clientHeight || 400;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const clock = new THREE.Timer();
    const loop = (t?: number) => {
      clock.update(t);
      const time = clock.getElapsed();
      orbit.update();
      built?.syncCrowd(time, 0.35);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      orbit.dispose();
      if (built) built.dispose();
      textures?.dispose();
      env?.dispose();
      [ghostGeo, selGeo, startGeo].forEach((g) => g.dispose());
      [ghostMat, selMat, startMat].forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    apiRef.current?.rebuildTheme();
    apiRef.current?.sync();
  }, [spec, selectedId]);

  return <div ref={mountRef} className="h-full w-full cursor-crosshair touch-none" />;
};
