const VERSION = "new-universe-galaxy-20260428a";

const COPY = {
  en: {
    boot: "Building the galaxy catalog",
    firstLight: "Catalog first light",
    ready: "Drag to orbit. Wheel to scale. Select a star.",
    unsupported:
      "This observatory needs Dedicated Worker and OffscreenCanvas. Open it in a current browser through a local server.",
    workerLost: "The galaxy worker stopped unexpectedly."
  },
  zh: {
    boot: "正在生成银河目录",
    firstLight: "恒星首帧已可见",
    ready: "拖拽旋转，滚轮缩放，点击恒星飞抵。",
    unsupported:
      "这个观测台需要 Dedicated Worker 和 OffscreenCanvas。请使用新版浏览器并通过本地服务器打开。",
    workerLost: "银河 worker 意外停止。"
  }
};

function textPack() {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang") || navigator.language || "en";
  return lang.toLowerCase().startsWith("zh") ? COPY.zh : COPY.en;
}

function boolParam(params, key) {
  const value = params.get(key);
  return value === "1" || value === "true" || value === "yes";
}

function intParam(params, key, fallback, min, max) {
  const raw = params.get(key);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function pointFromEvent(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    width: rect.width,
    height: rect.height
  };
}

function setStatus(element, text, ready = false) {
  if (!element) return;
  element.textContent = text;
  element.dataset.hidden = "false";
  if (ready) {
    window.clearTimeout(setStatus.timer);
    setStatus.timer = window.setTimeout(() => {
      element.dataset.hidden = "true";
    }, 5200);
  }
}

function updateScale(element, state) {
  if (!element || !state) return;
  element.style.setProperty("--zoom-position", String(Math.max(0, Math.min(1, state.zoomT))));
  element.dataset.lod = state.lod;
}

export function bootNewUniverse(options) {
  const params = new URLSearchParams(window.location.search);
  const copy = textPack();
  const canvas = options.canvas;
  const status = options.status;
  const debug = options.debug;
  const unsupported = options.unsupported;
  const scale = options.scale;
  const debugEnabled = boolParam(params, "debug");

  if (debug) debug.dataset.enabled = debugEnabled ? "true" : "false";

  const hasRuntime =
    "Worker" in window &&
    "OffscreenCanvas" in window &&
    "transferControlToOffscreen" in HTMLCanvasElement.prototype;

  if (!hasRuntime) {
    setStatus(status, copy.unsupported);
    if (unsupported) {
      unsupported.textContent = copy.unsupported;
      unsupported.dataset.visible = "true";
    }
    return { destroy() {} };
  }

  setStatus(status, copy.boot);

  const workerUrl = new URL(`./stellar-observatory-worker.js?v=${VERSION}`, import.meta.url);
  const worker = new Worker(workerUrl, {
    type: "module",
    name: "new-universe-galaxy-worker"
  });
  const offscreen = canvas.transferControlToOffscreen();
  let pointerId = null;
  let lastPoint = null;
  let dragDistance = 0;
  let downAt = 0;
  let resizeFrame = 0;
  let destroyed = false;

  function send(type, payload = {}) {
    if (!destroyed) worker.postMessage({ type, ...payload });
  }

  function resize() {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      const rect = canvas.getBoundingClientRect();
      send("resize", {
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
        dpr: Math.min(window.devicePixelRatio || 1, debugEnabled ? 1.5 : 1.35)
      });
    });
  }

  worker.onmessage = (event) => {
    const message = event.data || {};
    if (message.type === "boot") {
      setStatus(status, message.label || copy.boot);
      return;
    }
    if (message.type === "firstLight") {
      setStatus(status, copy.firstLight);
      return;
    }
    if (message.type === "ready") {
      setStatus(status, copy.ready, true);
      return;
    }
    if (message.type === "state") {
      updateScale(scale, message.state);
      if (debugEnabled && debug) {
        const state = message.state;
        debug.textContent = [
          `lod=${state.lod}`,
          `scale=${state.scale.toFixed(2)}`,
          `catalog=${state.catalog}`,
          `draw=${state.draw}`,
          `labels=${state.labels}`,
          `fps=${state.fps.toFixed(0)}`,
          `active=${state.active}`
        ].join("  ");
      }
      return;
    }
    if (message.type === "error") {
      const text = message.message || copy.workerLost;
      setStatus(status, text);
      if (unsupported) {
        unsupported.textContent = text;
        unsupported.dataset.visible = "true";
      }
    }
  };

  worker.onerror = (event) => {
    setStatus(status, event.message || copy.workerLost);
  };

  worker.postMessage(
    {
      type: "init",
      canvas: offscreen,
      config: {
        debug: debugEnabled,
        budget: params.get("budget") || "standard",
        catalog: intParam(params, "catalog", 0, 1000, 50000),
        seed: intParam(params, "seed", 481516, 1, 2147483646),
        target: params.get("target") || "",
        language: (navigator.language || "en").toLowerCase()
      }
    },
    [offscreen]
  );

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener("resize", resize, { passive: true });
  resize();

  canvas.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    canvas.classList.add("is-dragging");
    lastPoint = pointFromEvent(event, canvas);
    dragDistance = 0;
    downAt = performance.now();
    send("pointerdown", lastPoint);
  });

  canvas.addEventListener("pointermove", (event) => {
    const point = pointFromEvent(event, canvas);
    if (pointerId === event.pointerId && lastPoint) {
      const dx = point.x - lastPoint.x;
      const dy = point.y - lastPoint.y;
      dragDistance += Math.hypot(dx, dy);
      send("drag", { ...point, dx, dy });
      lastPoint = point;
      return;
    }
    send("pointermove", point);
  });

  function finishPointer(event) {
    if (pointerId !== event.pointerId) return;
    const point = pointFromEvent(event, canvas);
    if (dragDistance < 8 && performance.now() - downAt < 700) {
      send("tap", point);
    }
    send("pointerup", point);
    try {
      canvas.releasePointerCapture(pointerId);
    } catch (_error) {
      // The browser may release capture before pointercancel.
    }
    canvas.classList.remove("is-dragging");
    pointerId = null;
    lastPoint = null;
  }

  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", finishPointer);
  canvas.addEventListener("pointerleave", (event) => {
    if (pointerId == null) send("pointerleave", pointFromEvent(event, canvas));
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      send("wheel", {
        ...pointFromEvent(event, canvas),
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
      observer.disconnect();
      worker.terminate();
    }
  };
}
