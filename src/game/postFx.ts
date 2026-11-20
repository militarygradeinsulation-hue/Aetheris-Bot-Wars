import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Camera-like finishing: soft vignette, slight chromatic fringe at the edges,
 * fine film grain and a gentle filmic contrast curve. Runs after tone mapping.
 */
const LensFinishShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 0.24 },
    uGrain: { value: 0.025 },
    uFringe: { value: 0.0007 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uFringe;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 37.0) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * uFringe * (1.0 + r2 * 6.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // Gentle S-curve for punchier midtones without crushing blacks
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);
      float vig = smoothstep(0.85, 0.18, r2 * (1.0 + uVignette * 2.2));
      col *= mix(1.0 - uVignette, 1.0, vig);
      col += (hash(vUv * 1024.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export type PostFxQuality = 'off' | 'low' | 'high';

export interface PostFx {
  render: (dt: number) => void;
  setSize: (w: number, h: number) => void;
  setQuality: (q: PostFxQuality, ao: boolean) => void;
  setBloomBoost: (extra: number) => void;
  dispose: () => void;
}

export function createPostFx(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): PostFx {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x, size.y);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  composer.addPass(gtao);

  // Bloom only picks up genuinely bright pixels: emissives, sparks, lights
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.5, 0.93);
  composer.addPass(bloom);

  const output = new OutputPass();
  composer.addPass(output);

  const lens = new ShaderPass(LensFinishShader);
  composer.addPass(lens);

  const smaa = new SMAAPass();
  composer.addPass(smaa);

  let quality: PostFxQuality = 'high';
  let baseBloom = 0.32;

  const apply = (ao: boolean) => {
    const on = quality !== 'off';
    gtao.enabled = on && quality === 'high' && ao;
    bloom.enabled = on;
    lens.enabled = on;
    smaa.enabled = on;
  };
  apply(true);

  let t = 0;
  return {
    render: (dt: number) => {
      if (quality === 'off') {
        renderer.render(scene, camera);
        return;
      }
      t += dt;
      lens.uniforms.uTime.value = t % 100;
      composer.render(dt);
    },
    setSize: (w: number, h: number) => {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      gtao.setSize(w, h);
    },
    setQuality: (q: PostFxQuality, ao: boolean) => {
      quality = q;
      apply(ao);
    },
    setBloomBoost: (extra: number) => {
      bloom.strength = baseBloom + extra;
    },
    dispose: () => {
      composer.dispose();
      gtao.dispose();
      bloom.dispose();
      baseBloom = 0;
    },
  };
}
