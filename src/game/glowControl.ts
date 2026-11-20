import * as THREE from 'three';

/**
 * Global glow level for every lit material (emissive panels, visors, neon trim, hazard lights).
 * Patched once into the shared shader chunk so it also covers values animated every frame.
 */
export const GLOW_SCALE = 0.4;

let patched = false;
export function applyGlowScale() {
  if (patched) return;
  patched = true;
  const chunk = THREE.ShaderChunk.emissivemap_fragment;
  THREE.ShaderChunk.emissivemap_fragment = `${chunk}\n\ttotalEmissiveRadiance *= ${GLOW_SCALE.toFixed(2)};\n`;
}

applyGlowScale();
