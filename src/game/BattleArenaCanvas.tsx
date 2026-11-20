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
  type ColorBlindMode,
  type CombatEvent,
  type DestructibleProp,
  type HazardState,
  type PlayerInputState,
} from '../shared/types';
import { createInitialSnapshot } from '../shared/physicsEngine';
import { buildArenaEnvironment, type BuiltArenaScene } from './arenaBuilder';
import { buildBotRig, syncBotRigToState, type BuiltBotRig } from './botBuilder';
import { createDamageDecalPack } from './damageDecals';
import { createProceduralTextures, type ProceduralTexturePack } from './materials';
import { EffectsManager } from './particlesAndDebris';
import { CombatOverlay } from './combatOverlay';
import { createPostFx, type PostFx } from './postFx';
import { buildArenaEnvMap } from './arenaEnvironment';
import { soundEngine } from './soundEngine';
import { voiceCommentator } from './voiceCommentator';

import type { StudioLightingPreset } from '../components/LiveVoiceCopilot';
import type { WorkshopCameraAngle } from '../components/ThreeSceneInspectorDock';

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
  cameraPreset?: 'chase' | 'first_person' | 'pilot_booth' | 'tactical' | 'cinematic' | 'spectator';
  cameraSensitivity?: number;
  colorBlindMode?: ColorBlindMode;
  ssaoEnabled?: boolean;
  explodedRatio?: number;
  lightingPreset?: StudioLightingPreset;
  turntableSpeed?: number;
  workshopCameraAngle?: WorkshopCameraAngle;
  onWorkshopCameraManualOrbit?: () => void;
  weaponTestBurstSignal?: number;
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

/** Halve the brightness of additive glow sprites and halos (underglow, auras, light cones). */
function dimAdditiveGlow(root: THREE.Object3D) {
  root.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      if (m.blending === THREE.AdditiveBlending && !m.userData.glowCut) {
        m.userData.glowCut = true;
        m.opacity *= 0.5;
      }
    }
  });
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
  cameraSensitivity = 0.65,
  colorBlindMode = 'none',
  ssaoEnabled = true,
  explodedRatio = 0,
  lightingPreset = 'arena',
  turntableSpeed = 1,
  workshopCameraAngle = 'free',
  onWorkshopCameraManualOrbit,
  weaponTestBurstSignal = 0,
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
  const camSensitivityRef = useRef(cameraSensitivity);
  const colorBlindRef = useRef<ColorBlindMode>(colorBlindMode);
  const ssaoRef = useRef(ssaoEnabled);
  const explodedRatioRef = useRef(explodedRatio);
  const lightingPresetRef = useRef<StudioLightingPreset>(lightingPreset);
  const turntableSpeedRef = useRef(turntableSpeed);
  const workshopCameraAngleRef = useRef<WorkshopCameraAngle>(workshopCameraAngle);
  const onManualOrbitRef = useRef(onWorkshopCameraManualOrbit);
  const weaponTestSignalRef = useRef(weaponTestBurstSignal);

  modeRef.current = mode;
  arenaIdRef.current = arenaId;
  batteryRef.current = batteryMode;
  playerConfigRef.current = playerBotConfig;
  playerIdRef.current = playerId;
  stepLocalRef.current = onStepLocalPhysics;
  onEventsRef.current = onCombatEvents;
  camPresetRef.current = cameraPreset;
  camSensitivityRef.current = cameraSensitivity;
  colorBlindRef.current = colorBlindMode;
  ssaoRef.current = ssaoEnabled;
  explodedRatioRef.current = explodedRatio;
  lightingPresetRef.current = lightingPreset;
  turntableSpeedRef.current = turntableSpeed;
  workshopCameraAngleRef.current = workshopCameraAngle;
  onManualOrbitRef.current = onWorkshopCameraManualOrbit;
  weaponTestSignalRef.current = weaponTestBurstSignal;

  // Imperative scene rebuild hooks stored in refs
  const rebuildWorkshopBotRef = useRef<(() => void) | null>(null);
  const rebuildArenaRef = useRef<(() => void) | null>(null);
  const updateBatteryRef = useRef<(() => void) | null>(null);
  const updateExposureRef = useRef<(() => void) | null>(null);

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
    updateExposureRef.current?.();
  }, [ssaoEnabled]);

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
    let postFx: PostFx | null = null;
    const applyExposure = () => {
      renderer.toneMappingExposure = ssaoRef.current ? 1.0 : 0.95;
      const smallTouch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && window.innerWidth < 900;
      postFx?.setQuality(
        batteryRef.current === 'eco' ? 'off' : batteryRef.current === 'ultra' || (ssaoRef.current && !smallTouch) ? 'high' : 'low',
        ssaoRef.current,
      );
    };
    applyExposure();
    updateExposureRef.current = applyExposure;
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
    updateBatteryRef.current = () => {
      applyBatteryPixelRatio();
      applyExposure();
      const sz = renderer.getSize(new THREE.Vector2());
      postFx?.setSize(sz.x, sz.y);
    };

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
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
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.2, 240);
    camera.position.set(0, 10, 15);
    camera.lookAt(0, 0.5, 0);
    // Film-style finishing (AO, bloom, lens, SMAA). Software GL renders plain to stay fast.
    const forceFx = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fx');
    if (!isSoftwareGl || forceFx) {
      try {
        postFx = createPostFx(renderer, scene, camera);
        applyExposure();
      } catch {
        postFx = null;
      }
    }

    // Studio Environment Reflection (mandatory for PBR metals)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 3-Point Warm/Cool Studio + Arena Lighting Rig (<= 2 shadow casters)
    // Fill is kept low: most ambient light now comes from the arena HDR environment
    const hemiLight = new THREE.HemisphereLight(0xa5d8ff, 0x1e293b, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff3db, 2.6);
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
      const softboxA = new THREE.RectAreaLight(0xffffff, 1.5, 18, 2.6);
      softboxA.position.set(0, 14, -7);
      softboxA.lookAt(0, 0, 0);
      const softboxB = new THREE.RectAreaLight(0xffedd5, 1.3, 18, 2.6);
      softboxB.position.set(0, 14, 7);
      softboxB.lookAt(0, 0, 0);
      scene.add(softboxA, softboxB);
    }

    // Dynamic impact flash light (no shadow cast)
    const impactFlashLight = new THREE.PointLight(0xff9e44, 0, 15, 1.8);
    impactFlashLight.position.set(0, 2, 0);
    scene.add(impactFlashLight);

    // OrbitControls for Workshop & Arena 3D View showcase
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = !isSoftwareGl;
    orbit.dampingFactor = 0.06;
    orbit.minDistance = 2.4;
    orbit.maxDistance = 42;
    orbit.maxPolarAngle = Math.PI * 0.48;
    orbit.minPolarAngle = 0.18;
    orbit.target.set(0, 0.45, 0);
    orbit.enabled = modeRef.current === 'workshop';
    orbit.addEventListener('start', () => {
      if (workshopCameraAngleRef.current !== 'free') {
        workshopCameraAngleRef.current = 'free';
        onManualOrbitRef.current?.();
      }
    });

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    let textures: ProceduralTexturePack = createProceduralTextures(maxAnisotropy, arenaIdRef.current);
    const damageDecalPack = createDamageDecalPack(maxAnisotropy);
    let arenaBuilt: BuiltArenaScene | null = null;
    const effects = new EffectsManager(scene, isSoftwareGl);
    const overlay = new CombatOverlay(scene);
    const baseHemi = hemiLight.intensity;
    const baseKey = keyLight.intensity;
    let blackoutLevel = 0;
    // Workshop framing: shift the render right so the bot sits in the open space beside the left vertical tile
    let viewShift = 0;
    let viewShiftTarget = 0;
    let viewShiftProbe = 0;
    const applyViewShift = () => {
      const w = renderer.domElement.clientWidth || window.innerWidth;
      const h = renderer.domElement.clientHeight || window.innerHeight;
      if (Math.abs(viewShift) < 0.5) camera.clearViewOffset();
      else camera.setViewOffset(w, h, viewShift, 0, w, h);
    };

    // Workshop turntable pedestal
    const turntableGroup = new THREE.Group();
    const pedGeo = new THREE.CylinderGeometry(1.9, 2.15, 0.22, 32);
    const pedRingGeo = new THREE.TorusGeometry(1.92, 0.04, 8, 48);
    pedRingGeo.rotateX(Math.PI / 2);
    const pedBrandGeo = new THREE.PlaneGeometry(2.65, 0.74);
    pedBrandGeo.rotateX(-Math.PI / 2);
    const pedBrandTex = new THREE.TextureLoader().load(
      '/assets/aistudio/WhatsApp_Image_2026-11-16_at_3.53.53_PM_9a533155.jpeg',
    );
    pedBrandTex.colorSpace = THREE.SRGBColorSpace;
    pedBrandTex.anisotropy = maxAnisotropy;
    const pedBrandMat = new THREE.MeshStandardMaterial({
      map: pedBrandTex,
      emissive: 0xffffff,
      emissiveMap: pedBrandTex,
      emissiveIntensity: 0.62,
      roughness: 0.22,
      metalness: 0.3,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
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
    const pedBrandMesh = new THREE.Mesh(pedBrandGeo, pedBrandMat);
    pedBrandMesh.position.set(0, 0.008, 1.05);
    turntableGroup.add(pedMesh, pedRing, pedBrandMesh);
    scene.add(turntableGroup);

    let workshopBotRig: BuiltBotRig | null = null;
    const combatBotRigs = new Map<string, { rig: BuiltBotRig; configKey: string }>();
    let workshopPreviewProps: DestructibleProp[] = [];
    let workshopPreviewHazards: HazardState[] = [];
    let prevMode: 'workshop' | 'combat' = modeRef.current;

    interface WorkshopBaseOffsets {
      armorFront: THREE.Vector3;
      armorRear: THREE.Vector3;
      armorLeft: THREE.Vector3;
      armorRight: THREE.Vector3;
      weaponMounts: THREE.Vector3[];
      wheels: THREE.Vector3[];
      accessory?: THREE.Vector3;
      shield?: THREE.Vector3;
    }
    let workshopBaseOffsets: WorkshopBaseOffsets | null = null;
    let currentExploded = 0;
    let lastHandledTestBurst = weaponTestSignalRef.current;

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
      dimAdditiveGlow(workshopBotRig.root);
      const previewScale = computeBotStats(playerConfigRef.current, DEFAULT_SKILLS).bodyScale;
      workshopBotRig.root.scale.setScalar(previewScale);
      workshopBotRig.root.visible = modeRef.current === 'workshop';
      workshopBaseOffsets = {
        armorFront: workshopBotRig.armorPlates.front.position.clone(),
        armorRear: workshopBotRig.armorPlates.rear.position.clone(),
        armorLeft: workshopBotRig.armorPlates.left.position.clone(),
        armorRight: workshopBotRig.armorPlates.right.position.clone(),
        weaponMounts: workshopBotRig.weaponEntries.map((w) => w.mountGroup.position.clone()),
        wheels: workshopBotRig.wheels.map((w) => w.position.clone()),
        accessory: workshopBotRig.accessoryPivot?.position.clone(),
        shield: workshopBotRig.shieldBubble?.position.clone(),
      };
      scene.add(workshopBotRig.root);
    };

    let arenaEnv: THREE.Texture | null = null;
    const rebuildArena = () => {
      const aSpec = ARENA_CATALOG[arenaIdRef.current];
      scene.background = new THREE.Color(aSpec.skyHex);
      scene.fog = new THREE.FogExp2(aSpec.skyHex, 0.011);
      // Arena-shaped HDR lighting: floodlight banks and LED bands show up in every reflection
      try {
        const nextEnv = buildArenaEnvMap(renderer, aSpec.accentHex, aSpec.skyHex);
        scene.environment = nextEnv;
        // Reflections should read as a lit arena, not a mirror ball
        (scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.65;
        arenaEnv?.dispose();
        arenaEnv = nextEnv;
      } catch {
        scene.environment = envTexture;
      }

      if (arenaBuilt) {
        scene.remove(arenaBuilt.group);
        arenaBuilt.dispose();
        arenaBuilt = null;
      }
      textures.dispose();
      textures = createProceduralTextures(maxAnisotropy, arenaIdRef.current);
      arenaBuilt = buildArenaEnvironment(arenaIdRef.current, textures, !isSoftwareGl);
      dimAdditiveGlow(arenaBuilt.group);
      scene.add(arenaBuilt.group);

      // Rebuild workshop bot too so it never holds disposed texture handles
      if (workshopBotRig) {
        rebuildWorkshopBot();
      }

      const isWorkshop = modeRef.current === 'workshop';
      const switchedMode = prevMode !== modeRef.current;
      prevMode = modeRef.current;
      turntableGroup.visible = isWorkshop;
      orbit.enabled = isWorkshop;
      if (isWorkshop) {
        soundEngine.stopLoops();
        // Populate signature arena hazards & destructible props for 3D Arena Preview in Workshop
        const previewSnap = createInitialSnapshot('duel_1v1', arenaIdRef.current, [], 180);
        workshopPreviewProps = previewSnap.props;
        workshopPreviewHazards = previewSnap.hazards.map((h) => ({
          ...h,
          active:
            h.kind === 'saw' ||
            h.kind === 'spinner_blade' ||
            h.kind === 'laser_grid' ||
            h.kind === 'oil_slick',
          warning: h.kind === 'crusher' || h.kind === 'emp_ring' || h.kind === 'lava_vent' || h.kind === 'acid_pool',
        }));
        arenaBuilt.syncDynamicProps(workshopPreviewProps, 0);
        arenaBuilt.syncHazards(workshopPreviewHazards, 0.016, colorBlindRef.current);

        if (workshopCameraAngleRef.current === 'arena_3d') {
          camera.position.set(0, 14.5, 22.0);
          orbit.target.set(0, 0.6, 0);
          orbit.update();
        } else if (switchedMode) {
          camera.position.set(3.2, 2.1, 3.6);
          orbit.target.set(0, 0.42, 0);
          orbit.update();
        }
      } else {
        workshopPreviewProps = [];
        workshopPreviewHazards = [];
        _curLook.set(0, 0.5, 0);
        smoothFollowYaw = null;
        lastProcessedEventId = 0;
        camera.position.set(0, 12, 18);
        camera.lookAt(0, 0.5, 0);
      }

      // Clear stale combat rigs when changing mode
      combatBotRigs.forEach((entry) => {
        scene.remove(entry.rig.root);
        entry.rig.dispose();
      });
      combatBotRigs.clear();
      overlay.clearDynamic();
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
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      postFx?.setSize(w, h);
      viewShiftProbe = 0;
      applyViewShift();
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => handleResize()) : null;
    resizeObserver?.observe(container);

    // Loop & State Tracking
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let lastProcessedEventId = 0;
    let screenShake = 0;
    let crowdExcitement = 0.2;
    let workshopWeaponAngle = 0;
    let lastEcoRender = 0;
    let smoothFollowYaw: number | null = null;
    let camYawVel = 0;
    const _tmpFocus = new THREE.Vector3();
    let camFrameMix = 0;
    let camSpeedSmooth = 0;
    _curLook.set(0, 0.5, 0);

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
        voiceCommentator.onCombatEvent(ev);

        if (ev.type === 'hit' || ev.type === 'crit') {
          const isCrit = ev.type === 'crit';
          // Scale procedural spark count and velocity directly with physical impact force & intensity
          const impactForce = Math.max(1, ev.force ?? ev.intensity * 6);
          const forceScale = Math.min(2.6, Math.max(0.65, impactForce / 7.5));
          const sparkCount = Math.round((isCrit ? 24 : 12) * forceScale);
          const sparkSpeed = (isCrit ? 12 : 8.5) * Math.min(1.8, 0.75 + forceScale * 0.45);
          effects.spawnSparks(
            ev.x,
            ev.y,
            ev.z,
            sparkCount,
            isCrit ? 0xf97316 : 0xfbbf24,
            sparkSpeed,
          );
          effects.spawnSmoke(ev.x, ev.y, ev.z, isCrit ? 4 : 2, isCrit ? 1.0 : 0.7, 0.26);
          if (isCrit || forceScale > 1.45) {
            effects.spawnFlames(ev.x, ev.y, ev.z, isCrit ? 4 : 2, 0, 0, 3.5 * forceScale, 0.85);
            impactFlashLight.position.set(ev.x, ev.y + 0.8, ev.z);
            impactFlashLight.color.setHex(0xff9e44);
            impactFlashLight.intensity = 8 * forceScale;
            crowdExcitement = Math.min(1.0, crowdExcitement + 0.45);
            if (ev.intensity > 1.48) soundEngine.playCrowdCheer(0.75);
          }
          applyEventDecal(ev);
          screenShake = Math.min(0.65, screenShake + ev.intensity * 0.14);
          soundEngine.playImpact(ev.intensity, isCrit, ev.weapon, ev.damageKind);
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
        } else if (ev.type === 'laser_beam') {
          const tx = ev.targetX ?? ev.x;
          const tz = ev.targetZ ?? ev.z;
          overlay.addBeam(ev.x, ev.y + 0.25, ev.z, tx, (ev.targetY ?? ev.y) + 0.25, tz, 0xf43f5e, 0.22, 0.065);
          effects.spawnSparks(tx, ev.y + 0.2, tz, 14, 0xf43f5e, 10);
          effects.spawnSmoke(tx, ev.y + 0.3, tz, 3, 0.7, 0.2);
          impactFlashLight.position.set(tx, ev.y + 0.6, tz);
          impactFlashLight.color.setHex(0xf43f5e);
          impactFlashLight.intensity = Math.max(impactFlashLight.intensity, 10);
          applyEventDecal(ev);
          soundEngine.playZap(0.85);
        } else if (ev.type === 'bomb_blast') {
          effects.spawnShockwave(ev.x, 0.15, ev.z, 6.8, 0xf97316);
          effects.spawnFlames(ev.x, 0.2, ev.z, 22, 0, 0, 6.2, 1.45);
          effects.spawnSmoke(ev.x, 0.5, ev.z, 16, 1.55, 0.16);
          effects.spawnSparks(ev.x, 0.3, ev.z, 36, 0xfbbf24, 16);
          effects.spawnDebris(ev.x, 0.3, ev.z, 8, '#ea580c', 1.15);
          impactFlashLight.position.set(ev.x, 2.2, ev.z);
          impactFlashLight.color.setHex(0xff6b2c);
          impactFlashLight.intensity = 22;
          crowdExcitement = Math.min(1, crowdExcitement + 0.65);
          screenShake = Math.min(0.95, screenShake + 0.5);
          soundEngine.playExplosion();
        } else if (ev.type === 'oil_slip') {
          effects.spawnSmoke(ev.x, 0.15, ev.z, 5, 0.75, 0.12);
          effects.spawnSparks(ev.x, 0.15, ev.z, 6, 0x64748b, 4);
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
        } else if (ev.type === 'weapon_clash') {
          effects.spawnShockwave(ev.x, ev.y + 0.25, ev.z, 4.6, 0xfbbf24);
          effects.spawnSparks(ev.x, ev.y + 0.3, ev.z, 28, 0xfef08a, 14);
          impactFlashLight.position.set(ev.x, ev.y + 0.8, ev.z);
          impactFlashLight.color.setHex(0xfde047);
          impactFlashLight.intensity = 14;
          screenShake = Math.min(0.65, screenShake + 0.25);
          soundEngine.playImpact(1.35, true);
        } else if (ev.type === 'thermal_shock') {
          effects.spawnShockwave(ev.x, ev.y + 0.25, ev.z, 5.2, 0x38bdf8);
          effects.spawnShockwave(ev.x, ev.y + 0.35, ev.z, 3.8, 0xf97316);
          effects.spawnSparks(ev.x, ev.y + 0.3, ev.z, 26, 0x7dd3fc, 13);
          effects.spawnSmoke(ev.x, ev.y + 0.4, ev.z, 8, 1.2, 0.65);
          screenShake = Math.min(0.75, screenShake + 0.3);
          soundEngine.playExplosion();
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
          if (k > 0.78) soundEngine.playCrowdCheer(1.1);
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
          soundEngine.playImpact(1.4, true, ev.weapon, ev.damageKind);
          soundEngine.playCrowdCheer(0.85);
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
        } else if (ev.type === 'ring_out') {
          effects.spawnShockwave(ev.x, ev.y, ev.z, 9.2, 0x38bdf8);
          effects.spawnSparks(ev.x, ev.y, ev.z, 48, 0x38bdf8, 18);
          effects.spawnFlames(ev.x, ev.y, ev.z, 16, 0, 0, 5.5, 1.4);
          impactFlashLight.position.set(ev.x, ev.y + 1.5, ev.z);
          impactFlashLight.color.setHex(0x38bdf8);
          impactFlashLight.intensity = 22;
          crowdExcitement = 1.0;
          screenShake = Math.min(1.0, screenShake + 0.75);
          soundEngine.playKo();
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
        if (workshopPreviewProps.length > 0) {
          arenaBuilt?.syncDynamicProps(workshopPreviewProps, elapsed);
        }
        if (workshopPreviewHazards.length > 0) {
          for (const h of workshopPreviewHazards) {
            if (h.kind === 'laser_grid' || h.kind === 'spinner_blade') {
              h.sweepAngle = elapsed * 0.9 + h.phase;
            }
          }
          arenaBuilt?.syncHazards(workshopPreviewHazards, dt, colorBlindRef.current);
        }
        postFx?.setFocus(camera.position.distanceTo(orbit.target));
        if (--viewShiftProbe <= 0) {
          viewShiftProbe = 20;
          const dock = document.getElementById('workshop-dock');
          const dockRightEl = document.getElementById('workshop-dock-right');
          const w = renderer.domElement.clientWidth || window.innerWidth;
          if (workshopCameraAngleRef.current === 'arena_3d') {
            viewShiftTarget = 0;
          } else if (dock && dockRightEl && w >= 1024) {
            // Dual left & right customization panels: keep 3D bot centered in the middle!
            viewShiftTarget = 0;
          } else if (dock && w >= 640) {
            const rect = dock.getBoundingClientRect();
            const dockRight = rect.width > 240 ? rect.right : 0;
            viewShiftTarget = -Math.min(w * 0.24, dockRight * 0.46);
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
        }

        // Studio PBR Lighting Rig Presets (Arena, Cyber Neon, Golden Forge, Cryo Lab)
        const lPreset = lightingPresetRef.current;
        if (lPreset === 'cyber_neon') {
          hemiLight.color.setHex(0xe879f9);
          hemiLight.groundColor.setHex(0x0f172a);
          hemiLight.intensity = 1.1;
          keyLight.color.setHex(0x38bdf8);
          keyLight.intensity = 2.6;
          rimLight.color.setHex(0xf43f5e);
          rimLight.intensity = 1.85;
          pedRingMat.color.setHex(0xec4899);
          pedRingMat.emissive.setHex(0xec4899);
        } else if (lPreset === 'golden_forge') {
          hemiLight.color.setHex(0xfde68a);
          hemiLight.groundColor.setHex(0x27170d);
          hemiLight.intensity = 0.95;
          keyLight.color.setHex(0xffb74d);
          keyLight.intensity = 2.85;
          rimLight.color.setHex(0xf97316);
          rimLight.intensity = 1.5;
          pedRingMat.color.setHex(0xf59e0b);
          pedRingMat.emissive.setHex(0xf59e0b);
        } else if (lPreset === 'cryo_lab') {
          hemiLight.color.setHex(0xe0f2fe);
          hemiLight.groundColor.setHex(0x0c1928);
          hemiLight.intensity = 1.15;
          keyLight.color.setHex(0xbae6fd);
          keyLight.intensity = 2.5;
          rimLight.color.setHex(0x38bdf8);
          rimLight.intensity = 1.75;
          pedRingMat.color.setHex(0x38bdf8);
          pedRingMat.emissive.setHex(0x38bdf8);
        } else {
          hemiLight.color.setHex(0xa5d8ff);
          hemiLight.groundColor.setHex(0x1e293b);
          hemiLight.intensity = baseHemi;
          keyLight.color.setHex(0xfff3db);
          keyLight.intensity = baseKey;
          rimLight.color.setHex(0x60a5fa);
          rimLight.intensity = 1.15;
          pedRingMat.color.setHex(0xf59e0b);
          pedRingMat.emissive.setHex(0xf59e0b);
        }

        // Trigger 3D turntable weapon spark burst when requested
        if (weaponTestSignalRef.current !== lastHandledTestBurst) {
          lastHandledTestBurst = weaponTestSignalRef.current;
          effects.spawnSparks(0, 0.62, 0.85, 34, 0xfbbf24, 11);
          effects.spawnFlames(0, 0.52, 0.9, 10, 0, 1, 5.2, 0.9);
          effects.spawnShockwave(0, 0.12, 0, 3.2, 0xf59e0b);
          impactFlashLight.position.set(0, 1.4, 0.9);
          impactFlashLight.color.setHex(0xff9e44);
          impactFlashLight.intensity = 14;
          const primaryWeapon = getBotWeapons(playerConfigRef.current)[0] ?? 'vspinner';
          soundEngine.playImpact(1.3, true, primaryWeapon);
        }

        // Damped 3D Camera Angle Presets in Workshop
        const targetAngle = workshopCameraAngleRef.current;
        if (targetAngle !== 'free') {
          if (targetAngle === 'arena_3d') {
            _camGoal.set(0, 14.5, 22.0);
            _lookGoal.set(0, 0.6, 0);
          } else if (targetAngle === 'hero') {
            _camGoal.set(3.2, 2.1, 3.6);
            _lookGoal.set(0, 0.42, 0);
          } else if (targetAngle === 'low_wedge') {
            _camGoal.set(2.15, 0.72, 2.75);
            _lookGoal.set(0, 0.35, 0.25);
          } else if (targetAngle === 'weapon_macro') {
            _camGoal.set(1.55, 1.15, 2.05);
            _lookGoal.set(0, 0.48, 0.55);
          } else if (targetAngle === 'top_blueprint') {
            _camGoal.set(0.01, 5.4, 0.65);
            _lookGoal.set(0, 0.2, 0);
          }
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoal.x, 6.5, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoal.y, 6.5, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoal.z, 6.5, dt);
          orbit.target.x = THREE.MathUtils.damp(orbit.target.x, _lookGoal.x, 7.5, dt);
          orbit.target.y = THREE.MathUtils.damp(orbit.target.y, _lookGoal.y, 7.5, dt);
          orbit.target.z = THREE.MathUtils.damp(orbit.target.z, _lookGoal.z, 7.5, dt);
          if (camera.position.distanceToSquared(_camGoal) < 0.015 && targetAngle !== 'arena_3d') {
            workshopCameraAngleRef.current = 'free';
            onManualOrbitRef.current?.();
          }
        }

        if (workshopBotRig) {
          workshopBotRig.root.visible = true;
          workshopBotRig.root.rotation.y += dt * 0.42 * turntableSpeedRef.current;
          workshopWeaponAngle += dt * (7.5 + explodedRatioRef.current * 4);

          // Smooth exponential damping for 3D Exploded-View part separation
          currentExploded = THREE.MathUtils.damp(
            currentExploded,
            explodedRatioRef.current,
            7.5,
            dt,
          );
          if (workshopBaseOffsets) {
            const e = currentExploded;
            workshopBotRig.armorPlates.front.position.set(
              workshopBaseOffsets.armorFront.x,
              workshopBaseOffsets.armorFront.y + e * 0.24,
              workshopBaseOffsets.armorFront.z + e * 0.62,
            );
            workshopBotRig.armorPlates.rear.position.set(
              workshopBaseOffsets.armorRear.x,
              workshopBaseOffsets.armorRear.y + e * 0.24,
              workshopBaseOffsets.armorRear.z - e * 0.62,
            );
            workshopBotRig.armorPlates.left.position.set(
              workshopBaseOffsets.armorLeft.x - e * 0.56,
              workshopBaseOffsets.armorLeft.y + e * 0.18,
              workshopBaseOffsets.armorLeft.z,
            );
            workshopBotRig.armorPlates.right.position.set(
              workshopBaseOffsets.armorRight.x + e * 0.56,
              workshopBaseOffsets.armorRight.y + e * 0.18,
              workshopBaseOffsets.armorRight.z,
            );

            workshopBotRig.weaponEntries.forEach((wEntry, idx) => {
              const base = workshopBaseOffsets!.weaponMounts[idx];
              if (!base) return;
              const rx = Math.abs(base.x) > 0.08 ? Math.sign(base.x) * 0.45 : idx === 1 ? -0.35 : idx === 2 ? 0.35 : 0;
              const rz = base.z >= 0 ? 0.55 : -0.45;
              wEntry.mountGroup.position.set(
                base.x + rx * e,
                base.y + (0.42 + idx * 0.14) * e,
                base.z + rz * e,
              );
            });

            workshopBotRig.wheels.forEach((wheel, idx) => {
              const base = workshopBaseOffsets!.wheels[idx];
              if (!base) return;
              const dirX = Math.sign(base.x) || (idx % 2 === 0 ? -1 : 1);
              wheel.position.set(
                base.x + dirX * 0.52 * e,
                base.y - 0.06 * e,
                base.z + Math.sign(base.z) * 0.18 * e,
              );
            });

            if (workshopBotRig.accessoryPivot && workshopBaseOffsets.accessory) {
              workshopBotRig.accessoryPivot.position.set(
                workshopBaseOffsets.accessory.x,
                workshopBaseOffsets.accessory.y + 0.68 * e,
                workshopBaseOffsets.accessory.z,
              );
            }
            if (workshopBotRig.shieldBubble && workshopBaseOffsets.shield) {
              workshopBotRig.shieldBubble.position.set(
                workshopBaseOffsets.shield.x,
                workshopBaseOffsets.shield.y + 0.85 * e,
                workshopBaseOffsets.shield.z,
              );
            }
          }

          for (const entry of workshopBotRig.weaponEntries) {
            const wType = entry.weaponId;
            if (wType === 'vspinner' || wType === 'drum') entry.pivot.rotation.x = workshopWeaponAngle;
            else if (wType === 'hbar') entry.pivot.rotation.y = workshopWeaponAngle;
            else if (wType === 'body_spinner') {
              entry.pivot.rotation.y = workshopWeaponAngle * 1.35;
              entry.secondarySpinners.forEach((s) => {
                s.rotation.y = -workshopWeaponAngle * 0.95;
              });
            } else if (wType === 'sawblade') {
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
          // Sync arena props & hazards (with Color-Blind Mode palette)
          arenaBuilt?.syncDynamicProps(snap.props, elapsed);
          arenaBuilt?.syncHazards(snap.hazards, dt, colorBlindRef.current);

          // Sync bots
          const seenIds = new Set<string>();
          let playerBot = snap.bots[0];
          for (const b of snap.bots) {
            seenIds.add(b.id);
            if (b.id === playerIdRef.current) playerBot = b;

            const botWeapons = getBotWeapons(b.config);
            const botStyles = getBotChassisStyles(b.config);
            const placementKey = JSON.stringify(b.config.weaponPlacements ?? []);
            const cfgKey = `${b.config.name}_${botStyles.join('+')}_${b.config.armor}_${botWeapons.join('+')}_${placementKey}_${b.config.wheelLayout}_${b.config.drive}_${b.config.primaryColor}_${b.config.accentColor}_${b.config.finishStyle || 'standard'}_${b.config.accessory || 'none'}_${b.config.underglowColor || 'none'}_${b.config.pattern || 'solid'}_${b.config.raceNumber ?? ''}`;
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
              dimAdditiveGlow(newRig.root);
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
            if (!b.isDead && (b.isBoosting || b.boostCooldown > 2.05) && Math.random() < 0.72) {
              const bx = -Math.sin(b.yaw);
              const bz = -Math.cos(b.yaw);
              effects.spawnFlames(b.x + bx * 0.95, b.y + 0.42, b.z + bz * 0.95, 1, bx, bz, 4.5, 0.55);
              effects.spawnSmoke(b.x + bx * 1.0, b.y + 0.3, b.z + bz * 1.0, 1, 0.6, 0.35);
            }

            // Drift tire sparks & smoke trail + Mini-Turbo release flash
            if (!b.isDead && b.isDrifting && Math.random() < 0.82) {
              const bx = -Math.sin(b.yaw);
              const bz = -Math.cos(b.yaw);
              const charge = b.driftCharge ?? 0;
              const sparkColor = charge >= 0.75 ? 0x38bdf8 : charge >= 0.35 ? 0xf59e0b : 0xfde68a;
              effects.spawnSparks(b.x + bx * 0.85, 0.12, b.z + bz * 0.85, 3, sparkColor, 5.5);
              effects.spawnSmoke(b.x + bx * 0.9, 0.16, b.z + bz * 0.9, 1, 0.55, 0.45);
            } else if (!b.isDead && (b.driftBoostTimer ?? 0) > 0 && Math.random() < 0.75) {
              const bx = -Math.sin(b.yaw);
              const bz = -Math.cos(b.yaw);
              effects.spawnSparks(b.x + bx * 0.95, 0.25, b.z + bz * 0.95, 4, 0x38bdf8, 7.5);
            }
          }

          // Continuous driving, active weapon, and arena hazard audio for player bot
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
              weapon: audioWeapons[0] ?? 'vspinner',
              weapons: audioWeapons,
              weaponActive: activeSlotWeapons.length > 0,
              weaponSpin: maxSlotSpin,
              boosting: Boolean(playerBot.isBoosting) || playerBot.boostCooldown > 1.8,
              hazards: snap.hazards,
              playerX: playerBot.x,
              playerZ: playerBot.z,
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

          voiceCommentator.syncLiveFightContext(snap, playerIdRef.current);

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
            const sens = THREE.MathUtils.clamp(camSensitivityRef.current ?? 0.65, 0.2, 2.0);
            const isFirstPerson = preset === 'first_person';
            const isPilotBooth = preset === 'pilot_booth';
            const arenaHalf = ARENA_CATALOG[arenaIdRef.current]?.halfSize ?? 18;
            if (isFirstPerson) {
              smoothFollowYaw = playerBot.yaw;
              const fx = Math.sin(playerBot.yaw);
              const fz = Math.cos(playerBot.yaw);
              const hoodDist = 0.58 * playerBot.scale;
              const camHeight = (playerBot.flipped ? 0.48 : 0.95) * playerBot.scale;
              _camGoal.set(
                playerBot.x + fx * hoodDist,
                playerBot.y + camHeight,
                playerBot.z + fz * hoodDist,
              );
              _lookGoal.set(
                playerBot.x + fx * 14,
                playerBot.y + camHeight - 0.22 + Math.sin(playerBot.pitch) * 3.2,
                playerBot.z + fz * 14,
              );
            } else if (isPilotBooth) {
              smoothFollowYaw = playerBot.yaw;
              // Ringside Fan / Driver Booth Perspective right behind the clear South Lexan blast glass
              // Eye-level height (2.15m) looking straight through the glass into the BattleBox at your bot
              const boothX = THREE.MathUtils.clamp(playerBot.x * 0.48, -arenaHalf * 0.65, arenaHalf * 0.65);
              _camGoal.set(boothX, 2.18, arenaHalf + 1.25);
              _lookGoal.set(
                playerBot.x + playerBot.vx * 0.08,
                playerBot.y + 0.52,
                playerBot.z + playerBot.vz * 0.08,
              );
            } else if (preset === 'tactical') {
              _camGoal.set(playerBot.x * 0.55, 22, playerBot.z * 0.55 + 15);
              _lookGoal.set(playerBot.x * 0.5, 0.2, playerBot.z * 0.5);
            } else if (preset === 'spectator') {
              // Dedicated Spectator Camera Mode: cycles between 4 fixed ringside broadcast positions
              // and a top-down tactical view every 5.5s, focusing on active arena events or combat centroid
              const aliveBots = snap.bots.filter((b) => !b.isDead);
              let focusX = playerBot.x;
              let focusZ = playerBot.z;
              if (snap.arenaEvent && snap.arenaEvent.x !== undefined && snap.arenaEvent.z !== undefined) {
                focusX = snap.arenaEvent.x;
                focusZ = snap.arenaEvent.z;
              } else {
                const activeHazard = snap.hazards.find((h) => h.active || h.warning);
                if (activeHazard && activeHazard.kind !== 'saw') {
                  focusX = activeHazard.x * 0.55 + playerBot.x * 0.45;
                  focusZ = activeHazard.z * 0.55 + playerBot.z * 0.45;
                } else if (aliveBots.length > 0) {
                  focusX = aliveBots.reduce((acc, b) => acc + b.x, 0) / aliveBots.length;
                  focusZ = aliveBots.reduce((acc, b) => acc + b.z, 0) / aliveBots.length;
                }
              }
              const stageIdx = Math.floor(elapsed / 5.5) % 5;
              const ringDist = arenaHalf + 0.8;
              if (stageIdx === 0) {
                // Top-Down Tactical Broadcast View
                _camGoal.set(focusX * 0.25, 25.5, focusZ * 0.25 + 6.5);
                _lookGoal.set(focusX * 0.5, 0.2, focusZ * 0.5);
              } else if (stageIdx === 1) {
                // South Ringside Corner Cam
                _camGoal.set(-ringDist * 0.72, 4.2, ringDist * 0.85);
                _lookGoal.set(focusX, 0.55, focusZ);
              } else if (stageIdx === 2) {
                // East Judge Box Cam
                _camGoal.set(ringDist * 0.88, 4.8, 0);
                _lookGoal.set(focusX, 0.5, focusZ);
              } else if (stageIdx === 3) {
                // North Gantry High Cam
                _camGoal.set(ringDist * 0.65, 6.4, -ringDist * 0.82);
                _lookGoal.set(focusX, 0.45, focusZ);
              } else {
                // West Low Ringside Action Cam
                _camGoal.set(-ringDist * 0.88, 3.2, -ringDist * 0.35);
                _lookGoal.set(focusX, 0.55, focusZ);
              }
            } else if (preset === 'cinematic') {
              const orbitA = elapsed * 0.28 * sens;
              _camGoal.set(
                playerBot.x + Math.sin(orbitA) * 10.5,
                6.5,
                playerBot.z + Math.cos(orbitA) * 10.5,
              );
              _lookGoal.set(playerBot.x, 0.5, playerBot.z);
            } else {
              // Chase camera: spring-damped heading that ignores reversing, looks ahead of travel,
              // and widens to keep the nearest rival in frame during a fight
              const speed = Math.hypot(playerBot.vx, playerBot.vz);
              camSpeedSmooth += (speed - camSpeedSmooth) * Math.min(1, dt * 3);
              const fwdX = Math.sin(playerBot.yaw);
              const fwdZ = Math.cos(playerBot.yaw);
              const fwdSpeed = playerBot.vx * fwdX + playerBot.vz * fwdZ;
              // Heading target: facing direction, but when reversing hard keep the old heading
              let headingTarget = playerBot.yaw;
              if (fwdSpeed < -1.2 && smoothFollowYaw !== null) headingTarget = smoothFollowYaw;
              if (smoothFollowYaw === null) {
                smoothFollowYaw = headingTarget;
                camYawVel = 0;
              } else {
                let angleDiff = headingTarget - smoothFollowYaw;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                // Critically damped spring: fast to settle, no overshoot
                const omega = 3.2 + sens * 2.4;
                const accel = omega * omega * angleDiff - 2 * omega * camYawVel;
                camYawVel += accel * dt;
                smoothFollowYaw += camYawVel * dt;
              }
              // Frame the nearest live rival when they are close
              let rival: typeof playerBot | null = null;
              let rivalDist = Infinity;
              for (const b of snap.bots) {
                if (b.id === playerBot.id || b.isDead || b.team === playerBot.team) continue;
                const d = Math.hypot(b.x - playerBot.x, b.z - playerBot.z);
                if (d < rivalDist) {
                  rivalDist = d;
                  rival = b;
                }
              }
              const wantFrame = rival && rivalDist < 10 && !playerBot.isDead ? 1 : 0;
              camFrameMix += (wantFrame - camFrameMix) * Math.min(1, dt * 2.2);
              const backX = -Math.sin(smoothFollowYaw);
              const backZ = -Math.cos(smoothFollowYaw);
              const sc = Math.max(0.8, playerBot.scale);
              const dist = (6.8 + Math.min(2.6, camSpeedSmooth * 0.17) + camFrameMix * Math.min(3, rivalDist * 0.22)) * sc;
              const height = (3.6 + Math.min(1.2, camSpeedSmooth * 0.06) + camFrameMix * 1.1) * sc;
              _camGoal.set(playerBot.x + backX * dist, playerBot.y * 0.5 + height, playerBot.z + backZ * dist);
              // Near a wall the boom would end up behind the blast glass: lift it over instead
              const overshoot = Math.max(Math.abs(_camGoal.x), Math.abs(_camGoal.z)) - (arenaHalf - 1.2);
              if (overshoot > 0) _camGoal.y += overshoot * 1.1;
              // Look ahead along velocity, then blend toward the rival midpoint
              const leadX = playerBot.x + playerBot.vx * 0.3 + Math.sin(smoothFollowYaw) * 1.6;
              const leadZ = playerBot.z + playerBot.vz * 0.3 + Math.cos(smoothFollowYaw) * 1.6;
              const midX = rival ? (playerBot.x + rival.x) * 0.5 : leadX;
              const midZ = rival ? (playerBot.z + rival.z) * 0.5 : leadZ;
              _lookGoal.set(
                leadX + (midX - leadX) * camFrameMix * 0.65,
                0.55 + playerBot.y * 0.6,
                leadZ + (midZ - leadZ) * camFrameMix * 0.65,
              );
            }

            // Clamp camera within arena overhead envelope
            const maxCamBound = isPilotBooth ? arenaHalf + 1.4 : 21;
            _camGoal.x = THREE.MathUtils.clamp(_camGoal.x, -maxCamBound, maxCamBound);
            _camGoal.z = THREE.MathUtils.clamp(_camGoal.z, -maxCamBound, maxCamBound);

            const isChase = !isFirstPerson && !isPilotBooth && preset !== 'tactical' && preset !== 'spectator' && preset !== 'cinematic';
            const posDamp = isFirstPerson ? 14 * sens : isPilotBooth ? 3.8 * sens : isChase ? 5.5 + 3 * sens : 2.6 * sens;
            const lookDamp = isFirstPerson ? 18 * sens : isPilotBooth ? 5.2 * sens : isChase ? 9 + 4 * sens : 3.8 * sens;

            camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoal.x, posDamp, dt);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoal.y, posDamp, dt);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoal.z, posDamp, dt);

            _curLook.x = THREE.MathUtils.damp(_curLook.x, _lookGoal.x, lookDamp, dt);
            _curLook.y = THREE.MathUtils.damp(_curLook.y, _lookGoal.y, lookDamp, dt);
            _curLook.z = THREE.MathUtils.damp(_curLook.z, _lookGoal.z, lookDamp, dt);

            if (screenShake > 0.01) {
              camera.position.x += (Math.random() - 0.5) * screenShake;
              camera.position.y += (Math.random() - 0.5) * screenShake * 0.7;
              screenShake *= Math.exp(-8 * dt);
            }

            camera.lookAt(_curLook);
            // Keep the player's bot in focus; widen the in-focus zone for overhead views
            const focusDist = camera.position.distanceTo(_tmpFocus.set(playerBot.x, playerBot.y + 0.4, playerBot.z));
            postFx?.setFocus(preset === 'tactical' || preset === 'spectator' ? null : focusDist);
          }
        }
      }

      effects.update(dt);
      if (postFx) postFx.render(dt);
      else renderer.render(scene, camera);

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
      resizeObserver?.disconnect();
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
      pedBrandGeo.dispose();
      pedBrandTex.dispose();
      pedBrandMat.dispose();
      pedMat.dispose();
      pedRingMat.dispose();
      envTexture.dispose();
      arenaEnv?.dispose();
      postFx?.dispose();
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

  return (
    <div className="relative w-full h-full select-none">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
};
