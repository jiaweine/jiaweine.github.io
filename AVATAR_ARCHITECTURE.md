# True 3D Digital Human Architecture

This branch replaces the old 2.5D image-warp avatar with a real WebGL geometry pipeline.

## Runtime pipeline

1. Load the portrait asset.
2. Run MediaPipe Face Landmarker once in IMAGE mode.
3. Use the detected 3D face landmarks plus MediaPipe tessellation to construct a real `THREE.BufferGeometry` face mesh.
4. Project the portrait onto that mesh as a UV texture.
5. Add separate 3D geometry for skull volume, hair silhouette, neck, suit torso, tie and white headphones.
6. Drive the head group with a spring-based attention controller rather than distorting pixels.
7. The pointer controls head pose and lighting. Fast cursor movement is intentionally damped to avoid robotic jitter; when the pointer leaves, the avatar returns to a low-amplitude idle state.
8. No synthetic image-warp blink is used. The previous blink was removed because closing eyes by squeezing a static image creates uncanny artifacts.

## Open-source references evaluated

### Google MediaPipe Face Landmarker

Used for the actual face landmark topology and one-time 3D landmark inference in the browser. MediaPipe exposes face tessellation, eye, iris, contour and face-oval connection sets.

### arturwyroslak/face-to-blendshape-3d (MIT)

Useful reference for the overall single-photo -> face landmarks -> texture-mapped mesh -> GLB/morph-target architecture. The repository demonstrates a 478-landmark face mesh and ARKit-style morph targets. We do **not** use its broad-range eyelid deformation approach because it is too coarse for this portrait.

### pixiv/three-vrm (MIT)

Recommended next-stage runtime if/when the portrait-derived bust is replaced by a hand-cleaned GLB/VRM asset with proper eye geometry, facial blendshapes and a skeleton. That would unlock true eyelid closure, speech visemes and richer body animation without texture warping.

## Interaction design

- Pointer enters avatar area -> attention ramps up.
- Slow pointer movement -> head follows naturally up to a limited yaw/pitch range.
- Fast movement -> lighting reacts first while head movement is damped, avoiding twitching.
- Pointer click -> very small forward focus pulse.
- Pointer leaves -> slow return to center, then subtle idle look behavior.
- Scroll -> minimal whole-bust vertical response.
- `prefers-reduced-motion` -> motion is suppressed.

## Performance

MediaPipe runs once at startup, not every frame. After geometry construction, the render loop is regular Three.js/WebGL. Intersection and document visibility checks pause expensive rendering when the avatar is off screen or the tab is hidden.
