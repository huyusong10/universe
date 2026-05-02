const VERSION = "newnew-stars-observatory-20260501e";

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
        if (state.starModel) lines.push(`starModel=${state.starModel}`);
        if (state.stellarMaterial) lines.push(`stellarMaterial=${state.stellarMaterial}`);
        if (Number.isFinite(state.rotationPhase)) lines.push(`rotationPhase=${state.rotationPhase.toFixed(3)}`);
        if (Number.isFinite(state.activity)) lines.push(`activity=${state.activity.toFixed(2)}`);
        if (Number.isFinite(state.bridge)) lines.push(`bridge=${state.bridge.toFixed(2)}`);
        if (Number.isFinite(state.exposure)) lines.push(`exposure=${state.exposure.toFixed(2)}`);
        if (Number.isFinite(state.localReference)) lines.push(`localReference=${state.localReference.toFixed(2)}`);
        if (Number.isFinite(state.localApproach)) lines.push(`localApproach=${state.localApproach.toFixed(2)}`);
        if (Number.isFinite(state.scaleDepth)) lines.push(`scaleDepth=${state.scaleDepth.toFixed(3)}`);
        if (Number.isFinite(state.scaleAxisProgress)) lines.push(`scaleAxisProgress=${state.scaleAxisProgress.toFixed(3)}`);
        if (Number.isFinite(state.metricCatalogPresence)) lines.push(`metricCatalogPresence=${state.metricCatalogPresence.toFixed(2)}`);
        if (Number.isFinite(state.metricLayerPresence)) lines.push(`metricLayerPresence=${state.metricLayerPresence.toFixed(2)}`);
        if (Number.isFinite(state.metricLayerPointScale)) lines.push(`metricLayerPointScale=${state.metricLayerPointScale.toFixed(2)}`);
        if (Number.isFinite(state.metricLayerHaloScale)) lines.push(`metricLayerHaloScale=${state.metricLayerHaloScale.toFixed(2)}`);
        if (Number.isFinite(state.metricLayerLabelWeight)) lines.push(`metricLayerLabelWeight=${state.metricLayerLabelWeight.toFixed(2)}`);
        if (Number.isFinite(state.metricLayerPickWeight)) lines.push(`metricLayerPickWeight=${state.metricLayerPickWeight.toFixed(2)}`);
        if (Number.isFinite(state.metricLayerOpacity)) lines.push(`metricLayerOpacity=${state.metricLayerOpacity.toFixed(2)}`);
        if (Number.isFinite(state.galacticLayerPresence)) lines.push(`galacticLayerPresence=${state.galacticLayerPresence.toFixed(2)}`);
        if (Number.isFinite(state.galacticLayerPointScale)) lines.push(`galacticLayerPointScale=${state.galacticLayerPointScale.toFixed(2)}`);
        if (Number.isFinite(state.galacticLayerHaloScale)) lines.push(`galacticLayerHaloScale=${state.galacticLayerHaloScale.toFixed(2)}`);
        if (Number.isFinite(state.galacticLayerLabelWeight)) lines.push(`galacticLayerLabelWeight=${state.galacticLayerLabelWeight.toFixed(2)}`);
        if (Number.isFinite(state.galacticLayerPickWeight)) lines.push(`galacticLayerPickWeight=${state.galacticLayerPickWeight.toFixed(2)}`);
        if (Number.isFinite(state.regionalLayerPresence)) lines.push(`regionalLayerPresence=${state.regionalLayerPresence.toFixed(2)}`);
        if (Number.isFinite(state.regionalLayerPointScale)) lines.push(`regionalLayerPointScale=${state.regionalLayerPointScale.toFixed(2)}`);
        if (Number.isFinite(state.regionalLayerHaloScale)) lines.push(`regionalLayerHaloScale=${state.regionalLayerHaloScale.toFixed(2)}`);
        if (Number.isFinite(state.regionalLayerLabelWeight)) lines.push(`regionalLayerLabelWeight=${state.regionalLayerLabelWeight.toFixed(2)}`);
        if (Number.isFinite(state.regionalLayerPickWeight)) lines.push(`regionalLayerPickWeight=${state.regionalLayerPickWeight.toFixed(2)}`);
        if (Number.isFinite(state.localMapLayerPresence)) lines.push(`localMapLayerPresence=${state.localMapLayerPresence.toFixed(2)}`);
        if (Number.isFinite(state.localMapLayerPointScale)) lines.push(`localMapLayerPointScale=${state.localMapLayerPointScale.toFixed(2)}`);
        if (Number.isFinite(state.localMapLayerHaloScale)) lines.push(`localMapLayerHaloScale=${state.localMapLayerHaloScale.toFixed(2)}`);
        if (Number.isFinite(state.localMapLayerLabelWeight)) lines.push(`localMapLayerLabelWeight=${state.localMapLayerLabelWeight.toFixed(2)}`);
        if (Number.isFinite(state.localMapLayerPickWeight)) lines.push(`localMapLayerPickWeight=${state.localMapLayerPickWeight.toFixed(2)}`);
        if (Number.isFinite(state.localSystemLayerPresence)) lines.push(`localSystemLayerPresence=${state.localSystemLayerPresence.toFixed(2)}`);
        if (Number.isFinite(state.localSystemLayerPointScale)) lines.push(`localSystemLayerPointScale=${state.localSystemLayerPointScale.toFixed(2)}`);
        if (Number.isFinite(state.localSystemLayerLabelWeight)) lines.push(`localSystemLayerLabelWeight=${state.localSystemLayerLabelWeight.toFixed(2)}`);
        if (Number.isFinite(state.localSystemLayerPickWeight)) lines.push(`localSystemLayerPickWeight=${state.localSystemLayerPickWeight.toFixed(2)}`);
        if (Number.isFinite(state.surfaceLayerPresence)) lines.push(`surfaceLayerPresence=${state.surfaceLayerPresence.toFixed(2)}`);
        if (Number.isFinite(state.surfaceLayerPointScale)) lines.push(`surfaceLayerPointScale=${state.surfaceLayerPointScale.toFixed(2)}`);
        if (Number.isFinite(state.surfaceLayerLabelWeight)) lines.push(`surfaceLayerLabelWeight=${state.surfaceLayerLabelWeight.toFixed(2)}`);
        if (Number.isFinite(state.surfaceLayerPickWeight)) lines.push(`surfaceLayerPickWeight=${state.surfaceLayerPickWeight.toFixed(2)}`);
        if (Number.isFinite(state.celestialBackdropPresence)) lines.push(`celestialBackdropPresence=${state.celestialBackdropPresence.toFixed(2)}`);
        if (Number.isFinite(state.localSystemPresence)) lines.push(`localSystemPresence=${state.localSystemPresence.toFixed(2)}`);
        if (Number.isFinite(state.surfaceViewRadiusStarR)) lines.push(`surfaceViewRadiusStarR=${state.surfaceViewRadiusStarR.toFixed(2)}`);
        if (Number.isFinite(state.contextScale)) lines.push(`contextScale=${state.contextScale.toFixed(2)}`);
        if (Number.isFinite(state.activeImpostorScale)) lines.push(`activeImpostorScale=${state.activeImpostorScale.toFixed(2)}`);
        if (Number.isFinite(state.approach)) lines.push(`approach=${state.approach.toFixed(2)}`);
        if (Number.isFinite(state.surface)) lines.push(`surface=${state.surface.toFixed(2)}`);
        if (Number.isFinite(state.surfacePresence)) lines.push(`surfacePresence=${state.surfacePresence.toFixed(2)}`);
        if (Number.isFinite(state.scaleTarget)) lines.push(`scaleTarget=${formatDebugNumber(state.scaleTarget)}`);
        if (Number.isFinite(state.cameraFov)) lines.push(`cameraFov=${state.cameraFov.toFixed(2)}`);
        if (Number.isFinite(state.distance)) lines.push(`distance=${state.distance.toFixed(1)}`);
        if (Number.isFinite(state.distanceTarget)) lines.push(`distanceTarget=${state.distanceTarget.toFixed(1)}`);
        if (Number.isFinite(state.surfaceRadius)) lines.push(`surfaceRadius=${state.surfaceRadius.toFixed(1)}`);
        if (Number.isFinite(state.sphereRadius)) lines.push(`sphereRadius=${state.sphereRadius.toFixed(4)}`);
        if (Number.isFinite(state.sphereScreenRadius)) lines.push(`sphereScreenRadius=${state.sphereScreenRadius.toFixed(1)}`);
        if (Number.isFinite(state.sphereTriangles)) lines.push(`sphereTriangles=${state.sphereTriangles.toFixed(0)}`);
        if (Number.isFinite(state.sphereDraw)) lines.push(`sphereDraw=${state.sphereDraw.toFixed(0)}`);
        if (Number.isFinite(state.sphereVisibility)) lines.push(`sphereVisibility=${state.sphereVisibility.toFixed(2)}`);
        if (Number.isFinite(state.localMapContext)) lines.push(`localMapContext=${state.localMapContext.toFixed(2)}`);
        if (Number.isFinite(state.activeX)) lines.push(`activeX=${state.activeX.toFixed(1)}`);
        if (Number.isFinite(state.activeY)) lines.push(`activeY=${state.activeY.toFixed(1)}`);
        if (Number.isFinite(state.activeLabelX)) lines.push(`activeLabelX=${state.activeLabelX.toFixed(1)}`);
        if (Number.isFinite(state.activeLabelY)) lines.push(`activeLabelY=${state.activeLabelY.toFixed(1)}`);
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
