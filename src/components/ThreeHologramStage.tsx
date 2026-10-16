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
      52,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      1000
    );
    camera.position.set(0, 0.5, 9.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Master Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. CENTRAL ARC REACTOR & SYNERGY PRISM GROUP
    const reactorGroup = new THREE.Group();
    rootGroup.add(reactorGroup);

    // Inner Octahedron Fusion Prism
    const prismGeo = new THREE.OctahedronGeometry(1.05, 1);
    const prismMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const prismMesh = new THREE.Mesh(prismGeo, prismMat);
    reactorGroup.add(prismMesh);

    // Inner Solid Glowing Core
    const coreSphereGeo = new THREE.IcosahedronGeometry(0.58, 2);
    const coreSphereMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const coreSphere = new THREE.Mesh(coreSphereGeo, coreSphereMat);
    reactorGroup.add(coreSphere);

    // Concentric Gyroscopic Rings
    const rings: THREE.Mesh[] = [];
    const ringConfigs = [
      { radius: 1.65, tube: 0.018, color: 0x00f0ff, opacity: 0.7 },
      { radius: 2.15, tube: 0.012, color: 0x38bdf8, opacity: 0.45 },
      { radius: 2.75, tube: 0.022, color: 0x00f0ff, opacity: 0.55 },
      { radius: 3.65, tube: 0.01, color: 0x0ea5e9, opacity: 0.3 },
    ];
    ringConfigs.forEach((rc, idx) => {
      const geo = new THREE.TorusGeometry(rc.radius, rc.tube, 16, 100);
      const mat = new THREE.MeshBasicMaterial({
        color: rc.color,
        transparent: true,
        opacity: rc.opacity,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = idx * 0.4;
      mesh.rotation.y = idx * 0.6;
      reactorGroup.add(mesh);
      rings.push(mesh);
    });

    // 2. FOUR ORBITAL MODEL CORES (ARGON, CLAUDE, GROK, GPT) + SYNERGY LASER BEAMS
    const coreNodes: {
      id: string;
      group: THREE.Group;
      outerShell: THREE.Mesh;
      innerCrystal: THREE.Mesh;
      beamLine: THREE.Line;
      baseAngle: number;
      colorHex: number;
    }[] = [];

    const colorMap: Record<string, number> = {
      argon: 0x00f0ff,
      claude: 0xff9e00,
      grok: 0xff2a6d,
      gpt: 0x00ff9d,
    };

    models.forEach((m, index) => {
      const nodeGroup = new THREE.Group();
      const hex = colorMap[m.id] || 0x00f0ff;

      const shellGeo = new THREE.IcosahedronGeometry(0.42, 1);
      const shellMat = new THREE.MeshBasicMaterial({
        color: hex,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      });
      const outerShell = new THREE.Mesh(shellGeo, shellMat);

      const crystalGeo = new THREE.OctahedronGeometry(0.24, 0);
      const crystalMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
      });
      const innerCrystal = new THREE.Mesh(crystalGeo, crystalMat);

      // Orbital ring around each model core
      const miniRingGeo = new THREE.TorusGeometry(0.58, 0.012, 12, 48);
      const miniRingMat = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.6,
      });
      const miniRing = new THREE.Mesh(miniRingGeo, miniRingMat);
      miniRing.rotation.x = Math.PI / 3;

      nodeGroup.add(outerShell);
      nodeGroup.add(innerCrystal);
      nodeGroup.add(miniRing);
      rootGroup.add(nodeGroup);

      // Laser tether beam from Model Core -> Central Fusion Prism
      const beamPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
      const beamGeo = new THREE.BufferGeometry().setFromPoints(beamPoints);
      const beamMat = new THREE.LineBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.65,
      });
      const beamLine = new THREE.Line(beamGeo, beamMat);
      rootGroup.add(beamLine);

      coreNodes.push({
        id: m.id,
        group: nodeGroup,
        outerShell,
        innerCrystal,
        beamLine,
        baseAngle: (index / Math.max(1, models.length)) * Math.PI * 2,
        colorHex: hex,
      });
    });

    // 3. 3D HOLOGRAPHIC RECON GLOBE / AST GRAPH LATTICE (Morphs during War Room & Forge modes)
    const globeGeo = new THREE.SphereGeometry(2.45, 24, 18);
    const globeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.0,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    rootGroup.add(globeMesh);

    // 4. AMBIENT HOLOGRAPHIC PARTICLE FIELD (1,200 reactive spatial particles)
    const particleCount = 1200;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 2.2 + Math.random() * 6.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.042,
      transparent: true,
      opacity: 0.55,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    rootGroup.add(particleSystem);

    // Mouse / Hand-Tracking Parallax Interaction
    let targetRotX = 0;
    let targetRotY = 0;
    const onMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      targetRotY = nx * 0.35;
      targetRotX = -ny * 0.25;
    };
    window.addEventListener('mousemove', onMouseMove);

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // Animation Loop
    let clock = 0;
    let animId = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clock += 0.016;

      const {
        spatialMode: mode,
        awakeModelIds: awake,
        bootState: bState,
        audioRms: rms,
        isExecuting: execBusy,
        handCursor: hCursor,
      } = stateRef.current;

      const audioPulse = 1 + (rms / 100) * 0.42 + (execBusy ? Math.sin(clock * 14) * 0.12 : 0);

      // Hand cursor override if webcam gesture tracking is active
      if (hCursor?.active) {
        targetRotY = (hCursor.x - 0.5) * 1.1;
        targetRotX = (hCursor.y - 0.5) * 0.8;
      }

      rootGroup.rotation.y += (targetRotY - rootGroup.rotation.y) * 0.06;
      rootGroup.rotation.x += (targetRotX - rootGroup.rotation.x) * 0.06;

      // Boot State Color Palette Shift
      let primaryHex = 0x00f0ff;
      if (bState === 'sentinel') primaryHex = 0x0ea5e9;
      if (bState === 'amber_challenge') primaryHex = 0xffaa00;
      if (bState === 'intruder') primaryHex = 0xff1e42;

      prismMat.color.setHex(primaryHex);
      coreSphereMat.color.setHex(primaryHex);
      particleMat.color.setHex(primaryHex);

      // Transform Geometry Based on Spatial Mode
      if (mode === 'nexus') {
        reactorGroup.scale.lerp(new THREE.Vector3(audioPulse, audioPulse, audioPulse), 0.12);
        globeMat.opacity += (0.0 - globeMat.opacity) * 0.1;
      } else if (mode === 'forge') {
        // Flatten reactor slightly & expand AST lattice
        reactorGroup.scale.lerp(new THREE.Vector3(0.72, 0.72, 0.72), 0.1);
        globeMat.opacity += (0.18 - globeMat.opacity) * 0.1;
        globeMesh.rotation.y -= 0.008;
      } else if (mode === 'overwatch') {
        // Push reactor rings outward like a HUD helmet visor perimeter
        reactorGroup.scale.lerp(new THREE.Vector3(1.32, 1.32, 1.32), 0.1);
        globeMat.opacity += (0.06 - globeMat.opacity) * 0.1;
      } else if (mode === 'warroom') {
        // Materialize 3D Recon Globe in center
        reactorGroup.scale.lerp(new THREE.Vector3(0.85, 0.85, 0.85), 0.1);
        globeMat.opacity += (0.38 - globeMat.opacity) * 0.1;
        globeMesh.rotation.y += 0.009;
        globeMesh.rotation.x = 0.25;
      }

      // Spin central prism & gyroscopic rings
      const speedMult = bState === 'sentinel' ? 0.2 : execBusy ? 2.6 : 1.0;
      prismMesh.rotation.y += 0.014 * speedMult;
      prismMesh.rotation.x += 0.009 * speedMult;
      coreSphere.rotation.y -= 0.02 * speedMult;

      rings.forEach((ring, idx) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        ring.rotation.z += 0.008 * dir * speedMult;
        ring.rotation.x += 0.004 * dir * speedMult;
        (ring.material as THREE.MeshBasicMaterial).color.setHex(primaryHex);
        (ring.material as THREE.MeshBasicMaterial).opacity =
          bState === 'sentinel' ? 0.12 : 0.45 + (idx % 2) * 0.2;
      });

      // Animate the 4 Model Cores: Awake cores orbit tightly in inner Ignition Ring & fire laser beams;
      // Sleeping cores drift in outer Cryo-Sleep orbit.
      coreNodes.forEach((node, idx) => {
        const isAwake = awake.includes(node.id) && bState === 'ignited';
        const orbitRadius = isAwake ? 2.15 : 3.75;
        const orbitSpeed = isAwake ? 0.55 : 0.15;
        const angle = node.baseAngle + clock * orbitSpeed * (idx % 2 === 0 ? 1 : -0.8);

        const targetX = Math.cos(angle) * orbitRadius;
        const targetY = Math.sin(angle) * (mode === 'forge' ? orbitRadius * 0.55 : orbitRadius * 0.78);
        const targetZ = Math.sin(angle * 2) * (isAwake ? 0.65 : -0.9);

        node.group.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.08);
        const targetScale = isAwake ? (execBusy ? 1.28 : 1.05) : 0.52;
        node.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

        node.outerShell.rotation.y += isAwake ? 0.035 : 0.006;
        node.innerCrystal.rotation.x -= isAwake ? 0.05 : 0.008;

        const shellMat = node.outerShell.material as THREE.MeshBasicMaterial;
        shellMat.opacity = isAwake ? 0.95 : 0.22;

        // Update Synergy Beam between Awake Core and Central Prism
        const beamMat = node.beamLine.material as THREE.LineBasicMaterial;
        if (isAwake) {
          const posAttr = node.beamLine.geometry.getAttribute('position') as THREE.BufferAttribute;
          posAttr.setXYZ(0, node.group.position.x, node.group.position.y, node.group.position.z);
          posAttr.setXYZ(1, 0, 0, 0);
          posAttr.needsUpdate = true;
          beamMat.opacity = execBusy ? 0.9 : 0.42;
        } else {
          beamMat.opacity = 0;
        }
      });

      particleSystem.rotation.y += 0.0018 * speedMult;
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
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
