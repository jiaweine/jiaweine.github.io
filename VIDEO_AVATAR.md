# Interactive Avatar Experience

The homepage hero includes a responsive digital-human presentation layer designed to feel integrated with the surrounding interface rather than behave like a standalone media element.

## Experience design

The avatar combines a looping portrait animation with pointer-aware motion, lighting response, depth cues, and the broader hero environment.

Key behaviors include:

- subtle pointer-linked orientation and depth response
- proximity-based focus treatment around the portrait
- velocity-sensitive lighting and interface energy
- smooth spring-style interpolation for natural motion
- visibility-aware playback behavior
- motion preferences that respect `prefers-reduced-motion`

The result is a restrained interactive presence that supports the portfolio's visual identity without competing with the research and project content.

## Visual direction

The avatar is designed around a consistent visual language:

- dark editorial / cyber interface
- clean portrait framing
- restrained camera motion
- soft environmental lighting
- high-contrast typography and UI details
- coordinated motion between the portrait and surrounding hero elements

Identity, wardrobe, headphones, framing, and lighting are kept visually consistent so the hero reads as one coherent composition.

## Runtime structure

The experience is separated into three layers:

```text
assets/avatar/avatar.mp4   # portrait motion asset
video-avatar.css           # presentation and visual treatment
video-avatar.js            # interaction and playback behavior
```

`video-avatar.js` tracks pointer position and movement energy, then exposes normalized interaction values to the presentation layer. CSS uses those values to coordinate transform, focus, lighting, and surrounding visual effects.

This keeps the interaction layer lightweight while allowing the visual treatment to evolve independently.

## Interaction model

Pointer movement across the hero influences several presentation signals:

1. horizontal and vertical position are normalized relative to the avatar stage;
2. movement velocity contributes to the environment's visual energy;
3. pointer proximity contributes to portrait focus;
4. values are smoothly interpolated before being applied to the visual layer;
5. the experience returns naturally toward its resting state when interaction ends.

The motion system is intentionally subtle, preserving readability and keeping the portfolio content as the primary focus.

## Performance

The avatar experience uses native browser video, CSS transforms, and a compact JavaScript interaction loop. Playback responds to page visibility and viewport presence, helping keep runtime work aligned with what is actually visible on screen.

## Role in the portfolio

The avatar is one part of a broader interaction system that includes scroll reveals, active navigation, magnetic controls, project-card motion, and responsive layout behavior.

Together, these elements create a portfolio that presents research and engineering work through a polished, cohesive interactive interface.