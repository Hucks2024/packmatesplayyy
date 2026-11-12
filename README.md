# Packmates: the scroll-through tour

A one-page site for [Packmates](https://www.packmates.live). Scrolling moves a camera through a small 3D world
that shows how the app works: someone posts a meetup on their phone; the camera goes through the screen to someone
across town, low and in bed, who taps "I'm in"; the night goes by on the wall clock; and at 8:00 the two meet in
the park and the group is out on a run. Then coffee, a walk and a kickabout, and the camera pulls back
until the whole world map and its pins are in view.

No build step: plain HTML, CSS and JavaScript, with [three.js](https://threejs.org) (MIT) kept in `js/vendor`.

- `index.html`: the page and all its words. Each `.cap` card has `data-from` / `data-to`: the part of the scroll it shows for.
- `css/styles.css`: the look. Colours and type follow packmates.live.
- `js/tour.js`: the 3D world, the people, the phone screen and the camera path (`SHOTS`).
- `js/land.js`: the dotted world map (made from Natural Earth land, public domain).
- `js/main.js`: starts the tour where the browser can draw it, and fades in the lower sections.

Browsers without WebGL, and visitors who ask for less motion, get the same words as a still page.
`?3d=1` forces the tour on and `?3d=0` switches it off.

To look at it locally: `python3 -m http.server` in this folder, then open http://localhost:8000.

The scenes and the pins on the map are an illustration, not live data.
