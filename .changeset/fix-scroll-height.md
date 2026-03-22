---
"@vimee/shiki-editor": patch
---

Fix editor auto-scroll by adding `height: 100%` to `.sv-container`. Without this, the code area expanded to fit all content and `overflow: auto` never triggered, breaking auto-scroll on cursor movement (G, gg, search), H/M/L viewport motions, and Ctrl-F/B/U/D page scrolling.
