# New Universe Galactic Observatory

This folder is a clean-room prototype for a scalable galactic star map. It does not depend on the previous Universe OS template runtime, styles, catalog model, or page shell.

## Stable Contract

| Boundary | Contract |
| --- | --- |
| Entry | `index.html` opens directly through a local static server and starts in the `Galactic` scale. |
| Runtime split | The main thread owns only the canvas element, pointer/wheel input, a small scale axis, loading text, and optional debug text. Catalog generation, rendering, LOD, labels, picking, and camera motion run in a dedicated worker. |
| Catalog | `standard=10000`, `safe=6000`, and `immersive=20000` are supported. `?catalog=50000` increases the generated catalog while visible draw, label, and picking budgets stay fixed. |
| Visual source | All bright stars, halos, labels, hover states, hit targets, and focus flights are derived from the same catalog star indices. Low-brightness dust, dark lanes, and a fixed-budget faint backdrop may add depth and prevent empty black regions, but they cannot become primary targets. |
| Galaxy field | The default field is a non-uniform galaxy: a dense warm core, flattened stellar band, asymmetric spiral arms, local clusters, dust gaps, and sparse outer anchors. It must not look like a uniform sphere, round plate, square patch, or floor grid. |
| LOD | `Galactic`, `Regional`, and `Local` are continuous zoom ranges. `Galactic` shows a dense catalog-driven galaxy band with low-bright dust and faint surrounding stars, and its zoom-out limit keeps the density field readable instead of collapsing into empty deep space. `Regional` increases star count, labels, and subtle map reference rings; `Local` recenters the active catalog star, dims the background, and expands it into a reachable stellar disk. A star changes size, alpha, halo, label weight, pick radius, and close-up disk from the same index; it is not replaced by a different decorative layer. |
| Labels | Labels are worker-rendered map annotations. Active and hover labels are always visible; Galactic shows about 8-16 labels, Regional about 24-60, and Local shows active plus near neighbors. Dragging, zooming, and flight must not reshuffle labels every frame. |
| Interaction | Idle state has slow orbit. Dragging rotates the star map with inertia. Wheel zoom is continuous and uses the cursor as a weak anchor. Clicking either a star halo or label flies to that catalog star. |
| Performance | There are no DOM stars and no per-star mesh/material objects. The worker uses typed arrays and fixed draw/label/pick budgets so catalog size does not linearly grow main-thread work. |

## Files

| File | Role |
| --- | --- |
| `index.html` | Immersive shell, canvas, scale axis, loading, and debug text |
| `assets/stellar-observatory-runtime.js` | Main-thread input and worker messaging |
| `assets/stellar-observatory-worker.js` | Catalog generator, camera, renderer, LOD, picking, and labels |

## Preview

```bash
cd /Users/hys/dev/Sediment/design/new-universe
python3 -m http.server 9020
```

Then open:

- [http://127.0.0.1:9020/](http://127.0.0.1:9020/)
