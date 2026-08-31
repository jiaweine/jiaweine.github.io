// True 3D avatar entrypoint. The former 2.5D image-warp implementation is intentionally retired.
const shell = document.querySelector('[data-avatar-shell]');
const topMeta = shell?.querySelectorAll('.avatar-meta-top span');
const bottomMeta = shell?.querySelectorAll('.avatar-meta-bottom span');
if (topMeta?.[1]) topMeta[1].textContent = 'MEDIAPIPE FACE MESH';
if (bottomMeta?.[0]) bottomMeta[0].textContent = 'MOVE POINTER — AVATAR TRACKS ATTENTION';
if (bottomMeta?.[1]) bottomMeta[1].textContent = '478 LANDMARKS · REAL GEOMETRY';
import './avatar-true3d.js';
