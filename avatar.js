// True 3D avatar entrypoint. The former image-warp and first-pass mesh runtimes are retired.
const shell = document.querySelector('[data-avatar-shell]');
const topMeta = shell?.querySelectorAll('.avatar-meta-top span');
const bottomMeta = shell?.querySelectorAll('.avatar-meta-bottom span');
if (topMeta?.[1]) topMeta[1].textContent = 'MEDIAPIPE FACE MESH + EYE RIG';
if (bottomMeta?.[0]) bottomMeta[0].textContent = 'MOVE POINTER — EYES LEAD, HEAD FOLLOWS';
if (bottomMeta?.[1]) bottomMeta[1].textContent = '3D FACE · EYES · HEADPHONES · BUST';
import './avatar-v2.js';
