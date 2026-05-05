const VERSION = "newnew-stars-observatory-20260501z";

const COPY = {
  en: {
    boot: "Building the catalog field",
    firstLight: "Catalog first light",
    ready: "Drag to orbit. Wheel to scale. Select a star.",
    unsupported:
      "This observatory needs WebGPU, Dedicated Worker and OffscreenCanvas. Open it in a current Chromium browser through a local server.",
    workerLost: "The star map worker stopped unexpectedly."
  },
  zh: {
    boot: "正在生成恒星目录",
    firstLight: "恒星首帧已可见",
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

function boolParam(params, key) {
  const value = params.get(key);
  return value === "1" || value === "true" || value === "yes";
}

function intParam(params, key, fallback, min, max) {
  const raw = params.get(key);
  if (raw == null || raw === "") return fallback;
  if (!/^-?\d+$/.test(raw)) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function formatDebugNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) return value.toExponential(2);
  return value.toFixed(digits);
}

function canvasPoint(event, canvas) {
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

function updateScaleAxis(element, state) {
  if (!element || !state) return;
  let progress = state.scaleAxisProgress ?? state.zoomT ?? 0;
  progress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  element.style.setProperty("--scale-progress", progress.toFixed(4));
  element.dataset.lod = state.lod || "Galactic";
  element.dataset.stage = state.scaleStage || state.lod || "Galactic";
}

const DEBUG_TEXT_FIELDS = ["starModel", "stellarMaterial"];
const DEBUG_NUMBER_FIELDS = [
  ["rotationPhase", 3],
  ["activity", 2],
  ["bridge", 2],
  ["regionalBridgePresence", 2],
  ["localMapBridgePresence", 2],
  ["activeBridgePresence", 2],
  ["exposure", 2],
  ["globalVeilPresence", 2],
  ["overlayHazeBudget", 2],
  ["localReference", 2],
  ["localApproach", 2],
  ["scaleDepth", 3],
  ["scaleAxisProgress", 3],
  ["metricCatalogPresence", 2],
  ["metricLayerPresence", 2],
  ["metricLayerPointScale", 2],
  ["metricLayerHaloScale", 2],
  ["metricPsfContinuity", 2],
  ["metricLayerLabelWeight", 2],
  ["metricLayerPickWeight", 2],
  ["metricLayerOpacity", 2],
  ["metricCoreVisibility", 2],
  ["metricCoreRadiusScale", 2],
  ["galacticLayerPresence", 2],
  ["galacticLayerPointScale", 2],
  ["galacticLayerHaloScale", 2],
  ["galacticLayerLabelWeight", 2],
  ["galacticLayerPickWeight", 2],
  ["regionalLayerPresence", 2],
  ["regionalLayerPointScale", 2],
  ["regionalLayerHaloScale", 2],
  ["regionalLayerLabelWeight", 2],
  ["regionalLayerPickWeight", 2],
  ["localMapLayerPresence", 2],
  ["localMapLayerPointScale", 2],
  ["localMapLayerHaloScale", 2],
  ["localMapLayerLabelWeight", 2],
  ["localMapLayerPickWeight", 2],
  ["localSystemLayerPresence", 2],
  ["localSystemLayerPointScale", 2],
  ["localSystemLayerHaloScale", 2],
  ["localSystemLayerLabelWeight", 2],
  ["localSystemLayerPickWeight", 2],
  ["surfaceLayerPresence", 2],
  ["surfaceLayerPointScale", 2],
  ["surfaceLayerHaloScale", 2],
  ["surfaceLayerLabelWeight", 2],
  ["surfaceLayerPickWeight", 2],
  ["celestialBackdropPresence", 2],
  ["localSystemPresence", 2],
  ["surfaceViewRadiusStarR", 2],
  ["surfaceReadiness", 2],
  ["surfaceDepth", 2],
  ["contextScale", 2],
  ["activeImpostorScale", 2],
  ["activeHaloRatio", 2],
  ["approach", 2],
  ["surface", 2],
  ["surfacePresence", 2],
  ["scaleTarget", "compact"],
  ["cameraFov", 2],
  ["distance", 1],
  ["distanceTarget", 1],
  ["surfaceRadius", 1],
  ["sphereRadius", 4],
  ["sphereScreenRadius", 1],
  ["sphereTriangles", 0],
  ["sphereDraw", 0],
  ["sphereVisibility", 2],
  ["localMapContext", 2],
  ["activeX", 1],
  ["activeY", 1],
  ["activeLabelX", 1],
  ["activeLabelY", 1]
];

function appendDebugFields(lines, state) {
  for (const key of DEBUG_TEXT_FIELDS) {
    if (state[key]) lines.push(`${key}=${state[key]}`);
  }
  for (const [key, digits] of DEBUG_NUMBER_FIELDS) {
    const value = state[key];
    if (!Number.isFinite(value)) continue;
    const formatted = digits === "compact" ? formatDebugNumber(value) : value.toFixed(digits);
    lines.push(`${key}=${formatted}`);
  }
}

export function bootStarsObservatory(options) {
  const params = new URLSearchParams(window.location.search);
  const copy = languageCopy();
  const scene = options.scene;
  const labelCanvas = options.labels;
  const status = options.status;
  const debug = options.debug;
  const unsupported = options.unsupported;
  const scaleAxis = options.scaleAxis;
  const debugEnabled = boolParam(params, "debug");

  if (debug) debug.dataset.enabled = debugEnabled ? "true" : "false";

  const hasRuntime =
    "Worker" in window &&
    "OffscreenCanvas" in window &&
    "transferControlToOffscreen" in HTMLCanvasElement.prototype &&
    "gpu" in navigator;

  if (!scene || !labelCanvas) {
    throw new Error("The stars observatory requires a scene canvas and a label canvas.");
  }

  if (!hasRuntime) {
    setStatus(status, copy.unsupported);
    if (unsupported) {
      unsupported.textContent = copy.unsupported;
      unsupported.dataset.visible = "true";
    }
    return { destroy() {} };
  }

  setStatus(status, copy.boot);

  const workerCacheKey = `${VERSION}-${Date.now().toString(36)}`;
  const workerUrl = new URL("./stars-observatory-worker.js", import.meta.url);
  workerUrl.searchParams.set("v", workerCacheKey);
  const worker = new Worker(workerUrl, {
    type: "module",
    name: "newnew-stars-observatory-worker"
  });

  const sceneOffscreen = scene.transferControlToOffscreen();
  const labelsOffscreen = labelCanvas.transferControlToOffscreen();
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
    if (destroyed) return;
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      const rect = scene.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, debugEnabled ? 1.35 : 1.25);
      send("resize", {
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
        dpr
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
      updateScaleAxis(scaleAxis, message.state);
      if (debugEnabled && debug) {
        const state = message.state;
        const lines = [
          `version=${VERSION}`,
          `lod=${state.lod}`,
          `scaleStage=${state.scaleStage || state.lod}`,
          `scale=${formatDebugNumber(state.scale)}`,
          `catalog=${state.catalog}`,
          `draw=${state.draw}`,
          `labels=${state.labels}`,
          `gpu=${state.gpu}`,
          `fps=${state.fps.toFixed(0)}`,
          `active=${state.active}`
        ];
        appendDebugFields(lines, state);
        debug.textContent = lines.join("  ");
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
      scene: sceneOffscreen,
      labels: labelsOffscreen,
      config: {
        debug: debugEnabled,
        budget: params.get("budget") || "standard",
        catalog: intParam(params, "catalog", 0, 1000, 50000),
        seed: intParam(params, "seed", 728281, 1, 2147483646),
        target: params.get("target") || "",
        language: (navigator.language || "en").toLowerCase()
      }
    },
    [sceneOffscreen, labelsOffscreen]
  );

  const observer = new ResizeObserver(resize);
  observer.observe(scene);
  window.addEventListener("resize", resize, { passive: true });
  resize();

  scene.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    scene.setPointerCapture(pointerId);
    scene.classList.add("is-dragging");
    lastPoint = canvasPoint(event, scene);
    dragDistance = 0;
    downAt = performance.now();
    send("pointerdown", lastPoint);
  });

  scene.addEventListener("pointermove", (event) => {
    const point = canvasPoint(event, scene);
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
    const point = canvasPoint(event, scene);
    if (dragDistance < 8 && performance.now() - downAt < 700) {
      send("tap", point);
    }
    send("pointerup", point);
    try {
      scene.releasePointerCapture(pointerId);
    } catch (_error) {
      // Pointer capture may already be released after a cancellation.
    }
    scene.classList.remove("is-dragging");
    pointerId = null;
    lastPoint = null;
  }

  scene.addEventListener("pointerup", finishPointer);
  scene.addEventListener("pointercancel", finishPointer);
  scene.addEventListener("pointerleave", (event) => {
    if (pointerId == null) send("pointerleave", canvasPoint(event, scene));
  });

  scene.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      send("wheel", {
        ...canvasPoint(event, scene),
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
