# Packmates: the scroll-through tour

A one-page site for [Packmates](https://www.packmates.live): meetups made simple. Scrolling plays a six-scene
walkthrough of the app: pins pop onto an empty map; zoom into one and its card opens; a thumb taps "I'm in" and
faces stack up; a clock runs to Saturday 8:00 and the faces become five people running; the pin's badge changes to
coffee, a walk and a kickabout; then the camera pulls back to a world map full of pins and the Post button lights up.

The map scenes are drawn in the page (SVG and HTML, `js/mapui.js`) so they stay sharp on any screen; the people
and places are a small 3D world (`js/tour.js`).

No build step: plain HTML, CSS and JavaScript, with [three.js](https://threejs.org) (MIT) kept in `js/vendor`.

- `index.html`: the page and all its words. Each `.cap` card has `data-from` / `data-to`: the part of the scroll it shows for.
- `css/styles.css`: the look. Colours and type follow packmates.live.
- `js/mapui.js`: scenes 1 to 4 (map, card, thumb, clock) and the changing pin of scene 5.
- `js/tour.js`: the 3D world, the people and the camera path (`SHOTS`); `SEG` says which parts of it the scroll plays.
- `js/land.js`: the dotted world map (made from Natural Earth land, public domain).
- `js/main.js`: starts the tour where the browser can draw it, and fades in the lower sections.

Browsers without WebGL, and visitors who ask for less motion, get the same words as a still page.
`?3d=1` forces the tour on and `?3d=0` switches it off.

To look at it locally: `python3 -m http.server` in this folder, then open http://localhost:8000.

The scenes and the pins on the map are an illustration, not live data.
