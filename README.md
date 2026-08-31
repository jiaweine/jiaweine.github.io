# Jiawei Wang — Digital Human Portfolio

A from-scratch GitHub Pages portfolio centered on an interactive WebGL digital portrait.

## What changed

The previous multi-file portfolio implementation was intentionally replaced. The new site has one visual system and a smaller surface area:

- `index.html` — semantic one-page portfolio
- `styles.css` — responsive cyber/editorial visual system
- `main.js` — scroll reveals, active navigation, role rotation, tilt and magnetic interactions
- `avatar.js` — Three.js living portrait with depth deformation, pointer parallax, breathing motion, shader sweep, rings and particles
- `assets/digital-human.webp` — optimized portrait with white headphones

No build step is required; it runs directly on GitHub Pages.

## Digital-human architecture

The source is a single portrait, so the shipped version deliberately uses a **2.5D living portrait** instead of pretending a one-view image is already a geometrically correct full 3D head. The portrait is mapped to a highly subdivided plane. A face/chest/headphone depth field pushes vertices forward and the complete mesh responds to pointer movement. The shader adds restrained scan/sheen cues while preserving facial likeness.

This gives the homepage real WebGL motion while keeping the supplied portrait recognizable, fast and deployment-friendly.

### Motion included

- pointer-driven head/depth parallax
- low-amplitude breathing and idle drift
- scroll-linked portrait offset
- rotating 3D rings and ambient particles
- holographic shader sweep and scan texture
- card tilt, magnetic controls, role rotation and reveal animations
- pauses when the tab/hero is not visible
- respects `prefers-reduced-motion`
- static portrait fallback when WebGL/CDN loading fails

## Open-source references / upgrade path

The implementation currently uses **Three.js** directly because GitHub Pages can serve it without a build pipeline.

For a future *true rigged avatar* version, these projects are the best fit:

1. **pixiv/three-vrm** — VRM runtime on Three.js. Best next step after producing a `.vrm`/GLB model; supports avatar-oriented animation and expression workflows.
2. **VAST-AI-Research/TripoSR** — open-source single-image 3D reconstruction. Useful for generating an initial mesh offline, then manually cleaning it before web delivery.
3. **yfeng95/DECA** — face-focused reconstruction / expression capture research. Relevant if facial geometry is more important than a full-body mesh.
4. **facebookresearch/PIFuHD** and **YuliangXiu/ECON** — heavier clothed-human reconstruction references; better suited to full-body capture than this chest-up homepage.

Recommended production path for true 3D: portrait → face/head reconstruction → cleanup in Blender → add headphones/suit → rig + blendshapes → export VRM/GLB → load with `three-vrm` → add idle/blink/gaze/lip-sync clips.

## Local preview

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.
