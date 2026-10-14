# R-004: Desktop and phone show one map

- **Decided:** 2026-09-18, Standing rule
- **Status:** To confirm
- **Source:** DEV_LOG current-state summary ("STANDING RULE (2026-09-18)")
- **Enforced by:** no test yet

Every map icon, colour and behaviour looks the same on a phone as on a desktop; the desktop is the specification. Phones lack symbol fonts, so every new map marker is drawn as an SVG path, not a font glyph. Any change to the map, legend, popup or report scrolling is checked at phone width (390px).
