"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function HeroScene3D() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 1.3, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const dark = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.42, metalness: 0.35 });
    const soft = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.55, metalness: 0.12 });
    const green = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.36, metalness: 0.18, emissive: 0x052e16, emissiveIntensity: 0.4 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.36, metalness: 0.18, emissive: 0x083344, emissiveIntensity: 0.4 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.28, 2.35), dark);
    base.position.y = -1.18;
    group.add(base);

    const device = new THREE.Mesh(new THREE.BoxGeometry(2.25, 2.9, 0.34), soft);
    device.position.set(-0.55, 0.05, 0);
    group.add(device);

    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.72, 2.05, 0.08), dark);
    screen.position.set(-0.55, 0.15, 0.23);
    group.add(screen);

    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        if ((x + y) % 2 === 0 || x === 1) {
          const cube = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.08), y % 2 ? green : cyan);
          cube.position.set(-1.05 + x * 0.25, 0.72 - y * 0.25, 0.31);
          group.add(cube);
        }
      }
    }

    const gateLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.65, 0.22), dark);
    gateLeft.position.set(1.05, -0.08, 0.05);
    const gateTop = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.22, 0.22), dark);
    gateTop.position.set(1.62, 1.14, 0.05);
    const gateRight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.65, 0.22), dark);
    gateRight.position.set(2.2, -0.08, 0.05);
    group.add(gateLeft, gateTop, gateRight);

    const ticket = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.75, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    ticket.position.set(1.62, -0.25, 0.45);
    ticket.rotation.z = -0.12;
    group.add(ticket);

    const scanLine = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.035, 0.035), cyan);
    scanLine.position.set(0.25, 0.5, 0.62);
    group.add(scanLine);

    const ringGeometry = new THREE.TorusGeometry(2.35, 0.012, 8, 120);
    const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: 0xd4d4d8, transparent: true, opacity: 0.52 }));
    ring.rotation.x = Math.PI / 2.4;
    ring.position.y = -0.42;
    group.add(ring);

    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 76;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 2.35 + Math.sin(i) * 0.35;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(i * 1.7) * 0.7;
      positions[i * 3 + 2] = Math.sin(angle) * radius * 0.38;
    }
    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({ color: 0x3f3f46, size: 0.035, transparent: true, opacity: 0.72 }));
    group.add(particles);

    let mouseX = 0;
    let mouseY = 0;
    const onPointer = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      mouseX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.5;
      mouseY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.35;
    };
    mount.addEventListener("pointermove", onPointer);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    let frame = 0;
    let raf = 0;
    const animate = () => {
      frame += 0.01;
      group.rotation.y += (mouseX - group.rotation.y) * 0.035;
      group.rotation.x += (-mouseY - group.rotation.x) * 0.035;
      group.position.y = Math.sin(frame) * 0.05;
      scanLine.position.y = 0.78 + Math.sin(frame * 2.8) * 0.72;
      ring.rotation.z += 0.003;
      particles.rotation.y -= 0.002;
      ticket.rotation.y = Math.sin(frame * 1.3) * 0.12;
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      mount.removeEventListener("pointermove", onPointer);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      particlesGeometry.dispose();
      ringGeometry.dispose();
    };
  }, []);

  return <div ref={mountRef} className="hero-canvas absolute bottom-0 right-0 top-[48%] h-[52%] w-full lg:inset-y-0 lg:left-auto lg:h-full lg:w-[58%]" aria-hidden="true" />;
}
