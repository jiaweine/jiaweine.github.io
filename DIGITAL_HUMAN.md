# Digital Human Homepage — Architecture Notes

The homepage hero uses the supplied portrait as the visual identity source and turns it into a lightweight interactive WebGL "living portrait" rather than replacing the face with a generic 3D model.

## Why this approach

- **Identity first:** a single-photo full 3D reconstruction can easily drift away from the real face. The portrait texture preserves the exact look, glasses, suit and white headphones.
- **Fast on GitHub Pages:** the current site is static HTML/CSS/JS, so the implementation stays framework-free and uses the Three.js CDN already present in the project.
- **Real depth cues:** the image is rendered on a subdivided WebGL surface. A face/chest depth field, perspective rotation, lighting-like shader sweeps, orbit rings and particles create a 2.5D/3D response to the pointer.
- **Performance aware:** pixel ratio is capped, animation pauses when the hero is off-screen or the tab is hidden, and `prefers-reduced-motion` is respected.
- **Progressive enhancement:** if WebGL or the CDN fails, the portrait is still shown as a static fallback.

## Open-source upgrade paths researched

### Three.js
The current implementation stays on Three.js because the repository already uses it and GitHub Pages needs no build step.

### `pixiv/three-vrm`
Use this when there is a real `.vrm` avatar file. It loads VRM through Three.js and provides avatar-centric runtime features. This is the cleanest next step for skeletal animation, gaze, expressions and lip sync.

### `VAST-AI-Research/TripoSR`
Useful as an offline single-image-to-3D reconstruction experiment. It can generate a 3D asset from an image, but for a portrait homepage the output should be manually cleaned before shipping because single-view reconstruction can invent geometry outside the visible view.

### `yfeng95/DECA`
A face-specific reconstruction direction for extracting a 3D head and expression parameters from a single portrait. This is more suitable than a generic object reconstructor when facial likeness is the priority, but it adds an offline Python/CUDA preprocessing pipeline.

### `facebookresearch/pifuhd` / `YuliangXiu/ECON`
Useful references for full-body clothed-human reconstruction. They are heavier research pipelines and are unnecessary for the current chest-up homepage composition.

## Recommended roadmap

1. **Now:** ship the living portrait implemented in `scene.js` using `assets/digital-human.webp`.
2. **Next:** if true head rotation, blinking and facial expressions are required, preprocess the portrait with a face reconstruction pipeline (for example DECA), export a textured GLB/VRM, and load it with Three.js / `three-vrm`.
3. **Later:** add optional microphone/TTS-driven visemes, but keep the default homepage silent and lightweight.

## Files

- `scene.js` — WebGL scene, shader, depth/parallax motion and performance controls.
- `digital-human.css` — small UI layer for the live-model indicator and interaction hint.
- `assets/digital-human.webp` — optimized portrait texture.
- `academic.css` — restored because `index.html` still references it.
