const WORKER_CACHE_VERSION = "galactic-star-map-20260428-density-lod-9";

export const GALACTIC_STAR_MAP_INITIAL_DISTANCE = 18.6;

const COPY = {
  en: {
    boot: "Loading the catalog field",
    firstFrame: "Catalog first light",
    ready: "Drag to orbit. Wheel to scale. Select a star.",
    unsupported:
      "This observatory needs WebGPU, Dedicated Worker and OffscreenCanvas. Open it in a current Chromium browser through a local server.",
    workerLost: "The star map worker stopped unexpectedly."
  },
  zh: {
    boot: "正在载入恒星目录",
    firstFrame: "恒星首帧已可见",
    ready: "拖拽旋转，滚轮缩放，点击恒星飞抵。",
    unsupported:
      "这个观测台需要 WebGPU、Dedicated Worker 和 OffscreenCanvas。请使用新版 Chromium 浏览器并通过本地服务器打开。",
    workerLost: "星图 worker 意外停止。"
  }
};

function languageCopy() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("lang");
  const language = requested || navigator.language || "en";
  return language.toLowerCase().startsWith("zh") ? COPY.zh : COPY.en;
}

function numberParam(params, name, fallback, min, max) {
  const raw = params.get(name);
  if (raw == null || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function boolParam(params, name) {
  const raw = params.get(name);
  return raw === "1" || raw === "true" || raw === "yes";
}

function canvasPoint(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    width: rect.width,
    height: rect.height
  };
}

function scheduleHideStatus(status) {
  window.clearTimeout(scheduleHideStatus.timer);
  scheduleHideStatus.timer = window.setTimeout(() => {
    if (status?.dataset.ready === "true") {
      status.dataset.hidden = "true";
      document.body.classList.add("is-ready");
    }
  }, 5200);
}

function setStatus(status, text, ready = false) {
  if (!status) return;
  status.textContent = text;
  status.dataset.ready = ready ? "true" : "false";
  status.dataset.hidden = "false";
  if (!ready) {
    document.body.classList.remove("is-ready");
  }
  if (ready) scheduleHideStatus(status);
}

function updateScaleAxis(root, state) {
  if (!root || !state) return;
  const progress = Math.max(0, Math.min(1, state.zoomT || 0));
  root.style.setProperty("--scale-progress", progress.toFixed(4));
  root.dataset.lod = state.lod || "Galactic";
  const value = root.querySelector("[data-scale-value]");
  if (value) {
    value.textContent = String(Math.round((1 - progress) * 100));
  }
  const slider = root.querySelector("[role='slider']");
  if (slider) {
    slider.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  }
}

function defaultElement(id, selector) {
  return document.getElementById(id) || document.querySelector(selector);
}

export function bootGalacticStarMap(options = {}) {
  const copy = languageCopy();
  const params = new URLSearchParams(window.location.search);
  const root = options.root || defaultElement("galaxy-shell", ".galaxy-shell");
  const canvas = options.canvas || defaultElement("galaxy-canvas", "canvas");
  const labelCanvas =
    options.labelCanvas || defaultElement("galaxy-labels", ".label-canvas");
  const scaleAxis = options.scaleAxis || defaultElement("scale-axis", ".scale-axis");
  const status = options.status || defaultElement("boot-status", ".boot-status");
  const debugLine = options.debugLine || defaultElement("debug-line", ".debug-line");
  const unsupported = options.unsupported || defaultElement("unsupported", ".unsupported");

  const debug = boolParam(params, "debug");
  const catalog = numberParam(params, "catalog", 0, 1000, 50000);
  const seed = numberParam(params, "seed", 136516, 1, 2147483646);
  const budget = params.get("budget") || "standard";
  const target = params.get("target") || "";

  if (debugLine) {
    debugLine.dataset.enabled = debug ? "true" : "false";
  }
  document.body.classList.toggle("is-debug-map", debug);

  if (!canvas || !labelCanvas || !root) {
    throw new Error("Galactic star map requires scene and label canvases.");
  }

  const hasRequiredRuntime =
    "Worker" in window &&
    "OffscreenCanvas" in window &&
    "transferControlToOffscreen" in HTMLCanvasElement.prototype &&
    "gpu" in navigator;

  if (!hasRequiredRuntime) {
    document.body.classList.add("is-unsupported");
    if (unsupported) {
      unsupported.textContent = copy.unsupported;
      unsupported.dataset.visible = "true";
    }
    setStatus(status, copy.unsupported);
    return { destroy() {} };
  }

  setStatus(status, copy.boot);

  const workerUrl = new URL(
    `./galactic-star-map-worker.js?v=${WORKER_CACHE_VERSION}`,
    import.meta.url
  );
  const worker = new Worker(workerUrl, {
    type: "module",
    name: "galactic-star-map-worker"
  });

  let destroyed = false;
  let pointerId = null;
  let lastPoint = null;
  let totalDrag = 0;
  let downAt = 0;
  let resizeFrame = 0;

  const sceneOffscreen = canvas.transferControlToOffscreen();
  const labelOffscreen = labelCanvas.transferControlToOffscreen();

  function send(type, payload = {}) {
    if (!destroyed) {
      worker.postMessage({ type, ...payload });
    }
  }

  function resize() {
    if (destroyed) return;
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, debug ? 1.75 : 1.5);
      send("resize", {
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
        dpr
      });
    });
  }

  worker.onmessage = (event) => {
    const message = event.data || {};
    if (message.type === "bootProgress") {
      setStatus(status, message.label || copy.boot);
      return;
    }
    if (message.type === "firstFrameReady") {
      setStatus(status, copy.firstFrame);
      return;
    }
    if (message.type === "ready") {
      setStatus(status, copy.ready, true);
      return;
    }
    if (message.type === "state") {
      updateScaleAxis(scaleAxis, message.state);
      if (debug && debugLine) {
        const state = message.state;
        debugLine.textContent = [
          `lod=${state.lod}`,
          `scale=${state.scale.toFixed(2)}`,
          `catalog=${state.catalogCount}`,
          `visible=${state.visibleCatalogCount}`,
          `labels=${state.labelCount}`,
          `fps=${state.fps.toFixed(0)}`,
          `active=${state.activeName}`
        ].join("  ");
      }
      return;
    }
    if (message.type === "error") {
      const text = message.message || copy.unsupported;
      setStatus(status, text);
      document.body.classList.add("is-unsupported");
      if (unsupported) {
        unsupported.textContent = text;
        unsupported.dataset.visible = "true";
      }
    }
  };

  worker.onerror = (error) => {
    setStatus(status, error.message || copy.workerLost);
  };

  worker.postMessage(
    {
      type: "init",
      canvas: sceneOffscreen,
      labels: labelOffscreen,
      config: {
        debug,
        budget,
        catalog,
        seed,
        target,
        initialDistance: GALACTIC_STAR_MAP_INITIAL_DISTANCE,
        language: (navigator.language || "en").toLowerCase()
      }
    },
    [sceneOffscreen, labelOffscreen]
  );

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  window.addEventListener("resize", resize, { passive: true });
  resize();

  canvas.addEventListener("pointerdown", (event) => {
    document.body.classList.add("has-user-input", "is-orbiting");
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    canvas.classList.add("is-dragging");
    lastPoint = canvasPoint(event, canvas);
    totalDrag = 0;
    downAt = performance.now();
    send("pointerdown", lastPoint);
  });

  canvas.addEventListener("pointermove", (event) => {
    const point = canvasPoint(event, canvas);
    if (pointerId === event.pointerId && lastPoint) {
      const dx = point.x - lastPoint.x;
      const dy = point.y - lastPoint.y;
      totalDrag += Math.hypot(dx, dy);
      send("drag", { x: point.x, y: point.y, dx, dy });
      lastPoint = point;
      return;
    }
    send("pointermove", point);
  });

  function endPointer(event) {
    if (pointerId !== event.pointerId) return;
    const point = canvasPoint(event, canvas);
    const elapsed = performance.now() - downAt;
    if (totalDrag < 8 && elapsed < 700) {
      send("tap", point);
    }
    send("pointerup", point);
    document.body.classList.remove("is-orbiting");
    canvas.classList.remove("is-dragging");
    try {
      canvas.releasePointerCapture(pointerId);
    } catch (_error) {
      // Capture may already be released by the browser.
    }
    pointerId = null;
    lastPoint = null;
  }

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", (event) => {
    if (pointerId == null) {
      send("pointerleave", canvasPoint(event, canvas));
    }
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      document.body.classList.add("has-user-input", "is-scale-active");
      window.clearTimeout(canvas.scaleActiveTimer);
      canvas.scaleActiveTimer = window.setTimeout(() => {
        document.body.classList.remove("is-scale-active");
      }, 520);
      const point = canvasPoint(event, canvas);
      send("wheel", {
        x: point.x,
        y: point.y,
        deltaY: event.deltaY,
        ctrlKey: event.ctrlKey
      });
    },
    { passive: false }
  );

  return {
    destroy() {
      destroyed = true;
      window.cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", resize);
      resizeObserver.disconnect();
      worker.terminate();
    }
  };
}
