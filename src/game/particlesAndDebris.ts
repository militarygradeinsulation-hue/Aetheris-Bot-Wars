import * as THREE from 'three';

interface SparkParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

interface PuffParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  baseScale: number;
  growRate: number;
  tint: number;
}

interface DebrisChunk {
  mesh: THREE.Mesh;
  active: boolean;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  life: number;
  maxLife: number;
}

interface ShockRing {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  maxRadius: number;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class EffectsManager {
  public readonly group = new THREE.Group();

  private sparkMesh: THREE.InstancedMesh;
  private sparks: SparkParticle[] = [];
  private sparkCursor = 0;
  private readonly maxSparks: number;

  private flameMesh: THREE.InstancedMesh;
  private flames: PuffParticle[] = [];
  private flameCursor = 0;
  private readonly maxFlames: number;

  private smokeMesh: THREE.InstancedMesh;
  private smokes: PuffParticle[] = [];
  private smokeCursor = 0;
  private readonly maxSmokes: number;

  private debris: DebrisChunk[] = [];
  private rings: ShockRing[] = [];
  private sharedDebrisGeo: THREE.BoxGeometry;
  private sharedRingGeo: THREE.RingGeometry;

  constructor(scene: THREE.Scene, lowPower = false) {
    this.maxSparks = lowPower ? 140 : 320;
    this.maxFlames = lowPower ? 64 : 140;
    this.maxSmokes = lowPower ? 64 : 140;

    // 1. Instanced Sparks
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.28);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, this.maxSparks);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < this.maxSparks; i++) {
      this.sparks.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        scale: 1,
        color: new THREE.Color(0xfbbf24),
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.set(0.001, 0.001, 0.001);
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
      this.sparkMesh.setColorAt(i, _color.setHex(0xfbbf24));
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    this.group.add(this.sparkMesh);

    // 2. Instanced Volumetric-style Flames
    const flameGeo = new THREE.DodecahedronGeometry(0.28, 0);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.flameMesh = new THREE.InstancedMesh(flameGeo, flameMat, this.maxFlames);
    this.flameMesh.frustumCulled = false;
    this.flameMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < this.maxFlames; i++) {
      this.flames.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.5,
        baseScale: 1,
        growRate: 1.4,
        tint: 1,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.set(0.001, 0.001, 0.001);
      _dummy.updateMatrix();
      this.flameMesh.setMatrixAt(i, _dummy.matrix);
      this.flameMesh.setColorAt(i, _color.setHex(0xf97316));
    }
    this.flameMesh.instanceMatrix.needsUpdate = true;
    if (this.flameMesh.instanceColor) this.flameMesh.instanceColor.needsUpdate = true;
    this.group.add(this.flameMesh);

    // 3. Instanced Rising Smoke Plumes
    const smokeGeo = new THREE.IcosahedronGeometry(0.34, 1);
    const smokeMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    this.smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, this.maxSmokes);
    this.smokeMesh.frustumCulled = false;
    this.smokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < this.maxSmokes; i++) {
      this.smokes.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1.2,
        baseScale: 1,
        growRate: 2.2,
        tint: 0.3,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.set(0.001, 0.001, 0.001);
      _dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, _dummy.matrix);
      this.smokeMesh.setColorAt(i, _color.setHex(0x334155));
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    if (this.smokeMesh.instanceColor) this.smokeMesh.instanceColor.needsUpdate = true;
    this.group.add(this.smokeMesh);

    // 4. Flying Metal Debris Chunks
    this.sharedDebrisGeo = new THREE.BoxGeometry(0.45, 0.14, 0.45);
    const debrisPoolCount = lowPower ? 24 : 52;
    for (let i = 0; i < debrisPoolCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.35,
        metalness: 0.85,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(this.sharedDebrisGeo, mat);
      mesh.visible = false;
      mesh.castShadow = !lowPower;
      this.group.add(mesh);
      this.debris.push({
        mesh,
        active: false,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        life: 0,
        maxLife: 2.2,
      });
    }

    // 5. Shockwave Rings
    this.sharedRingGeo = new THREE.RingGeometry(0.65, 1.0, 28);
    this.sharedRingGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.sharedRingGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({
        mesh,
        active: false,
        life: 0,
        maxLife: 0.45,
        maxRadius: 5,
      });
    }

    scene.add(this.group);
  }

  public spawnSparks(x: number, y: number, z: number, count = 16, hexColor = 0xfbbf24, speed = 9) {
    for (let i = 0; i < count; i++) {
      const idx = this.sparkCursor;
      const s = this.sparks[idx];
      this.sparkCursor = (this.sparkCursor + 1) % this.maxSparks;
      s.active = true;
      s.x = x;
      s.y = y;
      s.z = z;
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.9) * speed;
      s.vx = Math.cos(angle) * spd;
      s.vy = 2.6 + Math.random() * speed * 0.78;
      s.vz = Math.sin(angle) * spd;
      s.maxLife = 0.25 + Math.random() * 0.38;
      s.life = s.maxLife;
      s.scale = 0.7 + Math.random() * 0.9;
      s.color.setHex(hexColor);
      this.sparkMesh.setColorAt(idx, s.color);
    }
    if (this.sparkMesh.instanceColor) {
      this.sparkMesh.instanceColor.needsUpdate = true;
    }
  }

  public spawnFlames(
    x: number,
    y: number,
    z: number,
    count = 8,
    dirX = 0,
    dirZ = 0,
    speed = 5,
    scale = 1.0,
  ) {
    const hasDir = Math.hypot(dirX, dirZ) > 0.1;
    for (let i = 0; i < count; i++) {
      const idx = this.flameCursor;
      const f = this.flames[idx];
      this.flameCursor = (this.flameCursor + 1) % this.maxFlames;
      f.active = true;
      f.x = x + (Math.random() - 0.5) * 0.35;
      f.y = y + (Math.random() - 0.5) * 0.2;
      f.z = z + (Math.random() - 0.5) * 0.35;

      if (hasDir) {
        const spread = 0.32;
        const spd = speed * (0.65 + Math.random() * 0.55);
        f.vx = dirX * spd + (Math.random() - 0.5) * spread * speed;
        f.vy = 0.8 + Math.random() * 1.9;
        f.vz = dirZ * spd + (Math.random() - 0.5) * spread * speed;
      } else {
        const a = Math.random() * Math.PI * 2;
        const spd = (0.4 + Math.random() * 0.8) * speed;
        f.vx = Math.cos(a) * spd;
        f.vy = 1.8 + Math.random() * 3.4;
        f.vz = Math.sin(a) * spd;
      }
      f.maxLife = 0.28 + Math.random() * 0.26;
      f.life = f.maxLife;
      f.baseScale = scale * (0.65 + Math.random() * 0.55);
      f.growRate = 1.3;
      f.tint = Math.random();
    }
  }

  public spawnSmoke(
    x: number,
    y: number,
    z: number,
    count = 6,
    scale = 1.0,
    darkness = 0.22,
  ) {
    for (let i = 0; i < count; i++) {
      const idx = this.smokeCursor;
      const sm = this.smokes[idx];
      this.smokeCursor = (this.smokeCursor + 1) % this.maxSmokes;
      sm.active = true;
      sm.x = x + (Math.random() - 0.5) * 0.5;
      sm.y = y + Math.random() * 0.25;
      sm.z = z + (Math.random() - 0.5) * 0.5;
      const a = Math.random() * Math.PI * 2;
      const spd = 0.5 + Math.random() * 1.6;
      sm.vx = Math.cos(a) * spd;
      sm.vy = 1.5 + Math.random() * 2.2;
      sm.vz = Math.sin(a) * spd;
      sm.maxLife = 0.75 + Math.random() * 0.7;
      sm.life = sm.maxLife;
      sm.baseScale = scale * (0.6 + Math.random() * 0.55);
      sm.growRate = 2.1;
      sm.tint = darkness + Math.random() * 0.16;
      _color.setRGB(sm.tint, sm.tint * 1.02, sm.tint * 1.08);
      this.smokeMesh.setColorAt(idx, _color);
    }
    if (this.smokeMesh.instanceColor) {
      this.smokeMesh.instanceColor.needsUpdate = true;
    }
  }

  public spawnDebris(x: number, y: number, z: number, count = 5, colorHex = '#64748b', scale = 1.0) {
    let spawned = 0;
    for (const d of this.debris) {
      if (d.active) continue;
      d.active = true;
      d.mesh.visible = true;
      d.mesh.position.set(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5);
      d.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      d.mesh.scale.setScalar(scale * (0.7 + Math.random() * 0.6));
      const mat = d.mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(colorHex);
      mat.opacity = 1;

      const angle = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * 7;
      d.vx = Math.cos(angle) * spd;
      d.vy = 4.5 + Math.random() * 6.5;
      d.vz = Math.sin(angle) * spd;
      d.rx = (Math.random() - 0.5) * 12;
      d.ry = (Math.random() - 0.5) * 12;
      d.rz = (Math.random() - 0.5) * 12;
      d.maxLife = 1.8 + Math.random() * 0.9;
      d.life = d.maxLife;

      spawned++;
      if (spawned >= count) break;
    }
  }

  public spawnShockwave(x: number, y: number, z: number, maxRadius = 5.5, hexColor = 0xf59e0b) {
    for (const r of this.rings) {
      if (r.active) continue;
      r.active = true;
      r.life = r.maxLife;
      r.maxRadius = maxRadius;
      r.mesh.visible = true;
      r.mesh.position.set(x, Math.max(0.05, y), z);
      r.mesh.scale.setScalar(0.3);
      const mat = r.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(hexColor);
      mat.opacity = 0.9;
      break;
    }
  }

  public update(dt: number) {
    // 1. Update Sparks
    let anySparkChanged = false;
    for (let i = 0; i < this.maxSparks; i++) {
      const s = this.sparks[i];
      if (!s.active) continue;
      anySparkChanged = true;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.updateMatrix();
        this.sparkMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      s.vy -= 24 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      if (s.y < 0.05) {
        s.y = 0.05;
        s.vy = Math.abs(s.vy) * 0.45;
      }

      const lifeRatio = s.life / s.maxLife;
      _dummy.position.set(s.x, s.y, s.z);
      _dummy.lookAt(s.x + s.vx, s.y + s.vy, s.z + s.vz);
      _dummy.scale.set(s.scale * lifeRatio, s.scale * lifeRatio, s.scale * (0.7 + lifeRatio));
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
    }
    if (anySparkChanged) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
    }

    // 2. Update Flames
    let anyFlameChanged = false;
    for (let i = 0; i < this.maxFlames; i++) {
      const f = this.flames[i];
      if (!f.active) continue;
      anyFlameChanged = true;
      f.life -= dt;
      if (f.life <= 0) {
        f.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.updateMatrix();
        this.flameMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      f.vy += 2.2 * dt;
      f.vx *= Math.exp(-2.8 * dt);
      f.vz *= Math.exp(-2.8 * dt);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;

      const p = 1 - f.life / f.maxLife;
      const sc = f.baseScale * (0.7 + p * f.growRate) * (1 - p * 0.55);
      _dummy.position.set(f.x, f.y, f.z);
      _dummy.rotation.set(p * 3.1, f.tint * 6.2, p * 2.4);
      _dummy.scale.setScalar(Math.max(0.01, sc));
      _dummy.updateMatrix();
      this.flameMesh.setMatrixAt(i, _dummy.matrix);

      // Hot yellow-white core fading to orange and crimson ember
      if (p < 0.35) {
        _color.setRGB(1.0, 0.88 - p * 0.8, 0.35 - p * 0.8);
      } else {
        _color.setRGB(0.98 - p * 0.35, 0.45 * (1 - p), 0.05);
      }
      this.flameMesh.setColorAt(i, _color);
    }
    if (anyFlameChanged) {
      this.flameMesh.instanceMatrix.needsUpdate = true;
      if (this.flameMesh.instanceColor) this.flameMesh.instanceColor.needsUpdate = true;
    }

    // 3. Update Smoke Plumes
    let anySmokeChanged = false;
    for (let i = 0; i < this.maxSmokes; i++) {
      const sm = this.smokes[i];
      if (!sm.active) continue;
      anySmokeChanged = true;
      sm.life -= dt;
      if (sm.life <= 0) {
        sm.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.updateMatrix();
        this.smokeMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      sm.vx *= Math.exp(-1.5 * dt);
      sm.vz *= Math.exp(-1.5 * dt);
      sm.x += sm.vx * dt;
      sm.y += sm.vy * dt;
      sm.z += sm.vz * dt;

      const p = 1 - sm.life / sm.maxLife;
      const fadeOut = p > 0.6 ? Math.max(0.01, 1 - (p - 0.6) / 0.4) : 1;
      const sc = sm.baseScale * (0.7 + p * sm.growRate) * fadeOut;
      _dummy.position.set(sm.x, sm.y, sm.z);
      _dummy.rotation.set(p * 1.5, sm.tint * 4.0, p * 1.1);
      _dummy.scale.setScalar(Math.max(0.01, sc));
      _dummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, _dummy.matrix);
    }
    if (anySmokeChanged) {
      this.smokeMesh.instanceMatrix.needsUpdate = true;
    }

    // 4. Update Metal Debris
    for (const d of this.debris) {
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      d.vy -= 26 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.x += d.rx * dt;
      d.mesh.rotation.y += d.ry * dt;
      d.mesh.rotation.z += d.rz * dt;
      if (d.mesh.position.y < 0.09) {
        d.mesh.position.y = 0.09;
        d.vy = Math.abs(d.vy) * 0.4;
        d.vx *= 0.72;
        d.vz *= 0.72;
        d.rx *= 0.6;
        d.ry *= 0.6;
        d.rz *= 0.6;
      }
      if (d.life < 0.5) {
        (d.mesh.material as THREE.MeshStandardMaterial).opacity = d.life / 0.5;
      }
    }

    // 5. Update Shockwave Rings
    for (const r of this.rings) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const p = 1 - r.life / r.maxLife;
      const scale = 0.4 + p * r.maxRadius;
      r.mesh.scale.setScalar(scale);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.85;
    }
  }

  public dispose() {
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.flameMesh.geometry.dispose();
    (this.flameMesh.material as THREE.Material).dispose();
    this.smokeMesh.geometry.dispose();
    (this.smokeMesh.material as THREE.Material).dispose();
    this.sharedDebrisGeo.dispose();
    for (const d of this.debris) {
      (d.mesh.material as THREE.Material).dispose();
    }
    this.sharedRingGeo.dispose();
    for (const r of this.rings) {
      (r.mesh.material as THREE.Material).dispose();
    }
  }
}
