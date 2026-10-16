import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ModelPluginManifest, SpatialMode, SynergyMode } from '../plugins/models/manifest';

interface ThreeHologramStageProps {
  spatialMode: SpatialMode;
  synergyMode: SynergyMode;
  models: ModelPluginManifest[];
  awakeModelIds: string[];
  bootState: 'sentinel' | 'amber_challenge' | 'intruder' | 'ignited';
  audioRms: number;
  isExecuting: boolean;
  handCursor?: { x: number; y: number; active: boolean; pinching: boolean };
  onToggleModel?: (modelId: string) => void;
}

// -----------------------------------------------------------------------------
// SHARED GLSL: 3D ASHIMA SIMPLEX NOISE
// -----------------------------------------------------------------------------
const GLSL_SIMPLEX_NOISE = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

// -----------------------------------------------------------------------------
// 1. CENTRAL BIOLUMINESCENT FLUID ORB SHADERS
// -----------------------------------------------------------------------------
const ORB_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uAudioRms;
  uniform float uExecBoost;
  uniform float uTurbulence;
  uniform float uMorphFlatten;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  varying float vDisplacement;

  ${GLSL_SIMPLEX_NOISE}

  void main() {
    vLocalPos = position;
    vec3 norm = normalize(normal);

    // Multi-octave organic fluid waves (Gemini Live / OpenAI Voice Orb feel)
    float slowWave = snoise(norm * 1.35 + vec3(uTime * 0.38, uTime * 0.29, -uTime * 0.32));
    float midWave  = snoise(norm * 2.65 - vec3(uTime * 0.72, -uTime * 0.55, uTime * 0.64));
    float fineWave = snoise(norm * 4.80 + vec3(uTime * 1.45 * uTurbulence));

    float acousticAmp = 0.065 + uAudioRms * 0.24 + uExecBoost * 0.09;
    float displacement = (slowWave * 0.58 + midWave * 0.30 + fineWave * 0.12 * uTurbulence) * acousticAmp;
    vDisplacement = displacement;

    vec3 displacedPos = position + norm * displacement;
    displacedPos.y *= (1.0 - uMorphFlatten * 0.28);

    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    vNormal = normalize(normalMatrix * (norm + displacement * 0.85));

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const ORB_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uAudioRms;
  uniform float uExecBoost;
  uniform float uCenterClarity;
  uniform vec3 uPrimaryColor;
  uniform vec3 uSecondaryColor;
  uniform vec3 uAgentColors[4];
  uniform vec4 uAgentWeights; // x=argon, y=claude, z=grok, w=gpt

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  varying float vDisplacement;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);

    // Dual-layer Fresnel for silky VisionOS glass + iridescent rim
    float fresnelInner = pow(1.0 - ndotv, 2.1);
    float fresnelRim   = pow(1.0 - ndotv, 4.8);

    // Spatial aurora lobes weighted by awake agents
    vec3 p = normalize(vLocalPos);
    float lobe0 = max(0.0, sin(p.x * 2.5 + uTime * 0.9) * cos(p.y * 2.0 - uTime * 0.6)) * uAgentWeights.x;
    float lobe1 = max(0.0, sin(p.y * 2.7 - uTime * 0.8) * cos(p.z * 2.2 + uTime * 0.7)) * uAgentWeights.y;
    float lobe2 = max(0.0, cos(p.z * 2.8 + uTime * 1.1) * sin(p.x * 2.3 + uTime * 0.5)) * uAgentWeights.z;
    float lobe3 = max(0.0, sin((p.x + p.y) * 2.2 - uTime * 1.0)) * uAgentWeights.w;

    float weightSum = max(0.001, lobe0 + lobe1 + lobe2 + lobe3);
    vec3 agentAurora = (
      uAgentColors[0] * lobe0 +
      uAgentColors[1] * lobe1 +
      uAgentColors[2] * lobe2 +
      uAgentColors[3] * lobe3
    ) / weightSum;

    float activeAny = clamp(dot(uAgentWeights, vec4(1.0)), 0.0, 1.0);
    vec3 baseIridescence = mix(uPrimaryColor, agentAurora, 0.65 * activeAny);

    float crest = smoothstep(-0.08, 0.14, vDisplacement);
    vec3 fluidColor = mix(uPrimaryColor * 0.35, baseIridescence, crest * 0.75 + 0.25);
    fluidColor = mix(fluidColor, uSecondaryColor, fresnelInner * 0.55);

    // Deep velvet core attenuation so foreground glass typography stays legible
    vec3 abyssCore = vec3(0.03, 0.04, 0.07);
    vec3 finalColor = mix(abyssCore, fluidColor, fresnelInner * 0.82 + crest * 0.34);

    // Add bioluminescent rim highlight + audio excitation
    finalColor += (baseIridescence * 1.3 + vec3(0.18, 0.22, 0.32)) * fresnelRim * (1.0 + uAudioRms * 0.9 + uExecBoost * 0.6);

    float alpha = mix(0.22 * uCenterClarity, 0.94, fresnelInner * 0.78 + crest * 0.22);
    gl_FragColor = vec4(finalColor, clamp(alpha, 0.08, 0.96));
  }
`;

// -----------------------------------------------------------------------------
// 2. VOLUMETRIC CORONA HALO SHADERS (BackSide Additive Bloom)
// -----------------------------------------------------------------------------
const HALO_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const HALO_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uGlowColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float rim = pow(clamp(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0), 3.2);
    gl_FragColor = vec4(uGlowColor * rim * uIntensity, rim * uIntensity * 0.62);
  }
`;

// -----------------------------------------------------------------------------
// 3. AGENT CORE SPHERE SHADERS (Argon, Claude, Grok, GPT)
// -----------------------------------------------------------------------------
const CORE_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uAwake;
  uniform float uAudioRms;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vWave;

  ${GLSL_SIMPLEX_NOISE}

  void main() {
    vec3 norm = normalize(normal);
    float n = snoise(norm * 2.4 + vec3(uTime * 1.1 + uPhase));
    float amp = (0.025 + uAudioRms * 0.09) * uAwake;
    vWave = n;
    vec3 pos = position + norm * (n * amp);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    vNormal = normalize(normalMatrix * norm);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const CORE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uAwake;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vWave;

  void main() {
    float ndotv = clamp(abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 2.4);
    float coreHotspot = pow(ndotv, 3.5);

    vec3 col = mix(uColorA, uColorB, fresnel * 0.8 + vWave * 0.25);
    col += vec3(1.0) * coreHotspot * 0.55 * uAwake;
    col += uColorB * fresnel * 1.25 * uAwake;

    gl_FragColor = vec4(col, uOpacity * mix(0.45, 1.0, fresnel + coreHotspot * 0.5));
  }
`;

// -----------------------------------------------------------------------------
// 4. FLUID PARTICLE RIBBON SHADERS (Additive Aurora Streams)
// -----------------------------------------------------------------------------
const RIBBON_VERTEX_SHADER = /* glsl */ `
  attribute float aProgress;
  attribute float aSize;
  uniform float uTime;
  uniform float uStreamSpeed;
  uniform float uScale;

  varying float vProgress;
  varying float vPulse;

  void main() {
    vProgress = aProgress;
    float packet = sin((aProgress * 12.5) - uTime * uStreamSpeed * 4.5) * 0.5 + 0.5;
    vPulse = pow(packet, 3.0);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float env = sin(aProgress * 3.14159265);
    gl_PointSize = aSize * uScale * (0.65 + vPulse * 1.15) * env * (110.0 / max(1.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const RIBBON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;

  varying float vProgress;
  varying float vPulse;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float radial = pow(1.0 - dist * 2.0, 2.2);
    vec3 col = mix(uColorA, uColorB, vProgress);
    col = mix(col, vec3(1.0), vPulse * 0.55);

    float alpha = radial * uOpacity * (0.45 + vPulse * 0.55) * sin(vProgress * 3.14159265);
    gl_FragColor = vec4(col, alpha);
  }
`;

// -----------------------------------------------------------------------------
// 5. SPATIAL RECON / AST LATTICE SHELL SHADER (Workbench & Global Pulse)
// -----------------------------------------------------------------------------
const LATTICE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    if (uOpacity <= 0.005) discard;
    float ndotv = clamp(abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0);
    float rim = pow(1.0 - ndotv, 2.0);
    float latScan = sin(vNormal.y * 28.0 - uTime * 2.2) * 0.5 + 0.5;
    float lonScan = sin(atan(vNormal.z, vNormal.x) * 16.0 + uTime * 1.4) * 0.5 + 0.5;
    float grid = smoothstep(0.92, 0.99, max(latScan, lonScan));

    vec3 col = uColor * (rim * 0.8 + grid * 1.1);
    float alpha = (rim * 0.55 + grid * 0.65) * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

interface AgentVisualPalette {
  colorA: THREE.Color;
  colorB: THREE.Color;
  phase: number;
}

const AGENT_PALETTES: Record<string, AgentVisualPalette> = {
  // Argon = Google Gemini Iridescent Blue / Violet
  argon: {
    colorA: new THREE.Color(0x6e8efb),
    colorB: new THREE.Color(0xa777e3),
    phase: 0.0,
  },
  // Claude = Anthropic Editorial Terracotta / Champagne
  claude: {
    colorA: new THREE.Color(0xd97757),
    colorB: new THREE.Color(0xf0a88c),
    phase: 1.57,
  },
  // Grok = xAI Supernova Rose / Titanium
  grok: {
    colorA: new THREE.Color(0xf43f5e),
    colorB: new THREE.Color(0xfda4af),
    phase: 3.14,
  },
  // GPT = OpenAI Ethereal Jade Pearl
  gpt: {
    colorA: new THREE.Color(0x10a37f),
    colorB: new THREE.Color(0x34d399),
    phase: 4.71,
  },
};

export const ThreeHologramStage: React.FC<ThreeHologramStageProps> = ({
  spatialMode,
  synergyMode,
  models,
  awakeModelIds,
  bootState,
  audioRms,
  isExecuting,
  handCursor,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    spatialMode,
    synergyMode,
    awakeModelIds,
    bootState,
    audioRms,
    isExecuting,
    handCursor,
  });

  useEffect(() => {
    stateRef.current = {
      spatialMode,
      synergyMode,
      awakeModelIds,
      bootState,
      audioRms,
      isExecuting,
      handCursor,
    };
  }, [spatialMode, synergyMode, awakeModelIds, bootState, audioRms, isExecuting, handCursor]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      48,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      1000
    );
    camera.position.set(0, 0.15, 8.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // -------------------------------------------------------------------------
    // 1. CENTRAL BIOLUMINESCENT FLUID ORB & VOLUMETRIC CORONA HALO
    // -------------------------------------------------------------------------
    const reactorGroup = new THREE.Group();
    rootGroup.add(reactorGroup);

    const orbUniforms = {
      uTime: { value: 0 },
      uAudioRms: { value: 0 },
      uExecBoost: { value: 0 },
      uTurbulence: { value: 1.0 },
      uMorphFlatten: { value: 0.0 },
      uCenterClarity: { value: 1.0 },
      uPrimaryColor: { value: new THREE.Color(0x6e8efb) },
      uSecondaryColor: { value: new THREE.Color(0xa777e3) },
      uAgentColors: {
        value: [
          AGENT_PALETTES.argon.colorA.clone(),
          AGENT_PALETTES.claude.colorA.clone(),
          AGENT_PALETTES.grok.colorA.clone(),
          AGENT_PALETTES.gpt.colorA.clone(),
        ],
      },
      uAgentWeights: { value: new THREE.Vector4(1, 1, 0, 0) },
    };

    const orbGeo = new THREE.SphereGeometry(1.18, 128, 128);
    const orbMat = new THREE.ShaderMaterial({
      vertexShader: ORB_VERTEX_SHADER,
      fragmentShader: ORB_FRAGMENT_SHADER,
      uniforms: orbUniforms,
      transparent: true,
      depthWrite: false,
    });
    const orbMesh = new THREE.Mesh(orbGeo, orbMat);
    reactorGroup.add(orbMesh);

    const haloUniforms = {
      uGlowColor: { value: new THREE.Color(0x6e8efb) },
      uIntensity: { value: 0.85 },
    };
    const haloGeo = new THREE.SphereGeometry(1.56, 64, 64);
    const haloMat = new THREE.ShaderMaterial({
      vertexShader: HALO_VERTEX_SHADER,
      fragmentShader: HALO_FRAGMENT_SHADER,
      uniforms: haloUniforms,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    reactorGroup.add(haloMesh);

    // Gossamer orbital light tracks
    const auraRings: THREE.Mesh[] = [];
    const ringRadii = [1.72, 2.28];
    ringRadii.forEach((radius, idx) => {
      const rGeo = new THREE.TorusGeometry(radius, 0.004, 16, 140);
      const rMat = new THREE.MeshBasicMaterial({
        color: 0x6e8efb,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.rotation.x = Math.PI / 2.3 + idx * 0.35;
      reactorGroup.add(rMesh);
      auraRings.push(rMesh);
    });

    // -------------------------------------------------------------------------
    // 2. AGENT CORES + 160-PARTICLE CURVED CUBIC BEZIER AURORA RIBBONS
    // -------------------------------------------------------------------------
    const ribbonPointsCount = 160;

    const coreNodes: {
      id: string;
      group: THREE.Group;
      coreMesh: THREE.Mesh;
      coreUniforms: {
        uTime: { value: number };
        uPhase: { value: number };
        uAwake: { value: number };
        uAudioRms: { value: number };
        uColorA: { value: THREE.Color };
        uColorB: { value: THREE.Color };
        uOpacity: { value: number };
      };
      haloRing: THREE.Mesh;
      ribbonPoints: THREE.Points;
      ribbonGeo: THREE.BufferGeometry;
      ribbonUniforms: {
        uTime: { value: number };
        uStreamSpeed: { value: number };
        uScale: { value: number };
        uColorA: { value: THREE.Color };
        uColorB: { value: THREE.Color };
        uOpacity: { value: number };
      };
      baseAngle: number;
      palette: AgentVisualPalette;
    }[] = [];

    models.forEach((m, index) => {
      const palette = AGENT_PALETTES[m.id] || {
        colorA: new THREE.Color(m.accentHex || '#6e8efb'),
        colorB: new THREE.Color('#a777e3'),
        phase: index * 1.5,
      };

      const nodeGroup = new THREE.Group();

      const coreUniforms = {
        uTime: { value: 0 },
        uPhase: { value: palette.phase },
        uAwake: { value: 1.0 },
        uAudioRms: { value: 0.0 },
        uColorA: { value: palette.colorA.clone() },
        uColorB: { value: palette.colorB.clone() },
        uOpacity: { value: 0.9 },
      };

      const coreGeo = new THREE.SphereGeometry(0.28, 64, 64);
      const coreMat = new THREE.ShaderMaterial({
        vertexShader: CORE_VERTEX_SHADER,
        fragmentShader: CORE_FRAGMENT_SHADER,
        uniforms: coreUniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);

      const miniRingGeo = new THREE.TorusGeometry(0.44, 0.004, 12, 72);
      const miniRingMat = new THREE.MeshBasicMaterial({
        color: palette.colorA,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const haloRing = new THREE.Mesh(miniRingGeo, miniRingMat);
      haloRing.rotation.x = Math.PI / 2.6;

      nodeGroup.add(coreMesh);
      nodeGroup.add(haloRing);
      rootGroup.add(nodeGroup);

      const rPositions = new Float32Array(ribbonPointsCount * 3);
      const rProgress = new Float32Array(ribbonPointsCount);
      const rSizes = new Float32Array(ribbonPointsCount);

      for (let i = 0; i < ribbonPointsCount; i++) {
        const t = i / (ribbonPointsCount - 1);
        rProgress[i] = t;
        rSizes[i] = 1.45 + Math.sin(t * Math.PI * 4.0) * 0.5;
      }

      const ribbonGeo = new THREE.BufferGeometry();
      ribbonGeo.setAttribute('position', new THREE.BufferAttribute(rPositions, 3));
      ribbonGeo.setAttribute('aProgress', new THREE.BufferAttribute(rProgress, 1));
      ribbonGeo.setAttribute('aSize', new THREE.BufferAttribute(rSizes, 1));

      const ribbonUniforms = {
        uTime: { value: 0 },
        uStreamSpeed: { value: 1.0 },
        uScale: { value: 1.0 },
        uColorA: { value: palette.colorA.clone() },
        uColorB: { value: palette.colorB.clone() },
        uOpacity: { value: 0.0 },
      };

      const ribbonMat = new THREE.ShaderMaterial({
        vertexShader: RIBBON_VERTEX_SHADER,
        fragmentShader: RIBBON_FRAGMENT_SHADER,
        uniforms: ribbonUniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const ribbonPoints = new THREE.Points(ribbonGeo, ribbonMat);
      rootGroup.add(ribbonPoints);

      coreNodes.push({
        id: m.id,
        group: nodeGroup,
        coreMesh,
        coreUniforms,
        haloRing,
        ribbonPoints,
        ribbonGeo,
        ribbonUniforms,
        baseAngle: (index / Math.max(1, models.length)) * Math.PI * 2,
        palette,
      });
    });

    // -------------------------------------------------------------------------
    // 3. SHADER LATTICE HORIZON SHELL (Global Pulse & Workbench)
    // -------------------------------------------------------------------------
    const latticeUniforms = {
      uColor: { value: new THREE.Color(0x6e8efb) },
      uOpacity: { value: 0.0 },
      uTime: { value: 0.0 },
    };
    const globeGeo = new THREE.SphereGeometry(2.42, 64, 48);
    const globeMat = new THREE.ShaderMaterial({
      vertexShader: HALO_VERTEX_SHADER,
      fragmentShader: LATTICE_FRAGMENT_SHADER,
      uniforms: latticeUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    rootGroup.add(globeMesh);

    // -------------------------------------------------------------------------
    // 4. BIOLUMINESCENT CONSTELLATION DUST FIELD
    // -------------------------------------------------------------------------
    const particleCount = 900;
    const dustPos = new Float32Array(particleCount * 3);
    const dustProgress = new Float32Array(particleCount);
    const dustSizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const r = 2.4 + Math.random() * 6.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      dustPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      dustPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      dustPos[i * 3 + 2] = r * Math.cos(phi);
      dustProgress[i] = 0.2 + Math.random() * 0.6;
      dustSizes[i] = 0.5 + Math.random() * 0.8;
    }

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('aProgress', new THREE.BufferAttribute(dustProgress, 1));
    dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSizes, 1));

    const dustUniforms = {
      uTime: { value: 0 },
      uStreamSpeed: { value: 0.25 },
      uScale: { value: 0.7 },
      uColorA: { value: new THREE.Color(0x6e8efb) },
      uColorB: { value: new THREE.Color(0xa777e3) },
      uOpacity: { value: 0.35 },
    };

    const dustMat = new THREE.ShaderMaterial({
      vertexShader: RIBBON_VERTEX_SHADER,
      fragmentShader: RIBBON_FRAGMENT_SHADER,
      uniforms: dustUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(dustGeo, dustMat);
    rootGroup.add(particleSystem);

    let targetRotX = 0;
    let targetRotY = 0;
    const onMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      targetRotY = nx * 0.26;
      targetRotX = -ny * 0.18;
    };
    window.addEventListener('mousemove', onMouseMove);

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    const targetCamPos = new THREE.Vector3(0, 0.15, 8.2);
    const currentLookAt = new THREE.Vector3(0, 0, 0);
    const targetLookAt = new THREE.Vector3(0, 0, 0);
    const targetOrbScale = new THREE.Vector3(1, 1, 1);
    const tempVecA = new THREE.Vector3();
    const tempControl1 = new THREE.Vector3();
    const tempControl2 = new THREE.Vector3();
    const tempEnd = new THREE.Vector3();
    const targetPrimaryCol = new THREE.Color(0x6e8efb);
    const targetSecondaryCol = new THREE.Color(0xa777e3);

    let clock = 0;
    let smoothedRms = 0;
    let smoothedExec = 0;
    let animId = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clock += 0.016;

      const {
        spatialMode: mode,
        synergyMode: synMode,
        awakeModelIds: awake,
        bootState: bState,
        audioRms: rms,
        isExecuting: execBusy,
        handCursor: hCursor,
      } = stateRef.current;

      const normalizedRms = Math.min(1.0, Math.max(0.0, rms / 85));
      smoothedRms += (normalizedRms - smoothedRms) * 0.16;
      smoothedExec += ((execBusy ? 1.0 : 0.0) - smoothedExec) * 0.08;

      if (hCursor?.active) {
        targetRotY = (hCursor.x - 0.5) * 0.9;
        targetRotX = (hCursor.y - 0.5) * 0.65;
      }

      rootGroup.rotation.y += (targetRotY - rootGroup.rotation.y) * 0.05;
      rootGroup.rotation.x += (targetRotX - rootGroup.rotation.x) * 0.05;

      if (bState === 'sentinel') {
        targetPrimaryCol.setHex(0x6e8efb);
        targetSecondaryCol.setHex(0x4338ca);
      } else if (bState === 'amber_challenge') {
        targetPrimaryCol.setHex(0xf59e0b);
        targetSecondaryCol.setHex(0xfde68a);
      } else if (bState === 'intruder') {
        targetPrimaryCol.setHex(0xf43f5e);
        targetSecondaryCol.setHex(0x881337);
      } else {
        targetPrimaryCol.setHex(0x6e8efb);
        targetSecondaryCol.setHex(0xa777e3);
      }

      orbUniforms.uPrimaryColor.value.lerp(targetPrimaryCol, 0.08);
      orbUniforms.uSecondaryColor.value.lerp(targetSecondaryCol, 0.08);
      haloUniforms.uGlowColor.value.copy(orbUniforms.uPrimaryColor.value);
      latticeUniforms.uColor.value.copy(orbUniforms.uPrimaryColor.value);
      dustUniforms.uColorA.value.copy(orbUniforms.uPrimaryColor.value);
      dustUniforms.uColorB.value.copy(orbUniforms.uSecondaryColor.value);

      const isIgnited = bState === 'ignited';
      const wArgon = isIgnited && awake.includes('argon') ? 1.0 : 0.08;
      const wClaude = isIgnited && awake.includes('claude') ? 1.0 : 0.08;
      const wGrok = isIgnited && awake.includes('grok') ? 1.0 : 0.08;
      const wGpt = isIgnited && awake.includes('gpt') ? 1.0 : 0.08;
      orbUniforms.uAgentWeights.value.lerp(
        new THREE.Vector4(wArgon, wClaude, wGrok, wGpt),
        0.08
      );

      let targetTurbulence = 1.0;
      let orbitSpeedMult = 1.0;
      let streamSpeed = 1.1;

      if (synMode === 'fusion') {
        targetTurbulence = 0.85;
        orbitSpeedMult = 1.0;
        streamSpeed = 1.25;
      } else if (synMode === 'adversarial') {
        targetTurbulence = 1.85;
        orbitSpeedMult = 1.35;
        streamSpeed = 2.1;
      } else if (synMode === 'sprint') {
        targetTurbulence = 1.45;
        orbitSpeedMult = 2.1;
        streamSpeed = 2.85;
      } else if (synMode === 'relay') {
        targetTurbulence = 1.05;
        orbitSpeedMult = 0.85;
        streamSpeed = 1.65;
      }

      if (bState === 'intruder') {
        targetTurbulence = 2.3;
      } else if (bState === 'sentinel') {
        targetTurbulence = 0.5;
        orbitSpeedMult = 0.35;
      }

      orbUniforms.uTurbulence.value +=
        (targetTurbulence - orbUniforms.uTurbulence.value) * 0.08;

      const breathScale = 1.0 + smoothedRms * 0.22 + smoothedExec * 0.08;
      let targetFlatten = 0.0;
      let targetLatticeOpacity = 0.0;
      let targetCenterClarity = 1.0;

      if (mode === 'nexus') {
        targetCamPos.set(0, 0.12, 8.15);
        targetLookAt.set(0, 0, 0);
        targetOrbScale.set(breathScale, breathScale, breathScale);
        targetFlatten = 0.0;
        targetLatticeOpacity = 0.0;
        targetCenterClarity = 1.0;
      } else if (mode === 'forge') {
        targetCamPos.set(0, 1.65, 8.65);
        targetLookAt.set(0, -0.15, 0);
        targetOrbScale.set(breathScale * 1.05, breathScale * 0.78, breathScale * 1.05);
        targetFlatten = 0.85;
        targetLatticeOpacity = 0.22;
        targetCenterClarity = 0.75;
        globeMesh.rotation.y -= 0.005;
      } else if (mode === 'overwatch') {
        targetCamPos.set(0, 0.0, 9.45);
        targetLookAt.set(0, 0, 0);
        targetOrbScale.set(breathScale * 0.82, breathScale * 0.82, breathScale * 0.82);
        targetFlatten = 0.15;
        targetLatticeOpacity = 0.08;
        targetCenterClarity = 0.42;
      } else if (mode === 'warroom') {
        targetCamPos.set(0.35, 0.85, 8.5);
        targetLookAt.set(0, 0, 0);
        targetOrbScale.set(breathScale * 0.88, breathScale * 0.88, breathScale * 0.88);
        targetFlatten = 0.0;
        targetLatticeOpacity = 0.38;
        targetCenterClarity = 0.85;
        globeMesh.rotation.y += 0.007;
        globeMesh.rotation.x = 0.26;
      }

      camera.position.lerp(targetCamPos, 0.05);
      currentLookAt.lerp(targetLookAt, 0.06);
      camera.lookAt(currentLookAt);

      reactorGroup.scale.lerp(targetOrbScale, 0.09);
      orbUniforms.uMorphFlatten.value +=
        (targetFlatten - orbUniforms.uMorphFlatten.value) * 0.08;
      orbUniforms.uCenterClarity.value +=
        (targetCenterClarity - orbUniforms.uCenterClarity.value) * 0.08;
      latticeUniforms.uOpacity.value +=
        (targetLatticeOpacity - latticeUniforms.uOpacity.value) * 0.08;

      orbUniforms.uTime.value = clock;
      orbUniforms.uAudioRms.value = smoothedRms;
      orbUniforms.uExecBoost.value = smoothedExec;
      latticeUniforms.uTime.value = clock;
      dustUniforms.uTime.value = clock;
      haloUniforms.uIntensity.value =
        (bState === 'sentinel' ? 0.45 : 0.82) + smoothedRms * 0.55 + smoothedExec * 0.35;

      orbMesh.rotation.y += 0.004 * orbitSpeedMult;
      auraRings.forEach((ring, idx) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        ring.rotation.z += 0.0045 * dir * orbitSpeedMult;
        ring.rotation.y += 0.0025 * dir;
        const rMat = ring.material as THREE.MeshBasicMaterial;
        rMat.color.copy(orbUniforms.uPrimaryColor.value);
        rMat.opacity = bState === 'sentinel' ? 0.1 : mode === 'overwatch' ? 0.28 : 0.16;
      });

      const awakeNodes = coreNodes.filter(
        (n) => awake.includes(n.id) && bState === 'ignited'
      );

      coreNodes.forEach((node, idx) => {
        const isAwake = awake.includes(node.id) && bState === 'ignited';

        let baseRadius = isAwake ? 2.28 : 3.85;
        if (isAwake) {
          if (mode === 'overwatch') baseRadius = 2.95;
          else if (mode === 'warroom') baseRadius = 2.55;
          else if (synMode === 'fusion') baseRadius = 1.98 - smoothedExec * 0.22;
        }

        const speed = (isAwake ? 0.42 : 0.12) * orbitSpeedMult;
        let angle = node.baseAngle + clock * speed * (idx % 2 === 0 ? 1 : -0.85);

        if (isAwake && synMode === 'adversarial') {
          const poleIndex = awakeNodes.indexOf(node);
          const poleAngle =
            (poleIndex / Math.max(1, awakeNodes.length)) * Math.PI * 2 + clock * 0.22;
          angle = poleAngle + Math.sin(clock * 9.0 + idx) * 0.06;
        }

        const yRatio = mode === 'forge' ? 0.38 : mode === 'overwatch' ? 0.65 : 0.76;
        const targetX = Math.cos(angle) * baseRadius;
        const targetY = Math.sin(angle) * (baseRadius * yRatio);
        const targetZ = Math.sin(angle * 2.0 + idx) * (isAwake ? 0.72 : -0.95);

        tempVecA.set(targetX, targetY, targetZ);
        node.group.position.lerp(tempVecA, 0.08);

        const targetScale = isAwake
          ? 1.0 + smoothedExec * 0.24 + smoothedRms * 0.18
          : 0.45;
        node.group.scale.lerp(
          tempVecA.set(targetScale, targetScale, targetScale),
          0.1
        );

        node.coreUniforms.uTime.value = clock;
        node.coreUniforms.uAudioRms.value = smoothedRms;
        node.coreUniforms.uAwake.value +=
          ((isAwake ? 1.0 : 0.15) - node.coreUniforms.uAwake.value) * 0.1;
        node.coreUniforms.uOpacity.value +=
          ((isAwake ? 0.95 : 0.22) - node.coreUniforms.uOpacity.value) * 0.1;

        node.haloRing.rotation.z -= isAwake ? 0.025 : 0.005;
        node.haloRing.rotation.y += isAwake ? 0.018 : 0.003;
        (node.haloRing.material as THREE.MeshBasicMaterial).opacity = isAwake
          ? 0.36
          : 0.06;

        node.ribbonUniforms.uTime.value = clock;
        node.ribbonUniforms.uStreamSpeed.value = streamSpeed * (execBusy ? 1.55 : 1.0);
        const targetRibbonOpacity = isAwake ? (execBusy ? 0.92 : 0.62) : 0.0;
        node.ribbonUniforms.uOpacity.value +=
          (targetRibbonOpacity - node.ribbonUniforms.uOpacity.value) * 0.1;

        if (node.ribbonUniforms.uOpacity.value > 0.01) {
          const p0 = node.group.position;

          if (synMode === 'relay' && awakeNodes.length > 1) {
            const awakeIdx = awakeNodes.indexOf(node);
            if (awakeIdx >= 0 && awakeIdx < awakeNodes.length - 1) {
              tempEnd.copy(awakeNodes[awakeIdx + 1].group.position);
            } else {
              tempEnd.set(0, 0, 0);
            }
          } else {
            tempEnd.set(0, 0, 0);
          }

          const swirlAngle = clock * 1.4 + node.palette.phase;
          const swirlAmp = synMode === 'adversarial' ? 0.95 : 0.58;
          tempControl1
            .copy(p0)
            .lerp(tempEnd, 0.33)
            .add(
              new THREE.Vector3(
                -p0.y * 0.35 + Math.cos(swirlAngle) * swirlAmp,
                p0.x * 0.35 + Math.sin(swirlAngle) * swirlAmp,
                Math.sin(swirlAngle * 1.3) * 0.55
              )
            );

          tempControl2
            .copy(p0)
            .lerp(tempEnd, 0.68)
            .add(
              new THREE.Vector3(
                Math.sin(swirlAngle) * (swirlAmp * 0.5),
                Math.cos(swirlAngle) * (swirlAmp * 0.5),
                Math.cos(swirlAngle * 1.7) * 0.35
              )
            );

          const posAttr = node.ribbonGeo.getAttribute(
            'position'
          ) as THREE.BufferAttribute;

          for (let i = 0; i < ribbonPointsCount; i++) {
            const t = i / (ribbonPointsCount - 1);
            const invT = 1.0 - t;
            const b0 = invT * invT * invT;
            const b1 = 3.0 * invT * invT * t;
            const b2 = 3.0 * invT * t * t;
            const b3 = t * t * t;

            const x =
              b0 * p0.x +
              b1 * tempControl1.x +
              b2 * tempControl2.x +
              b3 * tempEnd.x;
            const y =
              b0 * p0.y +
              b1 * tempControl1.y +
              b2 * tempControl2.y +
              b3 * tempEnd.y;
            const z =
              b0 * p0.z +
              b1 * tempControl1.z +
              b2 * tempControl2.z +
              b3 * tempEnd.z;

            posAttr.setXYZ(i, x, y, z);
          }
          posAttr.needsUpdate = true;
        }
      });

      particleSystem.rotation.y += 0.0012 * orbitSpeedMult;
      particleSystem.rotation.x = Math.sin(clock * 0.2) * 0.06;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      orbGeo.dispose();
      orbMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      globeGeo.dispose();
      globeMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      renderer.dispose();
    };
  }, [models]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden="true"
    />
  );
};
