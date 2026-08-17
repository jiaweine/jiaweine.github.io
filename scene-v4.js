import './scene-rocketbox-v3.js';

document.querySelector('.scene-topline span:first-child')?.replaceChildren(document.createTextNode('RIGGED DIGITAL PORTRAIT'));
const attribution = document.querySelector('.footer small');
if (attribution) attribution.textContent = 'Realtime character base derived from Microsoft Rocketbox, licensed under MIT.';
