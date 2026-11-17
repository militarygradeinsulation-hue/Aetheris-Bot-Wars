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

    // Light rig references for the Blackout arena event
    const baseLightLevels = { hemi: hemiLight.intensity, key: keyLight.intensity, rim: rimLight.intensity };
    const softboxes: THREE.RectAreaLight[] = [];
    scene.traverse((o) => {
      if ((o as THREE.RectAreaLight).isRectAreaLight) softboxes.push(o as THREE.RectAreaLight);
    });
    const softboxBase = softboxes.map((l) => l.intensity);
    let blackoutLevel = 0;

    // ---- Electric arcs / beams (tesla chains, magnet tethers, lance thrusts, lightning) ----
    const ARC_SEGMENTS = 14;
    interface ArcSlot {
      line: THREE.Line;
      mat: THREE.LineBasicMaterial;
      life: number;
      maxLife: number;
      a: THREE.Vector3;
      b: THREE.Vector3;
      jitter: number;
    }
    const arcPool: ArcSlot[] = [];
    const writeArc = (slot: ArcSlot) => {
      const pos = slot.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i <= ARC_SEGMENTS; i++) {
        const t = i / ARC_SEGMENTS;
        const edge = i === 0 || i === ARC_SEGMENTS ? 0 : 1;
        const j = slot.jitter * edge * Math.sin(t * Math.PI);
        pos.setXYZ(
          i,
          slot.a.x + (slot.b.x - slot.a.x) * t + (Math.random() - 0.5) * j,
          slot.a.y + (slot.b.y - slot.a.y) * t + (Math.random() - 0.5) * j,
          slot.a.z + (slot.b.z - slot.a.z) * t + (Math.random() - 0.5) * j,
        );
      }
      pos.needsUpdate = true;
    };
    const spawnArc = (
      x1: number, y1: number, z1: number,
      x2: number, y2: number, z2: number,
      color: number, life = 0.16, jitter = 0.45,
    ) => {
      let slot = arcPool.find((a) => a.life <= 0);
      if (!slot) {
        if (arcPool.length >= 32) {
          slot = arcPool[0];
        } else {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((ARC_SEGMENTS + 1) * 3), 3));
          const mat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const line = new THREE.Line(geo, mat);
          line.frustumCulled = false;
          scene.add(line);
          slot = { line, mat, life: 0, maxLife: 1, a: new THREE.Vector3(), b: new THREE.Vector3(), jitter };
          arcPool.push(slot);
        }
      }
      slot.a.set(x1, y1, z1);
      slot.b.set(x2, y2, z2);
      slot.jitter = jitter;
      slot.mat.color.setHex(color);
      slot.life = life;
      slot.maxLife = life;
      slot.line.visible = true;
      writeArc(slot);
    };
    const updateArcs = (dt: number) => {
      for (const slot of arcPool) {
        if (slot.life <= 0) {
          slot.line.visible = false;
          continue;
        }
        slot.life -= dt;
        slot.mat.opacity = Math.max(0, slot.life / slot.maxLife);
        if (slot.jitter > 0.05) writeArc(slot);
      }
    };

    // ---- Missiles ----
    const missileBodyGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.46, 8);
    missileBodyGeo.rotateX(Math.PI / 2);
    const missileNoseGeo = new THREE.ConeGeometry(0.07, 0.16, 8);
    missileNoseGeo.rotateX(Math.PI / 2);
    missileNoseGeo.translate(0, 0, 0.31);
    const missileFinGeo = new THREE.BoxGeometry(0.26, 0.02, 0.1);
    missileFinGeo.translate(0, 0, -0.2);
    const missileBodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.7 });
    const missileNoseMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.6 });
    const missileGlowMat = new THREE.MeshBasicMaterial({ color: 0xfdba74, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const missileGlowGeo = new THREE.SphereGeometry(0.11, 8, 6);
    missileGlowGeo.translate(0, 0, -0.28);
    const missileMeshes = new Map<string, THREE.Group>();
    const ensureMissileMesh = (id: string) => {
      let m = missileMeshes.get(id);
      if (m) return m;
      m = new THREE.Group();
      const finA = new THREE.Mesh(missileFinGeo, missileBodyMat);
      const finB = new THREE.Mesh(missileFinGeo, missileBodyMat);
      finB.rotation.z = Math.PI / 2;
      m.add(
        new THREE.Mesh(missileBodyGeo, missileBodyMat),
        new THREE.Mesh(missileNoseGeo, missileNoseMat),
        new THREE.Mesh(missileGlowGeo, missileGlowMat),
        finA,
        finB,
      );
      scene.add(m);
      missileMeshes.set(id, m);
      return m;
    };
    const clearMissiles = () => {
      missileMeshes.forEach((m) => scene.remove(m));
      missileMeshes.clear();
    };

    // ---- Team rings, bounty markers & King of the Hill zone ----
    const teamRingGeo = new THREE.RingGeometry(1.22, 1.4, 40);
    teamRingGeo.rotateX(-Math.PI / 2);
    const makeRingMat = (hex: number) =>
      new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    const ringPlayerMat = makeRingMat(0xf59e0b);
    const ringAllyMat = makeRingMat(0x34d399);
    const ringEnemyMat = makeRingMat(0xef4444);
    const bountyGeo = new THREE.ConeGeometry(0.28, 0.6, 4);
    bountyGeo.rotateX(Math.PI);
    const bountyMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 1.8 });
    const bossCrownGeo = new THREE.TorusGeometry(0.42, 0.06, 6, 5);
    bossCrownGeo.rotateX(Math.PI / 2);

    const hillGroup = new THREE.Group();
    const hillRingGeo = new THREE.RingGeometry(0.93, 1.0, 64);
    hillRingGeo.rotateX(-Math.PI / 2);
    const hillDiscGeo = new THREE.CircleGeometry(0.93, 48);
    hillDiscGeo.rotateX(-Math.PI / 2);
    const hillBeamGeo = new THREE.CylinderGeometry(1, 1, 6, 48, 1, true);
    const hillRingMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    const hillDiscMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.12, depthWrite: false });
    const hillBeamMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const hillRing = new THREE.Mesh(hillRingGeo, hillRingMat);
    hillRing.position.y = 0.04;
    const hillDisc = new THREE.Mesh(hillDiscGeo, hillDiscMat);
    hillDisc.position.y = 0.035;
    const hillBeam = new THREE.Mesh(hillBeamGeo, hillBeamMat);
    hillBeam.position.y = 3;
    hillGroup.add(hillRing, hillDisc, hillBeam);
    hillGroup.visible = false;
    scene.add(hillGroup);
    const overlayDisposables: Array<{ dispose: () => void }> = [
      missileBodyGeo, missileNoseGeo, missileFinGeo, missileBodyMat, missileNoseMat, missileGlowMat, missileGlowGeo,
      teamRingGeo, ringPlayerMat, ringAllyMat, ringEnemyMat, bountyGeo, bountyMat, bossCrownGeo,
      hillRingGeo, hillDiscGeo, hillBeamGeo, hillRingMat, hillDiscMat, hillBeamMat,
    ];

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
    interface CombatRigEntry {
      rig: BuiltBotRig;
      configKey: string;
      teamRing: THREE.Mesh;
      bountyMarker: THREE.Mesh;
      bossCrown?: THREE.Mesh;
    }
    const combatBotRigs = new Map<string, CombatRigEntry>();

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
      clearMissiles();
      hillGroup.visible = false;
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

        if (ev.type === 'arc') {
          spawnArc(ev.x, ev.y, ev.z, ev.x2 ?? ev.x, ev.y2 ?? ev.y, ev.z2 ?? ev.z, 0x93c5fd, 0.2, 0.55);
          spawnArc(ev.x, ev.y, ev.z, ev.x2 ?? ev.x, ev.y2 ?? ev.y, ev.z2 ?? ev.z, 0xe0f2fe, 0.12, 0.3);
          effects.spawnSparks(ev.x2 ?? ev.x, ev.y2 ?? ev.y, ev.z2 ?? ev.z, 10, 0x93c5fd, 7);
          impactFlashLight.position.set(ev.x2 ?? ev.x, (ev.y2 ?? ev.y) + 0.6, ev.z2 ?? ev.z);
          impactFlashLight.color.setHex(0x60a5fa);
          impactFlashLight.intensity = Math.max(impactFlashLight.intensity, 7);
          soundEngine.playZap(0.7);
          continue;
        }
        if (ev.type === 'lightning') {
          spawnArc(ev.x + (Math.random() - 0.5) * 2, 16, ev.z + (Math.random() - 0.5) * 2, ev.x, 0.1, ev.z, 0xffffff, 0.3, 2.4);
          spawnArc(ev.x + (Math.random() - 0.5) * 3, 16, ev.z + (Math.random() - 0.5) * 3, ev.x, 0.1, ev.z, 0x93c5fd, 0.35, 3.2);
          effects.spawnShockwave(ev.x, 0.1, ev.z, 3.6, 0x93c5fd);
          effects.spawnSparks(ev.x, 0.3, ev.z, 30, 0xe0f2fe, 12);
          effects.spawnSmoke(ev.x, 0.4, ev.z, 6, 1.1, 0.3);
          impactFlashLight.position.set(ev.x, 3, ev.z);
          impactFlashLight.color.setHex(0xdbeafe);
          impactFlashLight.intensity = 22;
          screenShake = Math.min(0.9, screenShake + 0.4);
          crowdExcitement = Math.min(1, crowdExcitement + 0.4);
          soundEngine.playThunder();
          continue;
        }
        if (ev.type === 'magnet_pull') {
          spawnArc(ev.x, ev.y, ev.z, ev.x2 ?? ev.x, ev.y2 ?? ev.y, ev.z2 ?? ev.z, 0xef4444, 0.35, 0.2);
          spawnArc(ev.x, ev.y, ev.z, ev.x2 ?? ev.x, ev.y2 ?? ev.y, ev.z2 ?? ev.z, 0xfca5a5, 0.25, 0.08);
          soundEngine.playZap(0.5);
          continue;
        }
        if (ev.type === 'lance') {
          spawnArc(ev.x, ev.y, ev.z, ev.x2 ?? ev.x, ev.y2 ?? ev.y, ev.z2 ?? ev.z, 0xf8fafc, 0.1, 0);
          if (ev.intensity > 0.5) effects.spawnSparks(ev.x2 ?? ev.x, ev.y2 ?? ev.y, ev.z2 ?? ev.z, 14, 0xfde68a, 10);
          continue;
        }
        if (ev.type === 'reflect') {
          spawnArc(ev.x, ev.y, ev.z, ev.x2 ?? ev.x, ev.y2 ?? ev.y, ev.z2 ?? ev.z, 0xfb923c, 0.18, 0.4);
          effects.spawnFlames(ev.x, ev.y, ev.z, 5, 0, 0, 4, 0.8);
          effects.spawnSparks(ev.x, ev.y, ev.z, 14, 0xf97316, 10);
          continue;
        }
        if (ev.type === 'shield_block') {
          effects.spawnShockwave(ev.x, ev.y, ev.z, 2.4, 0x818cf8);
          effects.spawnSparks(ev.x, ev.y, ev.z, 8, 0xa5b4fc, 6);
          continue;
        }
        if (ev.type === 'missile_launch') {
          effects.spawnSmoke(ev.x, ev.y, ev.z, 5, 0.9, 0.3);
          effects.spawnFlames(ev.x, ev.y, ev.z, 3, 0, 0, 2, 0.5);
          soundEngine.playMissileLaunch();
          continue;
        }
        if (ev.type === 'pit_fall') {
          effects.spawnShockwave(ev.x, 0.1, ev.z, 3.4, 0x22d3ee);
          effects.spawnFlames(ev.x, 0.2, ev.z, 10, 0, 0, 5, 1.1);
          effects.spawnSmoke(ev.x, 0.3, ev.z, 8, 1.3, 0.4);
          screenShake = Math.min(0.9, screenShake + 0.45);
          crowdExcitement = 1;
          soundEngine.playExplosion();
          soundEngine.playCrowdCheer(1.1);
          continue;
        }
        if (ev.type === 'arena_event' || ev.type === 'wave_start' || ev.type === 'hill_move') {
          const col = ev.type === 'wave_start' ? 0xef4444 : ev.type === 'hill_move' ? 0xfacc15 : 0xd946ef;
          effects.spawnShockwave(ev.x, 0.15, ev.z, ev.type === 'hill_move' ? 3.6 : 6, col);
          if (ev.label === 'supply_drop') {
            effects.spawnSparks(ev.x, 3, ev.z, 30, 0x34d399, 10);
            effects.spawnSmoke(ev.x, 0.5, ev.z, 8, 1.2, 0.3);
          }
          if (ev.type !== 'hill_move' || ev.label === 'moved') soundEngine.playAnnouncerSting();
          if (ev.type === 'wave_start') soundEngine.playCrowdCheer(1);
          continue;
        }

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
        } else if (ev.type === 'flip') {
          effects.spawnShockwave(ev.x, ev.y, ev.z, 4.2, 0x38bdf8);
          effects.spawnSparks(ev.x, ev.y, ev.z, 12, 0x38bdf8, 9);
          effects.spawnSmoke(ev.x, ev.y, ev.z, 4, 0.95, 0.35);
          crowdExcitement = Math.min(1.0, crowdExcitement + 0.55);
          soundEngine.playFlip();
          soundEngine.playCrowdCheer(0.95);
        } else if (ev.type === 'explosion') {
          const k = Math.max(0.35, Math.min(1, ev.intensity / 1.5));
          effects.spawnShockwave(ev.x, ev.y, ev.z, 7.2 * k, 0xef4444);
          effects.spawnFlames(ev.x, ev.y, ev.z, Math.round(18 * k), 0, 0, 6.5 * k, 1.45 * k);
          effects.spawnSmoke(ev.x, ev.y + 0.4, ev.z, Math.round(14 * k), 1.5 * k, 0.14);
          effects.spawnSparks(ev.x, ev.y, ev.z, Math.round(38 * k), 0xf97316, 16 * k);
          if (k > 0.6) effects.spawnDebris(ev.x, ev.y, ev.z, 8, '#dc2626', 1.1);
          impactFlashLight.position.set(ev.x, ev.y + 1.2, ev.z);
          impactFlashLight.color.setHex(0xff6b2c);
          impactFlashLight.intensity = Math.max(impactFlashLight.intensity, 18 * k);
          crowdExcitement = Math.min(1, crowdExcitement + 0.6 * k);
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
        if (workshopBotRig) {
          workshopBotRig.root.visible = true;
          workshopBotRig.root.rotation.y += dt * 0.42;
          workshopWeaponAngle += dt * 7.5;
          for (const entry of workshopBotRig.weaponEntries) {
            const wType = entry.weaponId;
            if (wType === 'vspinner') entry.pivot.rotation.x = workshopWeaponAngle;
            else if (wType === 'hbar') entry.pivot.rotation.y = workshopWeaponAngle;
            else if (wType === 'sawblade') {
              entry.secondarySpinners.forEach((s, idx) => {
                s.rotation.y = idx === 0 ? workshopWeaponAngle : -workshopWeaponAngle;
              });
            } else if (wType === 'flame') {
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
            } else if (wType === 'drum') {
              entry.pivot.rotation.x = workshopWeaponAngle * 1.4;
            } else if (wType === 'jaws') {
              if (entry.movingPart) entry.movingPart.rotation.x = -0.55 + Math.max(0, Math.sin(elapsed * 2.4)) * 0.6;
            } else if (wType === 'lance') {
              if (entry.movingPart) entry.movingPart.position.z = Math.max(0, Math.sin(elapsed * 2.0)) ** 4 * 1.2;
            } else if (wType === 'tesla') {
              entry.secondarySpinners.forEach((r) => (r.rotation.y = workshopWeaponAngle));
              if (entry.glowMat) entry.glowMat.emissiveIntensity = 1.2 + Math.random() * 1.6;
              if (Math.random() < 0.08 && entry.movingPart) {
                const wp = new THREE.Vector3();
                entry.movingPart.getWorldPosition(wp);
                spawnArc(wp.x, wp.y, wp.z, wp.x + (Math.random() - 0.5) * 1.4, wp.y + Math.random() * 0.6, wp.z + (Math.random() - 0.5) * 1.4, 0x93c5fd, 0.12, 0.25);
              }
            } else if (wType === 'magnet') {
              if (entry.glowMat) entry.glowMat.emissiveIntensity = 0.6 + Math.abs(Math.sin(elapsed * 2)) * 1.6;
            } else if (wType === 'missiles') {
              if (entry.movingPart) entry.movingPart.rotation.y = Math.sin(elapsed * 0.8) * 0.25;
            } else {
              entry.pivot.rotation.x = Math.sin(elapsed * 2.6) * 0.45 - 0.35;
            }
          }
          for (const f of workshopBotRig.fans) f.rotation.y += dt * 30;
          if (workshopBotRig.isHover) workshopBotRig.bodyPivot.position.y = 0.1 + Math.sin(elapsed * 4) * 0.025;
          if (workshopBotRig.shieldMesh) {
            (workshopBotRig.shieldMesh.material as THREE.MeshBasicMaterial).opacity = 0.025 + Math.abs(Math.sin(elapsed * 1.5)) * 0.04;
          }
        }
        orbit.update();
      } else {
        turntableGroup.visible = false;
        if (workshopBotRig) workshopBotRig.root.visible = false;

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
            const cfgKey = `${b.config.name}_${botStyles.join('+')}_${b.config.armor}_${botWeapons.join('+')}_${b.config.wheelLayout}_${b.config.drive}_${b.config.primaryColor}_${b.config.accentColor}_${b.config.finish ?? ''}_${b.config.pattern ?? ''}_${b.config.glowColor ?? ''}_${b.config.underglow ? 1 : 0}_${b.config.raceNumber ?? ''}`;
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
              const teamRing = new THREE.Mesh(teamRingGeo, ringEnemyMat);
              teamRing.position.y = 0.035;
              newRig.root.add(teamRing);
              const bountyMarker = new THREE.Mesh(bountyGeo, bountyMat);
              bountyMarker.position.y = 2.7;
              bountyMarker.visible = false;
              newRig.root.add(bountyMarker);
              let bossCrown: THREE.Mesh | undefined;
              if (b.isBoss) {
                bossCrown = new THREE.Mesh(bossCrownGeo, bountyMat);
                bossCrown.position.y = 2.3;
                newRig.root.add(bossCrown);
              }
              entry = { rig: newRig, configKey: cfgKey, teamRing, bountyMarker, bossCrown };
              combatBotRigs.set(b.id, entry);
            }

            syncBotRigToState(entry.rig, b, dt, b.id === playerIdRef.current);
            const playerTeamNow = snap.bots.find((x) => x.id === playerIdRef.current)?.team ?? 0;
            entry.teamRing.visible = !b.isDead;
            entry.teamRing.material =
              b.id === playerIdRef.current ? ringPlayerMat : b.team === playerTeamNow ? ringAllyMat : ringEnemyMat;
            entry.bountyMarker.visible = Boolean(b.isBounty) && !b.isDead;
            if (entry.bountyMarker.visible) {
              entry.bountyMarker.rotation.y = elapsed * 3;
              entry.bountyMarker.position.y = 2.7 + b.y + Math.sin(elapsed * 4) * 0.15;
            }
            if (entry.bossCrown) {
              entry.bossCrown.visible = !b.isDead;
              entry.bossCrown.rotation.y = elapsed * 1.2;
              entry.bossCrown.position.y = 2.3 + b.y;
            }

            // Tesla coil crackle while channeling
            const teslaIdx = botWeapons.indexOf('tesla');
            if (!b.isDead && teslaIdx >= 0 && b.weaponActives?.[teslaIdx] && Math.random() < 0.35) {
              const tx = b.x + Math.cos(b.yaw) * 0.48 + Math.sin(b.yaw) * 0.12;
              const tz = b.z - Math.sin(b.yaw) * 0.48 + Math.cos(b.yaw) * 0.12;
              const ty = b.y + 1.5 * b.scale;
              spawnArc(tx, ty, tz, tx + (Math.random() - 0.5) * 1.6, ty + (Math.random() - 0.3) * 0.8, tz + (Math.random() - 0.5) * 1.6, 0x93c5fd, 0.1, 0.3);
            }
            // Stun sparks
            if (!b.isDead && (b.stunTimer ?? 0) > 0 && Math.random() < 0.4) {
              effects.spawnSparks(b.x, b.y + 0.8, b.z, 2, 0x93c5fd, 4);
            }

            // Live Flame Torch particle jet stream (only when flame weapon slot itself is active)
            const flameSlotIdx = botWeapons.indexOf('flame');
            const flameSlotActive =
              flameSlotIdx >= 0 && (b.weaponActives?.[flameSlotIdx] ?? b.weaponActive);
            if (!b.isDead && flameSlotActive && Math.random() < 0.75) {
              const fx = Math.sin(b.yaw);
              const fz = Math.cos(b.yaw);
              effects.spawnFlames(b.x + fx * 1.4, b.y + 0.48, b.z + fz * 1.4, 2, fx, fz, 7.5, 0.85);
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

          // Missiles in flight
          const liveMissiles = new Set<string>();
          for (const p of snap.projectiles ?? []) {
            liveMissiles.add(p.id);
            const m = ensureMissileMesh(p.id);
            m.position.set(p.x, p.y, p.z);
            m.rotation.y = p.yaw;
            if (Math.random() < 0.7) {
              effects.spawnSmoke(p.x - Math.sin(p.yaw) * 0.35, p.y, p.z - Math.cos(p.yaw) * 0.35, 1, 0.45, 0.12);
            }
          }
          missileMeshes.forEach((m, id) => {
            if (!liveMissiles.has(id)) {
              scene.remove(m);
              missileMeshes.delete(id);
            }
          });

          // King of the Hill zone
          if (snap.hill) {
            const hz = snap.hill;
            const pTeam = snap.bots.find((x) => x.id === playerIdRef.current)?.team ?? 0;
            hillGroup.visible = true;
            hillGroup.position.x = THREE.MathUtils.damp(hillGroup.position.x, hz.x, 6, dt);
            hillGroup.position.z = THREE.MathUtils.damp(hillGroup.position.z, hz.z, 6, dt);
            hillGroup.scale.set(hz.radius, 1, hz.radius);
            const hillHex = hz.contested ? 0xf59e0b : hz.owner === null ? 0xf8fafc : hz.owner === pTeam ? 0x34d399 : 0xef4444;
            hillRingMat.color.setHex(hillHex);
            hillDiscMat.color.setHex(hillHex);
            hillBeamMat.color.setHex(hillHex);
            hillRingMat.opacity = hz.contested ? 0.5 + Math.abs(Math.sin(elapsed * 10)) * 0.45 : 0.85;
            hillBeamMat.opacity = 0.06 + Math.abs(Math.sin(elapsed * 2)) * 0.05;
          } else {
            hillGroup.visible = false;
          }

          if (snap.events && snap.events.length > 0) {
            processEvents(snap.events);
          }

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

      // Blackout arena event: dim the arena rig, leaving visors & glows to read the fight
      const wantBlackout = modeRef.current === 'combat' && snapshotRef.current?.arenaEvent?.kind === 'blackout' ? 1 : 0;
      blackoutLevel += (wantBlackout - blackoutLevel) * Math.min(1, dt * 2.5);
      const dim = 1 - blackoutLevel * 0.82;
      hemiLight.intensity = baseLightLevels.hemi * dim;
      keyLight.intensity = baseLightLevels.key * dim;
      rimLight.intensity = baseLightLevels.rim * (1 - blackoutLevel * 0.4);
      softboxes.forEach((l, i) => (l.intensity = softboxBase[i] * dim));

      updateArcs(dt);
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
      clearMissiles();
      arcPool.forEach((a) => {
        a.line.geometry.dispose();
        a.mat.dispose();
      });
      overlayDisposables.forEach((d) => d.dispose());
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
