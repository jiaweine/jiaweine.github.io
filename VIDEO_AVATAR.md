# Digital Human Video Asset

The homepage is now video-first with a safe five-view fallback. When either asset below exists, the site automatically promotes the hero to video mode:

- `assets/avatar/avatar.webm`
- `assets/avatar/avatar.mp4`

## Target clip

Duration: 16–20 seconds, seamless loop, 24 or 30 fps, portrait framing, no camera cuts.

Motion script:

- 0–4s: face camera, subtle breathing only.
- 4–7s: eyes glance slightly left; head stays mostly centered.
- 7–10s: gentle head turn to the right, within about 10–15 degrees.
- 10–13s: return naturally to center.
- 13–16s: extremely subtle smile and slight chin lift.
- 16–20s: settle exactly back into the starting pose for a seamless loop.

Blinking is allowed only when generated as part of the source video with complete eyelid motion. Do not synthesize eyelid movement in browser shaders or distort face pixels.

## Visual continuity

Keep identity, glasses, hairstyle, white over-ear headphones, navy suit, white shirt, black tie, facial proportions, lens shape, hairline and shoulder framing consistent with the approved front portrait.

Background should remain neutral/dark enough for the website lighting layer to remain visible. A transparent-background WebM is preferred when the generation pipeline can produce clean alpha edges.

## Website interaction

The browser runtime intentionally keeps character motion small:

- pointer left/right: whole video container rotates up to about ±2 degrees;
- background moves in the opposite direction for depth;
- near-face pointer proximity adds at most ~1.5% scale;
- fast pointer movement boosts only rim light, HUD and environment response;
- face pixels are never warped.

The multiview avatar remains the automatic fallback if the video asset is missing or cannot play.
