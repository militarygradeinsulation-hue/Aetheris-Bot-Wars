import * as THREE from 'three';
import type { ArenaSnapshot, BotPhysicsState, DebrisPiece } from '../shared/types';

interface Beam {
  group: THREE.Group;
  core: THREE.MeshBasicMaterial;
  glow: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

interface BotMarker {
  ring: THREE.Mesh;
  crown: THREE.Mesh | null;
  kind: string;
}

const TEAM_COLORS = {
  player: 0xf59e0b,
  ally: 0x22c55e,
  enemy: 0xef4444,
};

/**
 * Overlay layer for the combat scene: lightning/arc beams, guided missiles,
 * team rings, boss and bounty markers, and the King of the Hill zone.
 */
export class CombatOverlay {
  public readonly group = new THREE.Group();

  private beams: Beam[] = [];
  private missiles = new Map<string, THREE.Group>();
  private debrisMeshes = new Map<string, THREE.Object3D>();
  private beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  private shellGeo = new THREE.SphereGeometry(0.16, 12, 8);
  private shellMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.6, roughness: 0.4, emissive: 0xf97316, emissiveIntensity: 0.6 });
  private tracerGeo = new THREE.SphereGeometry(0.32, 10, 8);
  private tracerMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  private wheelGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.22, 16);
  private hubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.24, 8);
  private plateGeo = new THREE.BoxGeometry(1.25, 0.16, 0.42);
  private bladeGeo = new THREE.BoxGeometry(1.25, 0.09, 0.3);
  private drumGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12);
  private sawGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20);
  private chunkGeo = new THREE.BoxGeometry(0.55, 0.3, 0.6);
  private scrapGeo = new THREE.DodecahedronGeometry(0.17, 0);
  private batteryGeo = new THREE.BoxGeometry(0.5, 0.3, 0.35);
  private rubberMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.9 });
  private steelMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.9, roughness: 0.3 });
  private scorchedMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.6, roughness: 0.7 });
  private batteryMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.3, roughness: 0.5, emissive: 0x713f12, emissiveIntensity: 0.4 });
  private armorMats = new Map<string, THREE.MeshStandardMaterial>();
  private markers = new Map<string, BotMarker>();

  private ringGeo = new THREE.RingGeometry(1.25, 1.45, 40);
  private crownGeo = new THREE.OctahedronGeometry(0.28, 0);
  private missileBodyGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.55, 8);
  private missileNoseGeo = new THREE.ConeGeometry(0.07, 0.18, 8);
  private missileFlameGeo = new THREE.ConeGeometry(0.06, 0.3, 8);
  private missileMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.7, roughness: 0.35 });
  private noseMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.4, roughness: 0.4 });
  private flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 });

  private hillGroup = new THREE.Group();
  private hillRing: THREE.Mesh;
  private hillBeam: THREE.Mesh;
  private hillDisc: THREE.Mesh;
  private hillRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  private hillBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private hillDiscMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false });
  private hillRadius = 0;

  constructor(scene: THREE.Scene) {
    this.ringGeo.rotateX(-Math.PI / 2);
    const ringGeo = new THREE.RingGeometry(0.96, 1.0, 64);
    ringGeo.rotateX(-Math.PI / 2);
    this.hillRing = new THREE.Mesh(ringGeo, this.hillRingMat);
    this.hillRing.position.y = 0.06;
    const beamGeo = new THREE.CylinderGeometry(1, 1, 9, 48, 1, true);
    this.hillBeam = new THREE.Mesh(beamGeo, this.hillBeamMat);
    this.hillBeam.position.y = 4.5;
    const discGeo = new THREE.CircleGeometry(1, 48);
    discGeo.rotateX(-Math.PI / 2);
    this.hillDisc = new THREE.Mesh(discGeo, this.hillDiscMat);
    this.hillDisc.position.y = 0.04;
    this.hillGroup.add(this.hillRing, this.hillBeam, this.hillDisc);
    this.hillGroup.visible = false;
    this.group.add(this.hillGroup);
    scene.add(this.group);
  }

  /** Jagged lightning style beam between two points. */
  addArc(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, color: number, life = 0.18, jag = 0.35) {
    const segs = 9;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const edge = i === 0 || i === segs;
      pts.push(
        new THREE.Vector3(
          x1 + (x2 - x1) * f + (edge ? 0 : (Math.random() - 0.5) * jag),
          y1 + (y2 - y1) * f + (edge ? 0 : (Math.random() - 0.5) * jag),
          z1 + (z2 - z1) * f + (edge ? 0 : (Math.random() - 0.5) * jag),
        ),
      );
    }
    this.pushBeam(pts, color, life, 0.035);
  }

  /** Straight beam (rail slug, lance thrust, magnet tether). */
  addBeam(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, color: number, life = 0.22, width = 0.06) {
    this.pushBeam([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)], color, life, width);
  }

  /** Sky-to-ground strike with forks. */
  addLightning(x: number, z: number) {
    const top = 16;
    let px = x + (Math.random() - 0.5) * 2;
    let pz = z + (Math.random() - 0.5) * 2;
    const pts: THREE.Vector3[] = [new THREE.Vector3(px, top, pz)];
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      px = px + (x - px) * 0.35 + (Math.random() - 0.5) * 1.2 * (1 - f);
      pz = pz + (z - pz) * 0.35 + (Math.random() - 0.5) * 1.2 * (1 - f);
      pts.push(new THREE.Vector3(i === steps ? x : px, top * (1 - f), i === steps ? z : pz));
    }
    this.pushBeam(pts, 0xe0f2fe, 0.35, 0.07);
    for (let k = 0; k < 2; k++) {
      const from = pts[3 + k * 3];
      this.addArc(from.x, from.y, from.z, from.x + (Math.random() - 0.5) * 4, from.y - 3, from.z + (Math.random() - 0.5) * 4, 0x93c5fd, 0.25, 0.8);
    }
  }

  private pushBeam(pts: THREE.Vector3[], color: number, life: number, width = 0.045) {
    const group = new THREE.Group();
    const core = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      _dir.subVectors(b, a);
      const len = _dir.length();
      if (len < 0.001) continue;
      _dir.divideScalar(len);
      const q = new THREE.Quaternion().setFromUnitVectors(_up, _dir);
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const c = new THREE.Mesh(this.beamGeo, core);
      c.position.copy(mid);
      c.quaternion.copy(q);
      c.scale.set(width, len, width);
      const g = new THREE.Mesh(this.beamGeo, glow);
      g.position.copy(mid);
      g.quaternion.copy(q);
      g.scale.set(width * 3.6, len, width * 3.6);
      group.add(g, c);
    }
    this.group.add(group);
    this.beams.push({ group, core, glow, life, maxLife: life });
    if (this.beams.length > 40) {
      const old = this.beams.shift();
      if (old) this.disposeBeam(old);
    }
  }

  private disposeBeam(b: Beam) {
    this.group.remove(b.group);
    b.core.dispose();
    b.glow.dispose();
  }

  private relation(b: BotPhysicsState, playerId: string, playerTeam: number): keyof typeof TEAM_COLORS {
    if (b.id === playerId) return 'player';
    return b.team === playerTeam ? 'ally' : 'enemy';
  }

  sync(snap: ArenaSnapshot | null, playerId: string, dt: number, elapsed: number, showRings: boolean) {
    // Beams fade
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.disposeBeam(b);
        this.beams.splice(i, 1);
      } else {
        const f = Math.min(1, (b.life / b.maxLife) * 1.4);
        b.core.opacity = f;
        b.glow.opacity = 0.55 * f;
      }
    }

    if (!snap) {
      this.clearDynamic();
      return;
    }

    // Missiles
    const seenMissiles = new Set<string>();
    for (const p of snap.projectiles ?? []) {
      seenMissiles.add(p.id);
      let m = this.missiles.get(p.id);
      if (!m && p.kind === 'shell') {
        m = new THREE.Group();
        m.add(new THREE.Mesh(this.shellGeo, this.shellMat), new THREE.Mesh(this.tracerGeo, this.tracerMat));
        m.userData.shell = true;
        this.group.add(m);
        this.missiles.set(p.id, m);
      }
      if (!m) {
        m = new THREE.Group();
        const body = new THREE.Mesh(this.missileBodyGeo, this.missileMat);
        body.rotation.x = Math.PI / 2;
        const nose = new THREE.Mesh(this.missileNoseGeo, this.noseMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.z = 0.36;
        const flame = new THREE.Mesh(this.missileFlameGeo, this.flameMat);
        flame.rotation.x = -Math.PI / 2;
        flame.position.z = -0.42;
        flame.name = 'flame';
        m.add(body, nose, flame);
        this.group.add(m);
        this.missiles.set(p.id, m);
      }
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = Math.atan2(p.vx, p.vz);
      if (m.userData.shell) continue;
      const flame = m.getObjectByName('flame');
      if (flame) flame.scale.setScalar(0.8 + Math.random() * 0.5);
    }
    this.missiles.forEach((m, id) => {
      if (!seenMissiles.has(id)) {
        this.group.remove(m);
        this.missiles.delete(id);
      }
    });

    this.syncDebris(snap.debris ?? []);

    // Team rings, boss and bounty markers
    const player = snap.bots.find((b) => b.id === playerId) ?? snap.bots[0];
    const playerTeam = player?.team ?? 0;
    const multiTeam = new Set(snap.bots.map((b) => b.team)).size > 2 || snap.bots.length > 2;
    const seenBots = new Set<string>();
    for (const b of snap.bots) {
      if (b.isDead) continue;
      const rel = this.relation(b, playerId, playerTeam);
      const wantRing = showRings && (multiTeam || rel === 'player' || b.isBoss || b.isBounty);
      const crownKind = b.isBounty ? 'bounty' : b.isBoss ? 'boss' : 'none';
      if (!wantRing && crownKind === 'none') continue;
      seenBots.add(b.id);
      let mk = this.markers.get(b.id);
      const kind = `${rel}_${crownKind}`;
      if (!mk || mk.kind !== kind) {
        if (mk) this.disposeMarker(mk);
        const ringColor = b.isBounty ? 0xfacc15 : TEAM_COLORS[rel];
        const ring = new THREE.Mesh(
          this.ringGeo,
          new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        let crown: THREE.Mesh | null = null;
        if (crownKind !== 'none') {
          crown = new THREE.Mesh(
            this.crownGeo,
            new THREE.MeshBasicMaterial({ color: crownKind === 'bounty' ? 0xfacc15 : 0xa855f7 }),
          );
          this.group.add(crown);
        }
        this.group.add(ring);
        mk = { ring, crown, kind };
        this.markers.set(b.id, mk);
      }
      mk.ring.visible = wantRing || crownKind !== 'none';
      mk.ring.position.set(b.x, 0.05, b.z);
      const scale = b.isBoss ? 1.5 : 1;
      mk.ring.scale.setScalar(scale * (1 + Math.sin(elapsed * 4) * 0.04));
      if (mk.crown) {
        mk.crown.position.set(b.x, b.y + 2.3 + Math.sin(elapsed * 3) * 0.12, b.z);
        mk.crown.rotation.y = elapsed * 2;
      }
    }
    this.markers.forEach((mk, id) => {
      if (!seenBots.has(id)) {
        this.disposeMarker(mk);
        this.markers.delete(id);
      }
    });

    // Hill zone
    const hill = snap.hill;
    if (hill) {
      this.hillGroup.visible = true;
      this.hillGroup.position.set(hill.x, 0, hill.z);
      if (this.hillRadius !== hill.radius) {
        this.hillRadius = hill.radius;
        this.hillGroup.scale.set(hill.radius, 1, hill.radius);
      }
      const color =
        hill.contested ? 0xf97316 : hill.owner === null ? 0xe2e8f0 : hill.owner === playerTeam ? 0x22c55e : 0xef4444;
      this.hillRingMat.color.setHex(color);
      this.hillBeamMat.color.setHex(color);
      this.hillDiscMat.color.setHex(color);
      this.hillBeamMat.opacity = 0.12 + Math.sin(elapsed * 3) * 0.04;
      this.hillRing.rotation.y = elapsed * 0.4;
    } else {
      this.hillGroup.visible = false;
    }
  }

  private armorMat(color: string) {
    let m = this.armorMats.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), metalness: 0.75, roughness: 0.45 });
      this.armorMats.set(color, m);
    }
    return m;
  }

  private buildDebris(p: DebrisPiece): THREE.Object3D {
    const g = new THREE.Group();
    if (p.kind === 'wheel') {
      const tire = new THREE.Mesh(this.wheelGeo, this.rubberMat);
      const hub = new THREE.Mesh(this.hubGeo, this.steelMat);
      g.add(tire, hub);
    } else if (p.kind === 'armor') {
      g.add(new THREE.Mesh(this.plateGeo, this.armorMat(p.color)));
    } else if (p.kind === 'weapon') {
      const w = p.weapon;
      const geo =
        w === 'drum' ? this.drumGeo : w === 'sawblade' ? this.sawGeo : w === 'vspinner' || w === 'hbar' || w === 'lance' ? this.bladeGeo : this.chunkGeo;
      const mesh = new THREE.Mesh(geo, w === 'vspinner' || w === 'hbar' || w === 'sawblade' ? this.steelMat : this.scorchedMat);
      if (geo === this.drumGeo) mesh.rotation.z = Math.PI / 2;
      g.add(mesh);
    } else if (p.kind === 'battery') {
      g.add(new THREE.Mesh(this.batteryGeo, this.batteryMat));
    } else {
      g.add(new THREE.Mesh(this.scrapGeo, Math.random() < 0.5 ? this.scorchedMat : this.steelMat));
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const sc = p.radius / (p.kind === 'wheel' ? 0.32 : p.kind === 'armor' ? 0.55 : p.kind === 'weapon' ? 0.5 : p.kind === 'battery' ? 0.3 : 0.22);
    g.scale.setScalar(sc);
    return g;
  }

  private syncDebris(list: DebrisPiece[]) {
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      let m = this.debrisMeshes.get(p.id);
      if (!m) {
        m = this.buildDebris(p);
        this.group.add(m);
        this.debrisMeshes.set(p.id, m);
      }
      m.position.set(p.x, p.y, p.z);
      m.rotation.set(p.rx, p.ry, p.rz, 'YXZ');
    }
    this.debrisMeshes.forEach((m, id) => {
      if (!seen.has(id)) {
        this.group.remove(m);
        this.debrisMeshes.delete(id);
      }
    });
  }

  private disposeMarker(mk: BotMarker) {
    this.group.remove(mk.ring);
    (mk.ring.material as THREE.Material).dispose();
    if (mk.crown) {
      this.group.remove(mk.crown);
      (mk.crown.material as THREE.Material).dispose();
    }
  }

  clearDynamic() {
    this.missiles.forEach((m) => this.group.remove(m));
    this.missiles.clear();
    this.markers.forEach((mk) => this.disposeMarker(mk));
    this.markers.clear();
    this.debrisMeshes.forEach((m) => this.group.remove(m));
    this.debrisMeshes.clear();
    this.hillGroup.visible = false;
  }

  dispose() {
    this.clearDynamic();
    this.beams.forEach((b) => this.disposeBeam(b));
    this.beams = [];
    this.group.parent?.remove(this.group);
    [
      this.ringGeo,
      this.crownGeo,
      this.missileBodyGeo,
      this.missileNoseGeo,
      this.missileFlameGeo,
      this.hillRing.geometry,
      this.hillBeam.geometry,
      this.hillDisc.geometry,
      this.beamGeo,
      this.shellGeo,
      this.tracerGeo,
      this.wheelGeo,
      this.hubGeo,
      this.plateGeo,
      this.bladeGeo,
      this.drumGeo,
      this.sawGeo,
      this.chunkGeo,
      this.scrapGeo,
      this.batteryGeo,
    ].forEach((g) => g.dispose());
    [this.shellMat, this.tracerMat, this.rubberMat, this.steelMat, this.scorchedMat, this.batteryMat].forEach((m) => m.dispose());
    this.armorMats.forEach((m) => m.dispose());
    [this.missileMat, this.noseMat, this.flameMat, this.hillRingMat, this.hillBeamMat, this.hillDiscMat].forEach((m) =>
      m.dispose(),
    );
  }
}
