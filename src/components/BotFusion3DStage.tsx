import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  computeBotStats,
  DEFAULT_SKILLS,
  type BotConfig,
} from '../shared/types';
import { buildBotRig, type BuiltBotRig } from '../game/botBuilder';
import { createProceduralTextures } from '../game/materials';
import { soundEngine } from '../game/soundEngine';

export interface BotFusion3DStageProps {
  botA: BotConfig;
  botB: BotConfig;
  fusedBot: BotConfig;
  fusionTriggerSignal: number;
  onFusionAnimationComplete?: () => void;
}

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

export const BotFusion3DStage: React.FC<BotFusion3DStageProps> = ({
  botA,
  botB,
  fusedBot,
  fusionTriggerSignal,
  onFusionAnimationComplete,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [animPhaseLabel, setAnimPhaseLabel] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'side_by_side' | 'merged_focus'>('side_by_side');

  const botARef = useRef(botA);
  const botBRef = useRef(botB);
  const fusedBotRef = useRef(fusedBot);
  const viewModeRef = useRef(viewMode);
  const onCompleteRef = useRef(onFusionAnimationComplete);

  botARef.current = botA;
  botBRef.current = botB;
  fusedBotRef.current = fusedBot;
  viewModeRef.current = viewMode;
  onCompleteRef.current = onFusionAnimationComplete;

  const rebuildBotsRef = useRef<(() => void) | null>(null);
  const triggerMergeAnimRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    rebuildBotsRef.current?.();
  }, [botA, botB, fusedBot]);

  useEffect(() => {
    if (fusionTriggerSignal > 0) {
      triggerMergeAnimRef.current?.();
    }
  }, [fusionTriggerSignal]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 300;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.045);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.2, 60);
    camera.position.set(0, 3.1, 7.6);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = !isSoftwareGl;
    orbit.dampingFactor = 0.07;
    orbit.minDistance = 3.2;
    orbit.maxDistance = 11.5;
    orbit.maxPolarAngle = Math.PI * 0.47;
    orbit.minPolarAngle = 0.2;
    orbit.target.set(0, 0.55, 0);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xc4b5fd, 0x0f172a, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.4);
    keyLight.position.set(8, 14, 9);
    scene.add(keyLight);

    const rimLeft = new THREE.PointLight(0xf59e0b, 3.2, 12);
    rimLeft.position.set(-4.2, 2.6, -2.0);
    scene.add(rimLeft);

    const rimRight = new THREE.PointLight(0x38bdf8, 3.2, 12);
    rimRight.position.set(4.2, 2.6, -2.0);
    scene.add(rimRight);

    const fusionCoreLight = new THREE.PointLight(0xe879f9, 1.5, 16);
    fusionCoreLight.position.set(0, 1.4, 0.2);
    scene.add(fusionCoreLight);

    // Studio Floor Grid & Three Pedestals (Donor A Left, Fused Center, Donor B Right)
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];

    const floorGeo = new THREE.PlaneGeometry(36, 24);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f141e,
      roughness: 0.35,
      metalness: 0.75,
    });
    geometries.push(floorGeo);
    materials.push(floorMat);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -0.18;
    scene.add(floorMesh);

    const pedGeo = new THREE.CylinderGeometry(1.38, 1.55, 0.16, 32);
    const pedCenterGeo = new THREE.CylinderGeometry(1.62, 1.82, 0.2, 36);
    const ringGeo = new THREE.TorusGeometry(1.42, 0.035, 8, 48);
    ringGeo.rotateX(Math.PI / 2);
    const centerRingGeo = new THREE.TorusGeometry(1.66, 0.045, 10, 56);
    centerRingGeo.rotateX(Math.PI / 2);
    geometries.push(pedGeo, pedCenterGeo, ringGeo, centerRingGeo);

    const pedBaseMat = new THREE.MeshStandardMaterial({
      color: 0x171e2b,
      roughness: 0.4,
      metalness: 0.82,
    });
    const ringMatA = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.1,
    });
    const ringMatB = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.1,
    });
    const ringMatCenter = new THREE.MeshStandardMaterial({
      color: 0xe879f9,
      emissive: 0xe879f9,
      emissiveIntensity: 1.35,
    });
    materials.push(pedBaseMat, ringMatA, ringMatB, ringMatCenter);

    const pedLeft = new THREE.Group();
    pedLeft.position.set(-2.95, -0.09, 0.15);
    const pedLeftMesh = new THREE.Mesh(pedGeo, pedBaseMat);
    const pedLeftRing = new THREE.Mesh(ringGeo, ringMatA);
    pedLeftRing.position.y = 0.09;
    pedLeft.add(pedLeftMesh, pedLeftRing);
    scene.add(pedLeft);

    const pedRight = new THREE.Group();
    pedRight.position.set(2.95, -0.09, 0.15);
    const pedRightMesh = new THREE.Mesh(pedGeo, pedBaseMat);
    const pedRightRing = new THREE.Mesh(ringGeo, ringMatB);
    pedRightRing.position.y = 0.09;
    pedRight.add(pedRightMesh, pedRightRing);
    scene.add(pedRight);

    const pedCenter = new THREE.Group();
    pedCenter.position.set(0, -0.08, -0.35);
    const pedCenterMesh = new THREE.Mesh(pedCenterGeo, pedBaseMat);
    const pedCenterRing = new THREE.Mesh(centerRingGeo, ringMatCenter);
    pedCenterRing.position.y = 0.11;
    pedCenter.add(pedCenterMesh, pedCenterRing);
    scene.add(pedCenter);

    // Energy Conduit Rings & Core Flash Sphere for the 3D Fusion Animation
    const shockRingGeo = new THREE.TorusGeometry(0.65, 0.045, 10, 48);
    shockRingGeo.rotateX(Math.PI / 2);
    const shockRingMat = new THREE.MeshBasicMaterial({
      color: 0xf0abfc,
      transparent: true,
      opacity: 0,
    });
    const shockRingMesh = new THREE.Mesh(shockRingGeo, shockRingMat);
    shockRingMesh.position.set(0, 0.65, -0.15);
    scene.add(shockRingMesh);

    const flashSphereGeo = new THREE.SphereGeometry(0.65, 24, 18);
    const flashSphereMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
    });
    const flashSphere = new THREE.Mesh(flashSphereGeo, flashSphereMat);
    flashSphere.position.set(0, 0.72, -0.15);
    scene.add(flashSphere);

    // 3D Spark Particles for Fusion Vortex
    const sparkCount = 48;
    const sparkGeo = new THREE.BoxGeometry(0.07, 0.07, 0.22);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0,
    });
    geometries.push(shockRingGeo, flashSphereGeo, sparkGeo);
    materials.push(shockRingMat, flashSphereMat, sparkMat);

    const sparkInst = new THREE.InstancedMesh(sparkGeo, sparkMat, sparkCount);
    sparkInst.visible = false;
    scene.add(sparkInst);
    const sparkDummy = new THREE.Object3D();

    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const textures = createProceduralTextures(maxAnisotropy, 'aether_nexus');

    let rigA: BuiltBotRig | null = null;
    let rigB: BuiltBotRig | null = null;
    let rigFused: BuiltBotRig | null = null;

    let scaleA = 1;
    let scaleB = 1;
    let scaleFused = 1;

    const rebuildAllBots = () => {
      if (rigA) {
        scene.remove(rigA.root);
        rigA.dispose();
      }
      if (rigB) {
        scene.remove(rigB.root);
        rigB.dispose();
      }
      if (rigFused) {
        scene.remove(rigFused.root);
        rigFused.dispose();
      }

      rigA = buildBotRig(
        botARef.current,
        textures.armorWeave,
        textures.contactShadow,
        !isSoftwareGl,
        textures.metalBrushBump,
      );
      scaleA = computeBotStats(botARef.current, DEFAULT_SKILLS).bodyScale * 0.92;
      rigA.root.scale.setScalar(scaleA);
      rigA.root.position.set(-2.95, 0, 0.15);
      rigA.root.rotation.y = 0.42;
      scene.add(rigA.root);

      rigB = buildBotRig(
        botBRef.current,
        textures.armorWeave,
        textures.contactShadow,
        !isSoftwareGl,
        textures.metalBrushBump,
      );
      scaleB = computeBotStats(botBRef.current, DEFAULT_SKILLS).bodyScale * 0.92;
      rigB.root.scale.setScalar(scaleB);
      rigB.root.position.set(2.95, 0, 0.15);
      rigB.root.rotation.y = -0.42;
      scene.add(rigB.root);

      rigFused = buildBotRig(
        fusedBotRef.current,
        textures.armorWeave,
        textures.contactShadow,
        !isSoftwareGl,
        textures.metalBrushBump,
      );
      scaleFused = computeBotStats(fusedBotRef.current, DEFAULT_SKILLS).bodyScale * 1.02;
      rigFused.root.scale.setScalar(scaleFused);
      rigFused.root.position.set(0, 0.02, -0.35);
      scene.add(rigFused.root);
    };

    rebuildBotsRef.current = rebuildAllBots;
    rebuildAllBots();

    // Animation state
    let mergeAnimActive = false;
    let mergeAnimElapsed = 0;
    const MERGE_DURATION = 2.65;
    let stageSoundPlayed = 0;

    triggerMergeAnimRef.current = () => {
      mergeAnimActive = true;
      mergeAnimElapsed = 0;
      stageSoundPlayed = 0;
      setAnimPhaseLabel('PHASE 1 · ENERGIZING DONOR CORES...');
      soundEngine.unlock();
      soundEngine.playZap(0.9);
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const spinRigWeapons = (rig: BuiltBotRig | null, speedMult: number, dt: number, elapsed: number) => {
      if (!rig) return;
      for (const entry of rig.weaponEntries) {
        if (
          entry.weaponId === 'hbar' ||
          entry.weaponId === 'body_spinner' ||
          entry.weaponId === 'vspinner' ||
          entry.weaponId === 'sawblade' ||
          entry.weaponId === 'drum'
        ) {
          if (entry.weaponId === 'hbar' || entry.weaponId === 'body_spinner') {
            entry.pivot.rotation.y += dt * 14 * speedMult;
          } else {
            entry.pivot.rotation.x += dt * 16 * speedMult;
          }
        }
        for (const sec of entry.secondarySpinners) {
          sec.rotation.y += dt * 12 * speedMult;
        }
      }
      for (let i = 0; i < rig.wheels.length; i++) {
        rig.wheels[i].rotation.x += dt * 2.5 * speedMult;
      }
      if (rig.isHover) {
        rig.bodyPivot.position.y = Math.sin(elapsed * 4) * 0.04;
      }
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      if (mergeAnimActive && rigA && rigB && rigFused) {
        mergeAnimElapsed += dt;
        const p = Math.min(1, mergeAnimElapsed / MERGE_DURATION);

        if (p < 0.32) {
          // Phase 1: Donor A & B rev weapons, levitate off pedestals, and face each other
          const k = p / 0.32;
          const ease = k * k * (3 - 2 * k);
          rigA.root.visible = true;
          rigB.root.visible = true;
          rigFused.root.visible = false;

          rigA.root.position.set(-2.95 + ease * 0.45, ease * 0.72, 0.15 - ease * 0.2);
          rigB.root.position.set(2.95 - ease * 0.45, ease * 0.72, 0.15 - ease * 0.2);
          rigA.root.rotation.y = 0.42 + ease * (Math.PI * 0.5 - 0.42);
          rigB.root.rotation.y = -0.42 + ease * (-Math.PI * 0.5 + 0.42);
          rigA.root.rotation.z = -ease * 0.14;
          rigB.root.rotation.z = ease * 0.14;
          rigA.root.scale.setScalar(scaleA);
          rigB.root.scale.setScalar(scaleB);

          fusionCoreLight.intensity = 2.0 + ease * 6.0;
          shockRingMat.opacity = ease * 0.75;
          shockRingMesh.scale.setScalar(0.8 + Math.sin(elapsed * 18) * 0.15);
          flashSphereMat.opacity = ease * 0.25;
          flashSphere.scale.setScalar(0.35 + ease * 0.35);

          spinRigWeapons(rigA, 2.8, dt, elapsed);
          spinRigWeapons(rigB, 2.8, dt, elapsed);
        } else if (p < 0.66) {
          // Phase 2: Spiral inward & collide in a high-energy plasma vortex
          if (stageSoundPlayed < 1) {
            stageSoundPlayed = 1;
            setAnimPhaseLabel('PHASE 2 · QUANTUM CHASSIS CONVERGENCE!');
            soundEngine.playZap(1.2);
          }
          const k = (p - 0.32) / 0.34;
          const easeIn = k * k;
          const radius = (1 - easeIn) * 2.5;
          const vortexAngle = easeIn * Math.PI * 3.5;

          rigA.root.visible = true;
          rigB.root.visible = true;
          rigFused.root.visible = false;

          rigA.root.position.set(
            -Math.cos(vortexAngle) * radius,
            0.72 + Math.sin(k * Math.PI) * 0.35,
            -0.05 + Math.sin(vortexAngle) * radius * 0.45,
          );
          rigB.root.position.set(
            Math.cos(vortexAngle) * radius,
            0.72 + Math.sin(k * Math.PI) * 0.35,
            -0.05 - Math.sin(vortexAngle) * radius * 0.45,
          );
          rigA.root.rotation.y = vortexAngle + Math.PI * 0.5;
          rigB.root.rotation.y = vortexAngle - Math.PI * 0.5;
          rigA.root.scale.setScalar(scaleA * (1 - easeIn * 0.55));
          rigB.root.scale.setScalar(scaleB * (1 - easeIn * 0.55));

          // Vortex sparks
          sparkInst.visible = true;
          sparkMat.opacity = 0.95;
          for (let i = 0; i < sparkCount; i++) {
            const a = (i / sparkCount) * Math.PI * 2 + elapsed * 10;
            const r = (0.25 + ((i * 17) % 10) * 0.18) * (1 - easeIn * 0.45);
            const sy = 0.35 + ((i * 13) % 11) * 0.09;
            sparkDummy.position.set(Math.cos(a) * r, sy, -0.15 + Math.sin(a) * r);
            sparkDummy.rotation.set(0, -a, 0);
            sparkDummy.updateMatrix();
            sparkInst.setMatrixAt(i, sparkDummy.matrix);
          }
          sparkInst.instanceMatrix.needsUpdate = true;

          fusionCoreLight.intensity = 8 + easeIn * 18;
          shockRingMat.opacity = 0.9;
          shockRingMesh.scale.setScalar(0.6 + k * 2.4);
          flashSphereMat.opacity = 0.3 + easeIn * 0.7;
          flashSphere.scale.setScalar(0.6 + easeIn * 1.6);

          spinRigWeapons(rigA, 4.2, dt, elapsed);
          spinRigWeapons(rigB, 4.2, dt, elapsed);
        } else {
          // Phase 3: Supernova flash & Fused Hybrid Warbot emerges on center pedestal
          if (stageSoundPlayed < 2) {
            stageSoundPlayed = 2;
            setAnimPhaseLabel('PHASE 3 · HYBRID WARBOT FORGED!');
            soundEngine.playImpact(1.45, true);
            soundEngine.playCrowdCheer(0.85);
          }
          const k = (p - 0.66) / 0.34;
          const easeOut = 1 - Math.pow(1 - k, 3);

          // Donor bots return gracefully to their side turntables while the Fused Bot takes center stage
          rigA.root.visible = viewModeRef.current === 'side_by_side';
          rigB.root.visible = viewModeRef.current === 'side_by_side';
          rigA.root.position.set(-2.95, 0, 0.15);
          rigB.root.position.set(2.95, 0, 0.15);
          rigA.root.rotation.set(0, 0.42, 0);
          rigB.root.rotation.set(0, -0.42, 0);
          rigA.root.scale.setScalar(scaleA * easeOut);
          rigB.root.scale.setScalar(scaleB * easeOut);

          rigFused.root.visible = true;
          rigFused.root.position.set(0, (1 - easeOut) * 0.85 + 0.02, -0.35);
          rigFused.root.rotation.y = (1 - easeOut) * Math.PI * 1.5 + elapsed * 0.55;
          rigFused.root.scale.setScalar(scaleFused * (0.45 + easeOut * 0.55));

          // Expanding celebratory shockwave & sparks
          sparkInst.visible = k < 0.85;
          sparkMat.opacity = Math.max(0, 1 - k * 1.2);
          for (let i = 0; i < sparkCount; i++) {
            const a = (i / sparkCount) * Math.PI * 2;
            const r = 0.5 + easeOut * (2.6 + (i % 5) * 0.45);
            const sy = 0.75 + Math.sin(k * Math.PI) * (0.8 + (i % 4) * 0.25) - k * 0.5;
            sparkDummy.position.set(Math.cos(a) * r, Math.max(0.05, sy), -0.25 + Math.sin(a) * r);
            sparkDummy.rotation.set(0, -a, 0);
            sparkDummy.updateMatrix();
            sparkInst.setMatrixAt(i, sparkDummy.matrix);
          }
          sparkInst.instanceMatrix.needsUpdate = true;

          fusionCoreLight.intensity = 24 * (1 - easeOut) + 2.5;
          shockRingMat.opacity = Math.max(0, (1 - k) * 0.95);
          shockRingMesh.scale.setScalar(1.2 + easeOut * 4.2);
          flashSphereMat.opacity = Math.max(0, (1 - k * 1.65) * 0.95);
          flashSphere.scale.setScalar(1.8 + easeOut * 2.2);

          spinRigWeapons(rigFused, 2.5, dt, elapsed);

          if (p >= 1) {
            mergeAnimActive = false;
            sparkInst.visible = false;
            shockRingMat.opacity = 0;
            flashSphereMat.opacity = 0;
            fusionCoreLight.intensity = 2.0;
            setAnimPhaseLabel(null);
            onCompleteRef.current?.();
          }
        }
      } else {
        // Idle 3D showcase: Side-by-side Donor A (left), Fused Hybrid (center), Donor B (right)
        const showDonors = viewModeRef.current === 'side_by_side';
        pedLeft.visible = showDonors;
        pedRight.visible = showDonors;

        if (rigA) {
          rigA.root.visible = showDonors;
          rigA.root.position.set(-2.95, 0, 0.15);
          rigA.root.rotation.set(0, 0.35 + Math.sin(elapsed * 0.7) * 0.35, 0);
          rigA.root.scale.setScalar(scaleA);
          spinRigWeapons(rigA, 1.0, dt, elapsed);
        }
        if (rigB) {
          rigB.root.visible = showDonors;
          rigB.root.position.set(2.95, 0, 0.15);
          rigB.root.rotation.set(0, -0.35 - Math.sin(elapsed * 0.7) * 0.35, 0);
          rigB.root.scale.setScalar(scaleB);
          spinRigWeapons(rigB, 1.0, dt, elapsed);
        }
        if (rigFused) {
          rigFused.root.visible = true;
          rigFused.root.position.set(0, 0.02, -0.35);
          rigFused.root.rotation.set(0, elapsed * 0.55, 0);
          rigFused.root.scale.setScalar(scaleFused);
          spinRigWeapons(rigFused, 1.35, dt, elapsed);
        }
      }

      orbit.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      orbit.dispose();
      rigA?.dispose();
      rigB?.dispose();
      rigFused?.dispose();
      textures.dispose();
      envTexture.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[270px] sm:h-[320px] rounded-2xl border border-fuchsia-500/45 bg-[#0B0F17] overflow-hidden shadow-2xl">
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Top 3D Stage Labels for Donor A, Fused Hybrid, and Donor B */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 sm:p-3">
        {viewMode === 'side_by_side' ? (
          <div className="rounded-xl border border-amber-500/50 bg-[#0D1118]/90 px-2.5 py-1 text-left shadow">
            <div className="text-[9px] font-mono uppercase tracking-wider text-amber-300 font-bold">
              LEFT · DONOR BOT A
            </div>
            <div className="text-xs font-extrabold text-white truncate max-w-[130px] sm:max-w-[170px]">
              {botA.name}
            </div>
          </div>
        ) : (
          <div />
        )}

        <div className="rounded-xl border border-fuchsia-400/70 bg-[#181024]/92 px-3 py-1 text-center shadow-lg">
          <div className="text-[9px] font-mono uppercase tracking-wider text-fuchsia-300 font-extrabold">
            {animPhaseLabel || 'CENTER · MERGED HYBRID 3D WARBOT'}
          </div>
          <div className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[180px] sm:max-w-[230px]">
            {fusedBot.name}
          </div>
        </div>

        {viewMode === 'side_by_side' ? (
          <div className="rounded-xl border border-sky-500/50 bg-[#0D1118]/90 px-2.5 py-1 text-right shadow">
            <div className="text-[9px] font-mono uppercase tracking-wider text-sky-300 font-bold">
              RIGHT · DONOR BOT B
            </div>
            <div className="text-xs font-extrabold text-white truncate max-w-[130px] sm:max-w-[170px]">
              {botB.name}
            </div>
          </div>
        ) : (
          <div />
        )}
      </div>

      {/* Bottom Interactive Controls on the 3D Fusion Stage */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-[#090C12]/95 via-[#090C12]/70 to-transparent px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('side_by_side')}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
              viewMode === 'side_by_side'
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : 'border-slate-700 bg-[#12161E]/90 text-slate-300 hover:text-white'
            }`}
          >
            Side-by-Side 3D Trio
          </button>
          <button
            type="button"
            onClick={() => setViewMode('merged_focus')}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
              viewMode === 'merged_focus'
                ? 'border-fuchsia-400 bg-fuchsia-500/25 text-fuchsia-200'
                : 'border-slate-700 bg-[#12161E]/90 text-slate-300 hover:text-white'
            }`}
          >
            Solo Merged Bot
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] font-mono text-slate-400">
            Drag to orbit 3D · Scroll to zoom
          </span>
          <button
            type="button"
            onClick={() => triggerMergeAnimRef.current?.()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-fuchsia-500 to-sky-500 px-3 py-1.5 text-xs font-extrabold text-slate-950 shadow-lg hover:brightness-110 transition cursor-pointer"
          >
            <span>⚡ Animate 3D Fusion Merge</span>
          </button>
        </div>
      </div>
    </div>
  );
};
