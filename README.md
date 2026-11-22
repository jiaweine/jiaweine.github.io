# Jiawei Wang — AI, NLP & Large Language Models

A research and engineering portfolio focused on **natural language processing (NLP), large language models (LLMs), multimodal AI, and reliable agent systems**.

[**Live Portfolio → jiaweine.github.io**](https://jiaweine.github.io)

## Overview

This site presents my academic interests, selected research, and engineering work through a focused interactive portfolio experience.

The core theme is simple: **build AI systems that are measurable, testable, traceable, and useful beyond the first demo.**

### Focus areas

- **NLP & Large Language Models** — language understanding, LLM reasoning, adaptation, retrieval-augmented generation
- **AI Evaluation** — benchmarks, robustness, reproducibility, experimentation
- **Multimodal AI** — representation learning, fusion, mixture-of-experts
- **Search & Recommendation** — retrieval, ranking, evaluation
- **Agent Systems** — tool orchestration, runtime design, verification, recovery

## Selected work

| Project | Area | Description |
| --- | --- | --- |
| [**KAMEL**](https://github.com/jiaweine/KAMEL) | Multimodal Learning | KAN-Augmented Multimodal Expert Learning for heterogeneous and imbalanced tabular data. |
| [**Recsys Harness**](https://github.com/jiaweine/recsys-harness) | Search & Recommendation | Evidence-first workbench for diagnosis, experimentation, evaluation, and recovery. |
| [**EcomEvo**](https://github.com/jiaweine/EcomEvo-Harness) | Multimodal AI · Full Stack | AI workbench for business decisions with visible evidence and auditable task execution. |
| [**Lingjing · 灵境**](https://github.com/jiaweine/lingjing-game-studio) | Agent Systems | Controllable execution workbench for game development and long-running multimodal tasks. |

## Experience

The portfolio combines a clean editorial/cyber visual language with lightweight interactive motion:

- responsive one-page layout
- scroll-linked reveals and progress feedback
- active section navigation
- interactive cards and magnetic controls
- animated hero experience
- dedicated visual/avatar presentation layer
- reduced-motion support for accessibility preferences
- direct GitHub Pages deployment with no build step

## Tech

- **HTML5** — semantic page structure
- **CSS3** — responsive layout, visual system, transitions, motion
- **JavaScript** — navigation, interaction, animation, visual effects
- **GitHub Pages** — static hosting and delivery

The implementation intentionally stays lightweight and framework-free, making the site easy to deploy, inspect, and iterate on.

## Project structure

```text
.
├── index.html              # Main portfolio page
├── styles.css              # Core visual system
├── main.js                 # Core interactions
├── motion.css              # Cursor light, spotlight and hover presentation
├── motion.js               # Pointer tracking, magnets and reactive canvas field
├── experience-v2.css       # Extended motion / experience styling
├── experience-v2.js        # Extended interaction layer
├── video-avatar.css        # Avatar presentation styling
├── video-avatar.js         # Avatar presentation logic
└── assets/                 # Media and visual assets
```

## Interactive motion

The interaction layer is implemented in native CSS and JavaScript, with no external runtime dependency. On desktop pointer devices it includes a softly eased cursor halo, magnetic controls, spotlight surfaces, subtle tilt, glancing project borders, and a responsive particle field in the hero.

Motion responds to the presence of a fine pointer, pauses when relevant content is outside the viewport, and respects reduced motion preferences. Mobile touch interactions retain the page's static editorial composition.

### Open source design references

These projects informed the interaction direction, but no source files or third party runtime code were copied into this portfolio.

- [Codrops MagneticButtons](https://github.com/codrops/MagneticButtons) for magnetic control behavior
- [HoverUI](https://github.com/raqibnur/hoverui) for spotlight surface patterns and thoughtful interaction timing
- [Interactive Spotlight Effect](https://github.com/FelippeCav/interactive-spotlight-effect) for pointer directed light

## Local preview

Clone the repository and start any static HTTP server from the project root:

```bash
git clone https://github.com/jiaweine/jiaweine.github.io.git
cd jiaweine.github.io
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Research profile

The portfolio is built around practical AI research and production-minded engineering — from models and evaluation to runtimes, interfaces, and verifiable execution.

**Research · Build · Measure · Iterate**
