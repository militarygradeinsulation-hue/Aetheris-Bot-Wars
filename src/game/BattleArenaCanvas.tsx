import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  ARENA_CATALOG,
  computeBotStats,
  DEFAULT_SKILLS,
  getBotChassisStyles,
  getBotWeapons,
  type ArenaId,
  type ArenaSnapshot,
  type BatteryMode,
  type BotConfig,
  type CombatEvent,
  type PlayerInputState,
} from '../shared/types';
import { buildArenaEnvironment, type BuiltArenaScene } from './arenaBuilder';
import { buildBotRig, syncBotRigToState, type BuiltBotRig } from './botBuilder';
import { createDamageDecalPack } from './damageDecals';
import { createProceduralTextures, type ProceduralTexturePack } from './materials';
import { EffectsManager } from './particlesAndDebris';
import { CombatOverlay } from './combatOverlay';
import { soundEngine } from './soundEngine';

export interface BattleArenaCanvasProps {
  mode: 'workshop' | 'combat';
  arenaId: ArenaId;
  batteryMode: BatteryMode;
  playerBotConfig: BotConfig;
  playerId: string;
  snapshotRef: React.MutableRefObject<ArenaSnapshot | null>;
  inputRef: React.MutableRefObject<PlayerInputState>;
  onStepLocalPhysics?: (dt: number) => void;
  onCombatEvents?: (events: CombatEvent[]) => void;
  cameraPreset?: 'chase' | 'tactical' | 'cinematic';
}

const _camGoal = new THREE.Vector3();
const _lookGoal = new THREE.Vector3();
const _curLook = new THREE.Vector3(0, 0.5, 0);
const _impactPos = new THREE.Vector3();
const _impactNorm = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export const BattleArenaCanvas: React.FC<BattleArenaCanvasProps> = ({
  mode,
  arenaId,
  batteryMode,
  playerBotConfig,
  playerId,
  snapshotRef,
  inputRef,
  onStepLocalPhysics,
  onCombatEvents,
  cameraPreset = 'chase',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [contextLost, setContextLost] = useState(false);

  // Store changing props in refs so WebGLRenderer lifecycle is NEVER torn down on UI state changes
  const modeRef = useRef(mode);
  const arenaIdRef = useRef(arenaId);
  const batteryRef = useRef(batteryMode);
  const playerConfigRef = useRef(playerBotConfig);
  const playerIdRef = useRef(playerId);
  const stepLocalRef = useRef(onStepLocalPhysics);
  const onEventsRef = useRef(onCombatEvents);
  const camPresetRef = useRef(cameraPreset);

  modeRef.current = mode;
  arenaIdRef.current = arenaId;
  batteryRef.current = batteryMode;
  playerConfigRef.current = playerBotConfig;
  playerIdRef.current = playerId;
  stepLocalRef.current = onStepLocalPhysics;
  onEventsRef.current = onCombatEvents;
  camPresetRef.current = cameraPreset;

  // Imperative scene rebuild hooks stored in refs
  const rebuildWorkshopBotRef = useRef<(() => void) | null>(null);
  const rebuildArenaRef = useRef<(() => void) | null>(null);
  const updateBatteryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    rebuildWorkshopBotRef.current?.();
  }, [playerBotConfig]);

  useEffect(() => {
    rebuildArenaRef.current?.();
  }, [arenaId, mode]);

  useEffect(() => {
    updateBatteryRef.current?.();
  }, [batteryMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: batteryRef.current === 'eco' ? 'low-power' : 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const applyBatteryPixelRatio = () => {
      if (isSoftwareGl) {
        renderer.setPixelRatio(1);
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      if (batteryRef.current === 'eco') {
        renderer.setPixelRatio(1);
      } else if (batteryRef.current === 'balanced') {
        renderer.setPixelRatio(Math.min(dpr, 1.35));
      } else {
        renderer.setPixelRatio(Math.min(dpr, 2));
      }
    };
    applyBatteryPixelRatio();
    updateBatteryRef.current = applyBatteryPixelRatio;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.2, 160);
    camera.position.set(0, 10, 15);

    // Studio Environment Reflection (mandatory for PBR metals)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 3-Point Warm/Cool Studio + Arena Lighting Rig (<= 2 shadow casters)
    const hemiLight = new THREE.HemisphereLight(0xa5d8ff, 0x1e293b, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff3db, 2.35);
    keyLight.position.set(16, 26, 14);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = isSoftwareGl ? 512 : 2048;
    keyLight.shadow.mapSize.height = isSoftwareGl ? 512 : 2048;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 75;
    const d = 22;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.radius = 2.5;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.15);
    rimLight.position.set(-16, 12, -18);
    scene.add(rimLight);

    // Overhead Arena Studio Softbox Light Bars for crisp reflections on shiny metals
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softboxA = new THREE.RectAreaLight(0xffffff, 3.8, 18, 2.6);
      softboxA.position.set(0, 14, -7);
      softboxA.lookAt(0, 0, 0);
      const softboxB = new THREE.RectAreaLight(0xffedd5, 3.4, 18, 2.6);
      softboxB.position.set(0, 14, 7);
      softboxB.lookAt(0, 0, 0);
      scene.add(softboxA, softboxB);
    }

    // Dynamic impact flash light (no shadow cast)
    const impactFlashLight = new THREE.PointLight(0xff9e44, 0, 15, 1.8);
    impactFlashLight.position.set(0, 2, 0);
    scene.add(impactFlashLight);

    // OrbitControls for Workshop showcase
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = !isSoftwareGl;
    orbit.dampingFactor = 0.06;
    orbit.minDistance = 2.8;
    orbit.maxDistance = 8.5;
    orbit.maxPolarAngle = Math.PI * 0.46;
    orbit.minPolarAngle = 0.25;
    orbit.target.set(0, 0.45, 0);
    orbit.enabled = modeRef.current === 'workshop';

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    let textures: ProceduralTexturePack = createProceduralTextures(maxAnisotropy, arenaIdRef.current);
    const damageDecalPack = createDamageDecalPack(maxAnisotropy);
    let arenaBuilt: BuiltArenaScene | null = null;
    const effects = new EffectsManager(scene, isSoftwareGl);
    const overlay = new CombatOverlay(scene);
    const baseHemi = hemiLight.intensity;
    const baseKey = keyLight.intensity;
    let blackoutLevel = 0;
    // Workshop framing: shift the render up so the bot sits in the open space above the dock
    let viewShift = 0;
    let viewShiftTarget = 0;
    let viewShiftProbe = 0;
    const applyViewShift = () => {
      const w = renderer.domElement.clientWidth || window.innerWidth;
      const h = renderer.domElement.clientHeight || window.innerHeight;
      if (Math.abs(viewShift) < 0.5) camera.clearViewOffset();
      else camera.setViewOffset(w, h, 0, viewShift, w, h);
    };

    // Workshop turntable pedestal
    const turntableGroup = new THREE.Group();
    const pedGeo = new THREE.CylinderGeometry(1.9, 2.15, 0.22, 32);
    const pedRingGeo = new THREE.TorusGeometry(1.92, 0.04, 8, 48);
    pedRingGeo.rotateX(Math.PI / 2);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.45, metalness: 0.78 });
    const pedRingMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const pedMesh = new THREE.Mesh(pedGeo, pedMat);
    pedMesh.position.y = -0.11;
    pedMesh.receiveShadow = true;
    const pedRing = new THREE.Mesh(pedRingGeo, pedRingMat);
    pedRing.position.y = 0.01;
    turntableGroup.add(pedMesh, pedRing);
    scene.add(turntableGroup);

    let workshopBotRig: BuiltBotRig | null = null;
    const combatBotRigs = new Map<string, { rig: BuiltBotRig; configKey: string }>();

    const rebuildArena = () => {
      const aSpec = ARENA_CATALOG[arenaIdRef.current];
      scene.background = new THREE.Color(aSpec.skyHex);
      scene.fog = new THREE.FogExp2(aSpec.skyHex, 0.014);

      if (arenaBuilt) {
        scene.remove(arenaBuilt.group);
        arenaBuilt.dispose();
        arenaBuilt = null;
      }
      textures.dispose();
      textures = createProceduralTextures(maxAnisotropy, arenaIdRef.current);
      arenaBuilt = buildArenaEnvironment(arenaIdRef.current, textures, !isSoftwareGl);
      scene.add(arenaBuilt.group);

      const isWorkshop = modeRef.current === 'workshop';
      turntableGroup.visible = isWorkshop;
      orbit.enabled = isWorkshop;
      if (isWorkshop) {
        soundEngine.stopLoops();
        camera.position.set(3.2, 2.1, 3.6);
        orbit.target.set(0, 0.42, 0);
        orbit.update();
      } else {
        camera.position.set(0, 12, 18);
      }

      // Clear stale combat rigs when changing mode
      combatBotRigs.forEach((entry) => {
        scene.remove(entry.rig.root);
        entry.rig.dispose();
      });
      combatBotRigs.clear();
      overlay.clearDynamic();
    };

    const rebuildWorkshopBot = () => {
      if (workshopBotRig) {
        scene.remove(workshopBotRig.root);
        workshopBotRig.dispose();
        workshopBotRig = null;
      }
      workshopBotRig = buildBotRig(
        playerConfigRef.current,
        textures.armorWeave,
        textures.contactShadow,
        !isSoftwareGl,
        textures.metalBrushBump,
      );
      const previewScale = computeBotStats(playerConfigRef.current, DEFAULT_SKILLS).bodyScale;
      workshopBotRig.root.scale.setScalar(previewScale);
      workshopBotRig.root.visible = modeRef.current === 'workshop';
      scene.add(workshopBotRig.root);
    };

    rebuildArenaRef.current = rebuildArena;
    rebuildWorkshopBotRef.current = rebuildWorkshopBot;

    rebuildArena();
    rebuildWorkshopBot();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      viewShiftProbe = 0;
      applyViewShift();
    };
    window.addEventListener('resize', handleResize);

    // Loop & State Tracking
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let lastProcessedEventId = 0;
    let screenShake = 0;
    let crowdExcitement = 0.2;
    let workshopWeaponAngle = 0;
    let lastEcoRender = 0;

    function applyEventDecal(ev: CombatEvent) {
      if (
        !ev.targetId ||
        ev.hitLocalX === undefined ||
        ev.hitLocalY === undefined ||
        ev.hitLocalZ === undefined
      ) {
        return;
      }
      const targetEntry = combatBotRigs.get(ev.targetId);
      if (!targetEntry) return;
      _impactPos.set(ev.hitLocalX, ev.hitLocalY, ev.hitLocalZ);
      _impactNorm.set(ev.normalX ?? 0, ev.normalY ?? 0.2, ev.normalZ ?? 1);
      targetEntry.rig.applyDamageDecal(
        damageDecalPack,
        _impactPos,
        _impactNorm,
        ev.force ?? Math.max(2.5, ev.intensity * 6),
        ev.damageKind ?? (ev.type === 'flame' ? 'scorch' : 'kinetic'),
      );
    }

    function processEvents(events: CombatEvent[]) {
      for (const ev of events) {
        if (ev.id <= lastProcessedEventId) continue;
        lastProcessedEventId = ev.id;

        if (ev.type === 'hit' || ev.type === 'crit') {
          const isCrit = ev.type === 'crit';
          effects.spawnSparks(ev.x, ev.y, ev.z, isCrit ? 26 : 14, isCrit ? 0xf97316 : 0xfbbf24, isCrit ? 13 : 9);
          effects.spawnSmoke(ev.x, ev.y, ev.z, isCrit ? 4 : 2, isCrit ? 1.0 : 0.7, 0.26);
          if (isCrit) {
            effects.spawnFlames(ev.x, ev.y, ev.z, 4, 0, 0, 3.5, 0.85);
            impactFlashLight.position.set(ev.x, ev.y + 0.8, ev.z);
            impactFlashLight.color.setHex(0xff9e44);
            impactFlashLight.intensity = 10;
            crowdExcitement = Math.min(1.0, crowdExcitement + 0.45);
            if (ev.intensity > 1.15) soundEngine.playCrowdCheer(0.8);
          }
          applyEventDecal(ev);
          screenShake = Math.min(0.65, screenShake + ev.intensity * 0.14);
          soundEngine.playImpact(ev.intensity, isCrit, ev.weapon);
        } else if (ev.type === 'flame') {
          effects.spawnFlames(ev.x, ev.y, ev.z, 6, 0, 0, 3.8, 0.95);
          effects.spawnSparks(ev.x, ev.y, ev.z, 8, 0xf97316, 6);
          effects.spawnSmoke(ev.x, ev.y + 0.3, ev.z, 3, 0.85, 0.18);
          impactFlashLight.position.set(ev.x, ev.y + 0.6, ev.z);
          impactFlashLight.color.setHex(0xf97316);
          impactFlashLight.intensity = Math.max(impactFlashLight.intensity, 6);
          applyEventDecal(ev);
          soundEngine.playFlameBurst();
        } else if (ev.type === 'cryo_blast') {
          effects.spawnSparks(ev.x, ev.y, ev.z, 14, 0x38bdf8, 8);
          effects.spawnSmoke(ev.x, ev.y + 0.25, ev.z, 5, 0.95, 0.72);
          effects.spawnShockwave(ev.x, ev.y, ev.z, 2.6, 0x38bdf8);
          impactFlashLight.position.set(ev.x, ev.y + 0.6, ev.z);
          impactFlashLight.color.setHex(0x38bdf8);
          impactFlashLight.intensity = Math.max(impactFlashLight.intensity, 6);
          soundEngine.playFlameBurst();
        } else if (ev.type === 'tesla_arc') {
          const tx = ev.targetX ?? ev.x;
          const tz = ev.targetZ ?? ev.z;
          effects.spawnSparks(ev.x, ev.y, ev.z, 18, 0xc084fc, 11);
          effects.spawnSparks(tx, ev.y, tz, 22, 0x38bdf8, 12);
          overlay.addArc(ev.x, ev.y + 0.4, ev.z, tx, (ev.targetY ?? ev.y) + 0.3, tz, 0xc084fc, 0.2, 0.45);
          overlay.addArc(ev.x, ev.y + 0.4, ev.z, tx, (ev.targetY ?? ev.y) + 0.3, tz, 0x7dd3fc, 0.14, 0.3);
          soundEngine.playZap(1);
          effects.spawnShockwave(tx, ev.y, tz, 3.4, 0xa855f7);
          impactFlashLight.position.set(tx, ev.y + 0.8, tz);
          impactFlashLight.color.setHex(0xa855f7);
          impactFlashLight.intensity = 12;
          applyEventDecal(ev);
          soundEngine.playImpact(1.2, true, 'tesla');
        } else if (ev.type === 'rail_shot') {
          const tx = ev.targetX ?? ev.x;
          const tz = ev.targetZ ?? ev.z;
          for (let s = 0; s <= 6; s++) {
            const frac = s / 6;
            const lx = ev.x + (tx - ev.x) * frac;
            const lz = ev.z + (tz - ev.z) * frac;
            effects.spawnSparks(lx, ev.y, lz, 6, 0x38bdf8, 7);
          }
          overlay.addBeam(ev.x, ev.y + 0.35, ev.z, tx, (ev.targetY ?? ev.y) + 0.3, tz, 0x7dd3fc, 0.4, 0.085);
          effects.spawnShockwave(tx, ev.y, tz, 4.8, 0x38bdf8);
          effects.spawnSparks(tx, ev.y, tz, 28, 0xfbbf24, 15);
          impactFlashLight.position.set(tx, ev.y + 0.8, tz);
          impactFlashLight.color.setHex(0x38bdf8);
          impactFlashLight.intensity = 15;
          screenShake = Math.min(0.85, screenShake + 0.35);
          soundEngine.playImpact(1.5, true, 'railgun');
        } else if (ev.type === 'mortar_blast' || ev.type === 'era_blast') {
          const isEra = ev.type === 'era_blast';
          effects.spawnShockwave(ev.x, ev.y, ev.z, isEra ? 4.2 : 5.6, isEra ? 0xf59e0b : 0xf97316);
          effects.spawnFlames(ev.x, ev.y, ev.z, isEra ? 10 : 14, 0, 0, 5.2, 1.2);
          effects.spawnSparks(ev.x, ev.y, ev.z, 26, 0xfbbf24, 14);
          effects.spawnSmoke(ev.x, ev.y + 0.3, ev.z, 8, 1.2, 0.2);
          impactFlashLight.position.set(ev.x, ev.y + 1.0, ev.z);
          impactFlashLight.color.setHex(0xf97316);
          impactFlashLight.intensity = 14;
          screenShake = Math.min(0.85, screenShake + 0.38);
          soundEngine.playExplosion();
        } else if (ev.type === 'shield_hit') {
          effects.spawnShockwave(ev.x, ev.y, ev.z, 2.5, 0x38bdf8);
          effects.spawnSparks(ev.x, ev.y, ev.z, 10, 0x38bdf8, 8);
        } else if (ev.type === 'flip') {
          effects.spawnShockwave(ev.x, ev.y, ev.z, 4.2, 0x38bdf8);
          effects.spawnSparks(ev.x, ev.y, ev.z, 12, 0x38bdf8, 9);
          effects.spawnSmoke(ev.x, ev.y, ev.z, 4, 0.95, 0.35);
          crowdExcitement = Math.min(1.0, crowdExcitement + 0.55);
          soundEngine.playFlip();
          soundEngine.playCrowdCheer(0.95);
        } else if (ev.type === 'explosion') {
          const k = Math.max(0.35, Math.min(1, (ev.intensity || 1) / 1.5));
          effects.spawnShockwave(ev.x, ev.y, ev.z, 7.2 * k, 0xef4444);
          effects.spawnFlames(ev.x, ev.y, ev.z, Math.round(18 * k), 0, 0, 6.5 * k, 1.45 * k);
          effects.spawnSmoke(ev.x, ev.y + 0.4, ev.z, Math.round(14 * k), 1.5 * k, 0.14);
          effects.spawnSparks(ev.x, ev.y, ev.z, Math.round(38 * k), 0xf97316, 16 * k);
          if (k > 0.6) effects.spawnDebris(ev.x, ev.y, ev.z, 8, '#dc2626', 1.1);
          impactFlashLight.position.set(ev.x, ev.y + 1.2, ev.z);
          impactFlashLight.color.setHex(0xff6b2c);
          impactFlashLight.intensity = Math.max(impactFlashLight.intensity, 18 * k);
          crowdExcitement = Math.min(1, crowdExcitement + k);
          screenShake = Math.min(0.95, screenShake + 0.55 * k);
          soundEngine.playExplosion();
          if (k > 0.6) soundEngine.playCrowdCheer(1.2);
        } else if (ev.type === 'crate_break') {
          effects.spawnDebris(ev.x, ev.y, ev.z, 6, '#926239', 1.0);
          effects.spawnSparks(ev.x, ev.y, ev.z, 10, 0xfbbf24, 7);
          effects.spawnSmoke(ev.x, ev.y, ev.z, 5, 1.0, 0.32);
          soundEngine.playImpact(1.1, false);
        } else if (ev.type === 'pillar_break') {
          effects.spawnDebris(ev.x, ev.y, ev.z, 10, '#64748b', 1.35);
          effects.spawnShockwave(ev.x, ev.y, ev.z, 4.2, 0x94a3b8);
          effects.spawnSmoke(ev.x, ev.y + 0.5, ev.z, 10, 1.4, 0.35);
          screenShake = Math.min(0.75, screenShake + 0.3);
          soundEngine.playExplosion();
        } else if (ev.type === 'armor_break') {
          effects.spawnDebris(ev.x, ev.y, ev.z, 5, ev.color || '#f59e0b', 1.15);
          effects.spawnSparks(ev.x, ev.y, ev.z, 22, 0xfbbf24, 12);
          effects.spawnSmoke(ev.x, ev.y, ev.z, 5, 1.0, 0.22);
          applyEventDecal(ev);
          crowdExcitement = Math.min(1.0, crowdExcitement + 0.5);
          soundEngine.playImpact(1.4, true, ev.weapon);
        } else if (ev.type === 'pickup') {
          effects.spawnShockwave(ev.x, ev.y, ev.z, 2.8, 0x10b981);
          soundEngine.playPickup();
        } else if (ev.type === 'hazard_warn') {
          effects.spawnShockwave(ev.x, 0.1, ev.z, 3.0, 0xf59e0b);
          soundEngine.playHazardWarning();
        } else if (ev.type === 'crusher_slam') {
          effects.spawnShockwave(ev.x, 0.12, ev.z, 6.2, 0xf97316);
          effects.spawnSparks(ev.x, ev.y + 0.25, ev.z, 26, 0xfbbf24, 13);
          effects.spawnSmoke(ev.x, 0.35, ev.z, 10, 1.35, 0.28);
          impactFlashLight.position.set(ev.x, 1.1, ev.z);
          impactFlashLight.color.setHex(0xf97316);
          impactFlashLight.intensity = Math.max(impactFlashLight.intensity, 12);
          crowdExcitement = Math.min(1.0, crowdExcitement + 0.38);
          screenShake = Math.min(0.85, screenShake + 0.36);
          soundEngine.playCrusherSlam();
        } else if (ev.type === 'mortar_launch') {
          effects.spawnFlames(ev.x, ev.y, ev.z, 6, 0, 0, 3, 0.7);
          effects.spawnSmoke(ev.x, ev.y, ev.z, 6, 1.0, 0.3);
          effects.spawnSparks(ev.x, ev.y, ev.z, 10, 0xfbbf24, 8);
          impactFlashLight.position.set(ev.x, ev.y + 0.5, ev.z);
          impactFlashLight.color.setHex(0xffa040);
          impactFlashLight.intensity = Math.max(impactFlashLight.intensity, 9);
          screenShake = Math.min(0.5, screenShake + 0.12);
          soundEngine.playMortarThump();
        } else if (ev.type === 'part_detach') {
          effects.spawnSparks(ev.x, ev.y, ev.z, 34, 0xfde68a, 14);
          effects.spawnSmoke(ev.x, ev.y, ev.z, 6, 1.0, 0.2);
          effects.spawnDebris(ev.x, ev.y, ev.z, 5, '#475569', 0.8);
          if (ev.label === 'battery') effects.spawnFlames(ev.x, ev.y, ev.z, 12, 0, 0, 4, 1);
          impactFlashLight.position.set(ev.x, ev.y + 0.6, ev.z);
          impactFlashLight.color.setHex(0xfff1c1);
          impactFlashLight.intensity = Math.max(impactFlashLight.intensity, 12);
          crowdExcitement = 1.0;
          screenShake = Math.min(0.8, screenShake + 0.3);
          soundEngine.playPartRip();
          soundEngine.playCrowdCheer(1.0);
        } else if (ev.type === 'frozen_solid') {
          effects.spawnShockwave(ev.x, 0.2, ev.z, 3.6, 0x7dd3fc);
          effects.spawnSparks(ev.x, ev.y, ev.z, 30, 0xe0f2fe, 9);
          effects.spawnSmoke(ev.x, ev.y, ev.z, 10, 1.2, 0.9);
          soundEngine.playFreeze();
        } else if (ev.type === 'melt') {
          effects.spawnSmoke(ev.x, ev.y, ev.z, 8, 1.1, 0.12);
          effects.spawnSparks(ev.x, ev.y, ev.z, 14, 0xff6a1a, 5);
          soundEngine.playSizzle();
        } else if (ev.type === 'self_right') {
          effects.spawnShockwave(ev.x, 0.15, ev.z, 3.2, 0x22c55e);
          effects.spawnSmoke(ev.x, 0.2, ev.z, 5, 0.9, 0.35);
          soundEngine.playFlip();
        } else if (ev.type === 'debris_hit') {
          effects.spawnSparks(ev.x, ev.y, ev.z, 8, 0xfbbf24, 6);
          soundEngine.playImpact(0.5 + ev.intensity * 0.4, false);
        } else if (ev.type === 'lance') {
          const tx = ev.targetX ?? ev.x;
          const tz = ev.targetZ ?? ev.z;
          overlay.addBeam(ev.x, ev.y + 0.4, ev.z, tx, (ev.targetY ?? ev.y) + 0.35, tz, 0xfbbf24, 0.16);
          effects.spawnSparks(tx, ev.y + 0.3, tz, 20, 0xfde68a, 12);
          screenShake = Math.min(0.75, screenShake + 0.22);
          soundEngine.playLanceThrust();
        } else if (ev.type === 'magnet_pull') {
          const tx = ev.targetX ?? ev.x;
          const tz = ev.targetZ ?? ev.z;
          overlay.addArc(ev.x, ev.y + 0.45, ev.z, tx, (ev.targetY ?? ev.y) + 0.35, tz, 0xf472b6, 0.3, 0.2);
          effects.spawnShockwave(tx, ev.y, tz, 2.2, 0xf472b6);
          soundEngine.playMagnetHum();
        } else if (ev.type === 'missile_launch') {
          effects.spawnSmoke(ev.x, ev.y, ev.z, 5, 0.9, 0.4);
          effects.spawnFlames(ev.x, ev.y, ev.z, 3, 0, 0, 2.5, 0.6);
          soundEngine.playMissileLaunch();
        } else if (ev.type === 'lightning') {
          overlay.addLightning(ev.x, ev.z);
          effects.spawnShockwave(ev.x, 0.1, ev.z, 4.6, 0x93c5fd);
          effects.spawnSparks(ev.x, 0.3, ev.z, 30, 0xe0f2fe, 14);
          impactFlashLight.position.set(ev.x, 3, ev.z);
          impactFlashLight.color.setHex(0xdbeafe);
          impactFlashLight.intensity = 24;
          screenShake = Math.min(0.9, screenShake + 0.4);
          soundEngine.playThunder();
        } else if (ev.type === 'pit_fall') {
          effects.spawnSmoke(ev.x, 0.2, ev.z, 10, 1.3, 0.3);
          effects.spawnSparks(ev.x, 0.2, ev.z, 18, 0xf97316, 9);
          crowdExcitement = 1.0;
          soundEngine.playPitFall();
          soundEngine.playCrowdCheer(1.1);
        } else if (ev.type === 'arena_event') {
          effects.spawnShockwave(ev.x, 0.15, ev.z, 6, 0xa855f7);
          soundEngine.playAnnouncerSting('event');
        } else if (ev.type === 'wave_start') {
          effects.spawnShockwave(0, 0.15, 0, 10, ev.intensity > 1.2 ? 0xef4444 : 0xf59e0b);
          crowdExcitement = 1.0;
          soundEngine.playAnnouncerSting('wave');
        } else if (ev.type === 'hill_move') {
          effects.spawnShockwave(ev.x, 0.12, ev.z, 5, 0xe2e8f0);
          soundEngine.playAnnouncerSting('hill');
        } else if (ev.type === 'ko') {
          effects.spawnShockwave(ev.x, ev.y, ev.z, 7.8, 0xef4444);
          effects.spawnFlames(ev.x, ev.y, ev.z, 20, 0, 0, 6.0, 1.5);
          effects.spawnSmoke(ev.x, ev.y + 0.4, ev.z, 16, 1.6, 0.14);
          effects.spawnSparks(ev.x, ev.y, ev.z, 42, 0xfef08a, 15);
          effects.spawnDebris(ev.x, ev.y, ev.z, 9, '#475569', 1.25);
          applyEventDecal(ev);
          impactFlashLight.position.set(ev.x, ev.y + 1.2, ev.z);
          impactFlashLight.color.setHex(0xff5522);
          impactFlashLight.intensity = 20;
          crowdExcitement = 1.0;
          screenShake = Math.min(1.0, screenShake + 0.65);
          soundEngine.playKo();
        }
      }
      if (events.length > 0) {
        onEventsRef.current?.(events);
      }
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.elapsedTime;

      // Eco battery mode caps non-software-GL at ~30fps to save mobile battery
      if (!isSoftwareGl && batteryRef.current === 'eco' && now - lastEcoRender < 31) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      lastEcoRender = now;

      // Pause GPU rendering when tab is backgrounded
      if (document.visibilityState === 'hidden') {
        frameId = window.setTimeout(tick, 250);
        return;
      }

      crowdExcitement = Math.max(0.15, crowdExcitement - dt * 0.25);
      impactFlashLight.intensity *= Math.exp(-12 * dt);
      arenaBuilt?.syncCrowd(elapsed, modeRef.current === 'workshop' ? 0.12 : crowdExcitement);

      if (modeRef.current === 'workshop') {
        soundEngine.stopLoops();
        turntableGroup.visible = true;
        if (--viewShiftProbe <= 0) {
          viewShiftProbe = 20;
          const dock = document.getElementById('workshop-dock');
          const h = renderer.domElement.clientHeight || window.innerHeight;
          if (dock) {
            const dockTop = dock.getBoundingClientRect().top;
            const visibleCenter = (64 + dockTop) / 2;
            viewShiftTarget = Math.max(0, Math.min(h * 0.3, h / 2 - visibleCenter));
          } else {
            viewShiftTarget = 0;
          }
        }
        if (Math.abs(viewShiftTarget - viewShift) > 0.5) {
          viewShift += (viewShiftTarget - viewShift) * Math.min(1, dt * 6);
          applyViewShift();
        }
        if (blackoutLevel > 0) {
          blackoutLevel = 0;
          hemiLight.intensity = baseHemi;
          keyLight.intensity = baseKey;
        }
        if (workshopBotRig) {
          workshopBotRig.root.visible = true;
          workshopBotRig.root.rotation.y += dt * 0.42;
          workshopWeaponAngle += dt * 7.5;
          for (const entry of workshopBotRig.weaponEntries) {
            const wType = entry.weaponId;
            if (wType === 'vspinner' || wType === 'drum') entry.pivot.rotation.x = workshopWeaponAngle;
            else if (wType === 'hbar') entry.pivot.rotation.y = workshopWeaponAngle;
            else if (wType === 'sawblade') {
              entry.secondarySpinners.forEach((s, idx) => {
                s.rotation.y = idx === 0 ? workshopWeaponAngle : -workshopWeaponAngle;
              });
            } else if (wType === 'crush_jaw') {
              const jawClamp = Math.max(0, Math.sin(elapsed * 2.8)) * 0.45;
              entry.secondarySpinners.forEach((jaw, idx) => {
                jaw.rotation.y = (idx === 0 ? -1 : 1) * jawClamp;
              });
            } else if (wType === 'tesla') {
              entry.secondarySpinners.forEach((c) => {
                c.rotation.y = workshopWeaponAngle * 0.6;
              });
            } else if (wType === 'flame' || wType === 'cryo_jet') {
              const showFlame = Math.sin(elapsed * 2.5) > -0.25;
              for (const jet of entry.flameJets) {
                jet.visible = showFlame;
                if (showFlame) {
                  const f = 0.85 + Math.random() * 0.3;
                  jet.scale.set(f, f, 0.9 + Math.random() * 0.25);
                }
              }
            } else if (wType === 'flipper') {
              entry.pivot.rotation.x = -Math.max(0, Math.sin(elapsed * 2.2)) * 0.6;
            } else if (wType === 'lance') {
              if (entry.movingPart) entry.movingPart.position.z = Math.max(0, Math.sin(elapsed * 2.4)) * 0.9;
            } else if (wType === 'missiles') {
              if (entry.movingPart) entry.movingPart.position.z = -Math.max(0, Math.sin(elapsed * 3)) * 0.1;
            } else if (wType === 'magnet') {
              if (entry.glowMat) entry.glowMat.emissiveIntensity = 0.8 + Math.sin(elapsed * 3) * 0.6;
              entry.pivot.rotation.x = 0;
            } else if (wType === 'railgun' || wType === 'mortar') {
              entry.pivot.rotation.x = Math.sin(elapsed * 1.8) * 0.08;
            } else {
              entry.pivot.rotation.x = Math.sin(elapsed * 2.6) * 0.45 - 0.35;
            }
          }
          if (workshopBotRig.accessoryPivot) {
            workshopBotRig.accessoryPivot.rotation.y += dt * 1.4;
          }
          if (workshopBotRig.shieldBubble) {
            workshopBotRig.shieldBubble.rotation.y += dt * 0.7;
          }
          for (const fan of workshopBotRig.fans) fan.rotation.y += dt * 24;
          if (workshopBotRig.isHover) {
            workshopBotRig.bodyPivot.position.y = 0.1 + Math.sin(elapsed * 4.2) * 0.025;
          }
        }
        orbit.update();
      } else {
        turntableGroup.visible = false;
        if (workshopBotRig) workshopBotRig.root.visible = false;
        if (viewShift !== 0) {
          viewShift = 0;
          viewShiftTarget = 0;
          camera.clearViewOffset();
        }

        // Step local offline/solo physics if active
        if (stepLocalRef.current) {
          stepLocalRef.current(dt);
        }

        const snap = snapshotRef.current;
        if (snap) {
          // Sync arena props & hazards
          arenaBuilt?.syncDynamicProps(snap.props, elapsed);
          arenaBuilt?.syncHazards(snap.hazards, dt);

          // Sync bots
          const seenIds = new Set<string>();
          let playerBot = snap.bots[0];
          for (const b of snap.bots) {
            seenIds.add(b.id);
            if (b.id === playerIdRef.current) playerBot = b;

            const botWeapons = getBotWeapons(b.config);
            const botStyles = getBotChassisStyles(b.config);
            const cfgKey = `${b.config.name}_${botStyles.join('+')}_${b.config.armor}_${botWeapons.join('+')}_${b.config.wheelLayout}_${b.config.drive}_${b.config.primaryColor}_${b.config.accentColor}_${b.config.finishStyle || 'standard'}_${b.config.accessory || 'none'}_${b.config.underglowColor || 'none'}_${b.config.pattern || 'solid'}_${b.config.raceNumber ?? ''}`;
            let entry = combatBotRigs.get(b.id);
            if (!entry || entry.configKey !== cfgKey) {
              if (entry) {
                scene.remove(entry.rig.root);
                entry.rig.dispose();
              }
              const newRig = buildBotRig(
                b.config,
                textures.armorWeave,
                textures.contactShadow,
                !isSoftwareGl,
                textures.metalBrushBump,
              );
              scene.add(newRig.root);
              entry = { rig: newRig, configKey: cfgKey };
              combatBotRigs.set(b.id, entry);
            }

            syncBotRigToState(entry.rig, b, dt, b.id === playerIdRef.current);

            // Live Flame Torch particle jet stream (only when flame weapon slot itself is active)
            const flameSlotIdx = botWeapons.indexOf('flame');
            const flameSlotActive =
              flameSlotIdx >= 0 && (b.weaponActives?.[flameSlotIdx] ?? b.weaponActive);
            if (!b.isDead && flameSlotActive && Math.random() < 0.75) {
              const fx = Math.sin(b.yaw);
              const fz = Math.cos(b.yaw);
              effects.spawnFlames(b.x + fx * 1.4, b.y + 0.48, b.z + fz * 1.4, 2, fx, fz, 7.5, 0.85);
            }

            // Live cryo mist stream
            const cryoSlotIdx = botWeapons.indexOf('cryo_jet');
            const cryoActive = cryoSlotIdx >= 0 && (b.weaponActives?.[cryoSlotIdx] ?? false);
            if (!b.isDead && cryoActive && Math.random() < 0.8) {
              const fx = Math.sin(b.yaw);
              const fz = Math.cos(b.yaw);
              const k = 1.3 + Math.random() * 2.6;
              effects.spawnSmoke(b.x + fx * k, b.y + 0.45, b.z + fz * k, 1, 0.55 + k * 0.12, 0.86);
              effects.spawnSparks(b.x + fx * k, b.y + 0.45, b.z + fz * k, 1, 0xbae6fd, 3);
            }

            // Heat haze, glowing drips and smoke while armor is melting
            const heat = b.heat ?? 0;
            if (!b.isDead && heat > 45 && Math.random() < (heat - 45) / 70) {
              effects.spawnSmoke(b.x, b.y + 0.7, b.z, 1, 0.7, 0.1);
              if (heat > 60) effects.spawnSparks(b.x + (Math.random() - 0.5) * 1.6, b.y + 0.3, b.z + (Math.random() - 0.5) * 1.6, 1, 0xff5a10, 1.2);
            }
            // Frost vapor
            if (!b.isDead && (b.chill ?? 0) > 35 && Math.random() < 0.25) {
              effects.spawnSmoke(b.x, b.y + 0.4, b.z, 1, 0.6, 0.88);
            }
            // Busted parts spark: shredded weapons, ruptured battery
            const comp = b.components;
            if (!b.isDead && comp) {
              if (comp.battery < 30 && Math.random() < 0.18) effects.spawnSparks(b.x, b.y + 0.55, b.z, 3, 0x93c5fd, 5);
              comp.weapons.forEach((h, si) => {
                if (h > 0 && h < 30 && Math.random() < 0.12) {
                  effects.spawnSparks(b.x + Math.sin(b.yaw) * (si === 0 ? 1.1 : 0), b.y + 0.6, b.z + Math.cos(b.yaw) * (si === 0 ? 1.1 : 0), 2, 0xfbbf24, 5);
                }
              });
            }

            // Live Ignition burn flames + smoke
            if (!b.isDead && b.burnTimer > 0 && Math.random() < 0.45) {
              effects.spawnFlames(b.x, b.y + 0.45, b.z, 2, 0, 0, 2.4, 0.8);
              effects.spawnSmoke(b.x, b.y + 0.65, b.z, 1, 0.9, 0.16);
            }

            // Damaged engine smoke & sparks (<45% HP)
            if (!b.isDead && b.hp < b.maxHp * 0.45 && Math.random() < 0.3) {
              effects.spawnSmoke(b.x, b.y + 0.5, b.z, 1, 0.85, 0.22);
              if (b.hp < b.maxHp * 0.3) {
                effects.spawnSparks(b.x, b.y + 0.5, b.z, 1, 0xf97316, 4.0);
              }
            }

            // Boost exhaust flame & smoke puff
            if (!b.isDead && b.boostCooldown > 2.05 && Math.random() < 0.65) {
              const bx = -Math.sin(b.yaw);
              const bz = -Math.cos(b.yaw);
              effects.spawnFlames(b.x + bx * 0.95, b.y + 0.42, b.z + bz * 0.95, 1, bx, bz, 4.5, 0.55);
              effects.spawnSmoke(b.x + bx * 1.0, b.y + 0.3, b.z + bz * 1.0, 1, 0.6, 0.35);
            }
          }

          // Continuous driving & active weapon audio for player bot
          if (playerBot && snap.phase === 'active' && !playerBot.isDead) {
            const pStats = computeBotStats(playerBot.config, playerBot.skills);
            const pWeapons = getBotWeapons(playerBot.config);
            const activeSlotWeapons = pWeapons.filter((_, idx) => Boolean(playerBot.weaponActives?.[idx]));
            const audioWeapons = activeSlotWeapons.length > 0 ? activeSlotWeapons : pWeapons;
            const maxSlotSpin = Math.max(playerBot.weaponSpin, ...(playerBot.weaponSpins ?? [0]));
            soundEngine.updateCombatAudio({
              active: true,
              speed: Math.hypot(playerBot.vx, playerBot.vz),
              maxSpeed: pStats.maxSpeed,
              weapon: audioWeapons[0],
              weapons: audioWeapons,
              weaponActive: activeSlotWeapons.length > 0,
              weaponSpin: maxSlotSpin,
              boosting: playerBot.boostCooldown > 1.8,
            });
          } else {
            soundEngine.stopLoops();
          }

          // Remove any rigs no longer in snapshot
          combatBotRigs.forEach((entry, id) => {
            if (!seenIds.has(id)) {
              scene.remove(entry.rig.root);
              entry.rig.dispose();
              combatBotRigs.delete(id);
            }
          });

          if (snap.events && snap.events.length > 0) {
            processEvents(snap.events);
          }

          overlay.sync(snap, playerIdRef.current, dt, elapsed, snap.phase !== 'finished');
          for (const p of snap.projectiles ?? []) {
            if (Math.random() < 0.7) effects.spawnSmoke(p.x, p.y, p.z, 1, p.kind === 'shell' ? 0.45 : 0.35, 0.55);
            if (p.kind === 'shell' && Math.random() < 0.6) effects.spawnSparks(p.x, p.y, p.z, 1, 0xffb347, 1.5);
          }
          for (const d of snap.debris ?? []) {
            if (!d.settled && d.y > 0.3 && Math.random() < 0.35) effects.spawnSmoke(d.x, d.y, d.z, 1, 0.35, 0.25);
          }
          const wantBlackout = snap.arenaEvent?.kind === 'blackout' ? 1 : 0;
          blackoutLevel += (wantBlackout - blackoutLevel) * Math.min(1, dt * 2.5);
          hemiLight.intensity = baseHemi * (1 - blackoutLevel * 0.82);
          keyLight.intensity = baseKey * (1 - blackoutLevel * 0.88);

          // Smooth Camera Tracking
          if (playerBot) {
            const preset = camPresetRef.current;
            if (preset === 'tactical') {
              _camGoal.set(playerBot.x * 0.55, 22, playerBot.z * 0.55 + 15);
              _lookGoal.set(playerBot.x * 0.5, 0.2, playerBot.z * 0.5);
            } else if (preset === 'cinematic') {
              const orbitA = elapsed * 0.32;
              _camGoal.set(
                playerBot.x + Math.sin(orbitA) * 10.5,
                6.5,
                playerBot.z + Math.cos(orbitA) * 10.5,
              );
              _lookGoal.set(playerBot.x, 0.5, playerBot.z);
            } else {
              // Chase camera anchored behind player's travel / facing direction with wide arena view
              const speed = Math.hypot(playerBot.vx, playerBot.vz);
              const backX = -Math.sin(playerBot.yaw);
              const backZ = -Math.cos(playerBot.yaw);
              const dist = 10.2 + Math.min(2.5, speed * 0.14);
              _camGoal.set(playerBot.x + backX * dist, 7.6, playerBot.z + backZ * dist);
              _lookGoal.set(playerBot.x + Math.sin(playerBot.yaw) * 2.2, 0.5, playerBot.z + Math.cos(playerBot.yaw) * 2.2);
            }

            // Clamp camera within arena overhead envelope
            _camGoal.x = THREE.MathUtils.clamp(_camGoal.x, -21, 21);
            _camGoal.z = THREE.MathUtils.clamp(_camGoal.z, -21, 21);

            camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoal.x, 4.8, dt);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoal.y, 4.8, dt);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoal.z, 4.8, dt);

            _curLook.x = THREE.MathUtils.damp(_curLook.x, _lookGoal.x, 6.5, dt);
            _curLook.y = THREE.MathUtils.damp(_curLook.y, _lookGoal.y, 6.5, dt);
            _curLook.z = THREE.MathUtils.damp(_curLook.z, _lookGoal.z, 6.5, dt);

            if (screenShake > 0.01) {
              camera.position.x += (Math.random() - 0.5) * screenShake;
              camera.position.y += (Math.random() - 0.5) * screenShake * 0.7;
              screenShake *= Math.exp(-8 * dt);
            }

            camera.lookAt(_curLook);
          }
        }
      }

      effects.update(dt);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    // Keep unused inputRef reference acknowledged for future predictive hooks
    void inputRef;

    return () => {
      disposed = true;
      soundEngine.stopLoops();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      orbit.dispose();
      if (workshopBotRig) workshopBotRig.dispose();
      combatBotRigs.forEach((e) => e.rig.dispose());
      arenaBuilt?.dispose();
      effects.dispose();
      overlay.dispose();
      damageDecalPack.dispose();
      textures.dispose();
      pedGeo.dispose();
      pedRingGeo.dispose();
      pedMat.dispose();
      pedRingMat.dispose();
      envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (contextLost) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0D1014] text-slate-300 p-6 text-center">
        <div>
          <p className="font-display text-lg font-bold text-amber-400">Graphics Context Paused</p>
          <p className="text-sm text-slate-400 mt-1">Restoring 3D BattleBox hardware acceleration...</p>
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="w-full h-full select-none" />;
};
