import * as THREE from 'three';

/**
 * Builds an HDR reflection/lighting environment that looks like the inside of a
 * lit arena: dark bowl, a ring of very bright truss floodlights, LED fascia bands
 * in the arena color, and a soft overhead light grid. Metal picks up these shapes
 * the way real armor reflects a stadium lighting rig.
 */
export function buildArenaEnvMap(renderer: THREE.WebGLRenderer, accentHex: string, skyHex: string): THREE.Texture {
  const scene = new THREE.Scene();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const add = (geo: THREE.BufferGeometry, color: THREE.Color, pos: THREE.Vector3, look?: THREE.Vector3) => {
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    geos.push(geo);
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    if (look) m.lookAt(look);
    scene.add(m);
    return m;
  };

  // Dark bowl: sky color, very dim, a touch brighter toward the horizon
  const bowl = new THREE.SphereGeometry(60, 48, 24);
  const bowlColors: number[] = [];
  const sky = new THREE.Color(skyHex);
  const tmp = new THREE.Color();
  const pos = bowl.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 60;
    const k = y > 0 ? 0.18 + (1 - y) * 0.35 : 0.08;
    tmp.copy(sky).multiplyScalar(k * 2.2);
    bowlColors.push(tmp.r, tmp.g, tmp.b);
  }
  bowl.setAttribute('color', new THREE.Float32BufferAttribute(bowlColors, 3));
  const bowlMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  geos.push(bowl);
  mats.push(bowlMat);
  scene.add(new THREE.Mesh(bowl, bowlMat));

  // Floor: dark steel
  const floor = new THREE.PlaneGeometry(120, 120);
  floor.rotateX(-Math.PI / 2);
  add(floor, new THREE.Color(0x15181c), new THREE.Vector3(0, -2, 0));

  // Floodlight banks on a ring of trusses, aimed down at the deck (HDR bright)
  const flood = new THREE.PlaneGeometry(4.5, 1.6);
  const white = new THREE.Color(0xfff4e6).multiplyScalar(6);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(flood, white, new THREE.Vector3(Math.cos(a) * 22, 24, Math.sin(a) * 22), new THREE.Vector3(0, 0, 0));
  }
  // Overhead light grid (soft)
  const strip = new THREE.PlaneGeometry(26, 0.9);
  strip.rotateX(Math.PI / 2);
  const soft = new THREE.Color(0xe8f0ff).multiplyScalar(2.2);
  for (const z of [-8, 0, 8]) add(strip, soft, new THREE.Vector3(0, 30, z));

  // LED fascia band around the stands in the arena color
  const band = new THREE.CylinderGeometry(34, 34, 1.4, 64, 1, true);
  add(band, new THREE.Color(accentHex).multiplyScalar(1.4), new THREE.Vector3(0, 6, 0));
  // Jumbotron glows
  const screen = new THREE.PlaneGeometry(10, 5);
  const screenCol = new THREE.Color(0x9ec5ff).multiplyScalar(1.2);
  for (const a of [0, Math.PI]) {
    add(screen, screenCol, new THREE.Vector3(Math.cos(a) * 32, 14, Math.sin(a) * 32), new THREE.Vector3(0, 14, 0));
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.035).texture;
  pmrem.dispose();
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  return tex;
}
