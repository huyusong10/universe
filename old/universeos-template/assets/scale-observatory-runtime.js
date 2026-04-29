export const SCALE_OBSERVATORY_MIN_DISTANCE = 24;
export const SCALE_OBSERVATORY_MAX_DISTANCE = 40000;

export const SCALE_TARGETS = [
    {
        id: "helios",
        name: "Helios Archive",
        spectrum: "G2 V",
        spectralIndex: 0.66,
        radius: 1.0,
        position: [0, 0, 0],
        summary: "A warm main-sequence anchor for stable knowledge, close reading, and surface-scale inspection.",
        palette: ["#260805", "#8e2f12", "#f08b35", "#ffd27a", "#fff8dd"],
        stability: "Calm"
    },
    {
        id: "sirius",
        name: "Sirius Index",
        spectrum: "A1 V",
        spectralIndex: 0.2,
        radius: 0.82,
        position: [6800, -950, -8200],
        summary: "A blue-white navigation star for search, retrieval, and fast index traversal.",
        palette: ["#07172e", "#195f9a", "#7fc9ff", "#dff4ff", "#ffffff"],
        stability: "Sharp"
    },
    {
        id: "ember",
        name: "Ember Forge",
        spectrum: "M3 III",
        spectralIndex: 1.28,
        radius: 1.24,
        position: [-7200, 2100, -11000],
        summary: "A red-giant synthesis body for drafting, transforming, and recombining knowledge.",
        palette: ["#1a0402", "#641408", "#d44b1d", "#ff9b54", "#ffe0b1"],
        stability: "Turbulent"
    },
    {
        id: "lambda",
        name: "Lambda Pale",
        spectrum: "DA2",
        spectralIndex: 0.0,
        radius: 0.58,
        position: [14200, 3600, 4500],
        summary: "A compact white-dwarf archive core for canonical records, citations, and dense memory states.",
        palette: ["#1b2238", "#69779e", "#dce8ff", "#ffffff", "#ffffff"],
        stability: "Dense"
    },
    {
        id: "cygnus",
        name: "Cygnus Veil",
        spectrum: "F8 IV",
        spectralIndex: 0.46,
        radius: 0.94,
        position: [-13200, -4200, 9300],
        summary: "A cyan subgiant for connective portal states and spacious relationship mapping.",
        palette: ["#062728", "#0f6f72", "#6af5d2", "#d6fff4", "#ffffff"],
        stability: "Luminous"
    },
    {
        id: "violet",
        name: "Violet Magnetar",
        spectrum: "B9 X",
        spectralIndex: 0.08,
        radius: 0.72,
        position: [19000, 1800, -5200],
        summary: "A violet compact anomaly star for alerts, high-energy events, and volatile knowledge signals.",
        palette: ["#160826", "#51247e", "#b782ff", "#ecd4ff", "#ffffff"],
        stability: "Volatile"
    }
];

const HUD_UPDATE_INTERVAL = 1000 / 12;
const WORKER_CACHE_VERSION = "immersive-observatory-20260427b";
const DPR_CAPS = {
    safe: 1,
    standard: 1.35,
    immersive: 1.7
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function scaleToDistance(scale) {
    const t = clamp(scale, 0, 100) / 100;
    return SCALE_OBSERVATORY_MIN_DISTANCE + (SCALE_OBSERVATORY_MAX_DISTANCE - SCALE_OBSERVATORY_MIN_DISTANCE) * t * t * t;
}

function distanceToScale(distance) {
    const normalized = clamp(
        (distance - SCALE_OBSERVATORY_MIN_DISTANCE) / (SCALE_OBSERVATORY_MAX_DISTANCE - SCALE_OBSERVATORY_MIN_DISTANCE),
        0,
        1
    );
    return Math.cbrt(normalized) * 100;
}

function formatDistance(distance) {
    if (distance >= 2500) {
        return `${Math.round(distance / 100) / 10}k ly`;
    }

    if (distance >= 80) {
        return `${Math.round(distance)} ly`;
    }

    return `${distance.toFixed(distance < 10 ? 1 : 0)} solar radii`;
}

function getTargetById(targets, id) {
    return targets.find((target) => target.id === id) || targets[0];
}

function detectBudget() {
    const query = new URLSearchParams(window.location.search);
    const requested = query.get("budget");
    if (requested === "safe" || requested === "immersive" || requested === "standard") {
        return requested;
    }

    const memory = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    if (memory <= 4 || cores <= 4) {
        return "safe";
    }

    return "standard";
}

function detectDprCap(budget) {
    const query = new URLSearchParams(window.location.search);
    const requested = Number(query.get("dpr"));
    if (Number.isFinite(requested) && requested > 0) {
        return clamp(requested, 0.8, 2);
    }

    return DPR_CAPS[budget] || DPR_CAPS.standard;
}

function detectCatalogCount() {
    const query = new URLSearchParams(window.location.search);
    if (!query.has("catalog")) {
        return null;
    }

    const requested = Number(query.get("catalog"));
    if (!Number.isFinite(requested)) {
        return null;
    }

    return Math.round(clamp(requested, 64, 20000));
}

function detectDebugMode() {
    const query = new URLSearchParams(window.location.search);
    const value = query.get("debug");
    return query.has("debug") && value !== "0" && value !== "false";
}

function setText(root, selector, value) {
    root.querySelectorAll(selector).forEach((element) => {
        element.textContent = value;
    });
}

function setUnsupported(root, reason) {
    root.classList.add("is-unsupported");
    setText(root, "[data-runtime-state]", "Unsupported");
    setText(root, "[data-runtime-detail]", reason);
}

function updateLoading(root, { progress = 0.08, detail = "Preparing observatory" } = {}) {
    const fill = root.querySelector("[data-loading-fill]");
    const detailNode = root.querySelector("[data-loading-detail]");
    if (fill) {
        fill.style.setProperty("--loading-progress", String(clamp(progress, 0.02, 1)));
    }
    if (detailNode) {
        detailNode.textContent = detail;
    }
}

function updateRail(root, distance) {
    const scale = distanceToScale(distance);
    const top = 100 - scale;
    const value = Math.round(scale);
    const rail = root.querySelector("[data-scale-rail]");
    const thumb = root.querySelector("[data-scale-thumb]");
    const fill = root.querySelector("[data-scale-fill]");

    setText(root, "[data-scale-value]", String(value));

    if (thumb) {
        thumb.style.setProperty("--thumb-top", `${top}%`);
    }

    if (fill) {
        fill.style.setProperty("--fill-start", `${top}%`);
    }

    if (rail) {
        rail.setAttribute("aria-valuenow", String(value));
        rail.setAttribute("aria-valuetext", `${value} scale, ${formatDistance(distance)}`);
    }
}

function updateTargetHud(root, targets, state) {
    const active = state.activeTarget || getTargetById(targets, state.activeId);
    setText(root, "[data-target-name]", active.name);
    setText(root, "[data-target-class]", active.spectrum);
    setText(root, "[data-target-summary]", active.summary);
    setText(root, "[data-target-spectrum]", active.spectrum);
    setText(root, "[data-target-radius]", `${active.radius.toFixed(2)} R`);
    setText(root, "[data-target-stability]", active.stability);
    setText(root, "[data-camera-distance]", formatDistance(state.distance));
    setText(root, "[data-regime]", state.regime);
    setText(root, "[data-yaw]", `${Math.round(state.yaw)} deg`);
    setText(root, "[data-pitch]", `${Math.round(state.pitch)} deg`);
    setText(root, "[data-runtime-state]", state.ready ? "WebGPU Worker live" : "Initializing");
    setText(root, "[data-runtime-detail]", state.detail || "Dedicated Worker + OffscreenCanvas + three/webgpu");

}

function updateImmersiveState(root, state, debugVisible) {
    const distance = state.targetDistance || state.distance || SCALE_OBSERVATORY_MAX_DISTANCE;
    const inspectorVisible = typeof state.inspectorVisible === "boolean"
        ? state.inspectorVisible
        : distance <= 400;
    root.classList.toggle("is-inspecting-target", inspectorVisible);
    root.classList.toggle("has-hover-target", Boolean(state.hoverId));
    root.classList.toggle("is-debug-observatory", debugVisible || Boolean(state.debugVisible));
}

function markInteraction(root, { scale = false } = {}) {
    root.classList.add("has-user-input");
    if (!scale) {
        return;
    }

    root.classList.add("is-scale-active");
    if (root.__scaleObservatoryScaleTimer) {
        clearTimeout(root.__scaleObservatoryScaleTimer);
    }
    root.__scaleObservatoryScaleTimer = setTimeout(() => {
        root.classList.remove("is-scale-active");
        root.__scaleObservatoryScaleTimer = null;
    }, 900);
}

function attachRail(root, worker) {
    const rail = root.querySelector("[data-scale-rail]");
    if (!rail) {
        return () => {};
    }

    let dragging = false;
    const disposers = [];

    const eventToDistance = (event) => {
        const bounds = rail.getBoundingClientRect();
        const y = clamp(event.clientY - bounds.top, 0, bounds.height);
        const scale = 100 - (y / bounds.height) * 100;
        return scaleToDistance(scale);
    };

    const pointerDown = (event) => {
        event.preventDefault();
        markInteraction(root, { scale: true });
        dragging = true;
        rail.setPointerCapture(event.pointerId);
        worker.postMessage({ type: "setDistance", distance: eventToDistance(event) });
    };

    const pointerMove = (event) => {
        if (!dragging) {
            return;
        }

        markInteraction(root, { scale: true });
        worker.postMessage({ type: "setDistance", distance: eventToDistance(event) });
    };

    const stop = (event) => {
        if (dragging && rail.hasPointerCapture(event.pointerId)) {
            rail.releasePointerCapture(event.pointerId);
        }

        dragging = false;
    };

    const keyDown = (event) => {
        const current = Number(rail.getAttribute("aria-valuenow") || 40);
        const step = event.shiftKey ? 8 : 3;
        if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            event.preventDefault();
            markInteraction(root, { scale: true });
            worker.postMessage({ type: "setDistance", distance: scaleToDistance(current + step) });
        }

        if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            event.preventDefault();
            markInteraction(root, { scale: true });
            worker.postMessage({ type: "setDistance", distance: scaleToDistance(current - step) });
        }

        if (event.key === "Home") {
            event.preventDefault();
            markInteraction(root, { scale: true });
            worker.postMessage({ type: "setDistance", distance: SCALE_OBSERVATORY_MIN_DISTANCE });
        }

        if (event.key === "End") {
            event.preventDefault();
            markInteraction(root, { scale: true });
            worker.postMessage({ type: "setDistance", distance: SCALE_OBSERVATORY_MAX_DISTANCE });
        }
    };

    rail.addEventListener("pointerdown", pointerDown);
    rail.addEventListener("pointermove", pointerMove);
    rail.addEventListener("pointerup", stop);
    rail.addEventListener("pointercancel", stop);
    rail.addEventListener("keydown", keyDown);

    disposers.push(() => rail.removeEventListener("pointerdown", pointerDown));
    disposers.push(() => rail.removeEventListener("pointermove", pointerMove));
    disposers.push(() => rail.removeEventListener("pointerup", stop));
    disposers.push(() => rail.removeEventListener("pointercancel", stop));
    disposers.push(() => rail.removeEventListener("keydown", keyDown));

    return () => disposers.forEach((dispose) => dispose());
}

function attachViewport(canvas, worker, root) {
    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let hoverFrame = 0;
    let orbitFrame = 0;
    let pendingDx = 0;
    let pendingDy = 0;
    let wheelFrame = 0;
    let pendingWheelDelta = 0;
    let pendingWheelX = 0.5;
    let pendingWheelY = 0.5;
    const disposers = [];

    const flushOrbitMove = () => {
        orbitFrame = 0;
        if (pendingDx || pendingDy) {
            worker.postMessage({ type: "orbitMove", dx: pendingDx, dy: pendingDy });
            pendingDx = 0;
            pendingDy = 0;
        }
    };

    const flushWheel = () => {
        wheelFrame = 0;
        if (pendingWheelDelta) {
            worker.postMessage({
                type: "wheel",
                deltaY: pendingWheelDelta,
                x: pendingWheelX,
                y: pendingWheelY
            });
            pendingWheelDelta = 0;
        }
    };

    const wheel = (event) => {
        event.preventDefault();
        markInteraction(root, { scale: true });
        const bounds = canvas.getBoundingClientRect();
        pendingWheelX = bounds.width > 0 ? clamp((event.clientX - bounds.left) / bounds.width, 0, 1) : 0.5;
        pendingWheelY = bounds.height > 0 ? clamp((event.clientY - bounds.top) / bounds.height, 0, 1) : 0.5;
        pendingWheelDelta += event.deltaY;
        if (!wheelFrame) {
            wheelFrame = requestAnimationFrame(flushWheel);
        }
    };

    const pointerDown = (event) => {
        if (event.button !== 0) {
            return;
        }

        dragging = true;
        pointerId = event.pointerId;
        startX = lastX = event.clientX;
        startY = lastY = event.clientY;
        canvas.setPointerCapture(pointerId);
        markInteraction(root);
        document.body.classList.add("is-orbiting");
        worker.postMessage({ type: "orbitStart", x: event.clientX, y: event.clientY });
    };

    const pointerMove = (event) => {
        if (dragging && event.pointerId === pointerId) {
            const dx = event.clientX - lastX;
            const dy = event.clientY - lastY;
            lastX = event.clientX;
            lastY = event.clientY;
            pendingDx += dx;
            pendingDy += dy;
            if (!orbitFrame) {
                orbitFrame = requestAnimationFrame(flushOrbitMove);
            }
            return;
        }

        if (hoverFrame) {
            return;
        }

        hoverFrame = requestAnimationFrame(() => {
            hoverFrame = 0;
            worker.postMessage({ type: "pick", mode: "hover", x: event.clientX, y: event.clientY });
        });
    };

    const pointerUp = (event) => {
        if (!dragging || event.pointerId !== pointerId) {
            return;
        }

        const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
        if (canvas.hasPointerCapture(pointerId)) {
            canvas.releasePointerCapture(pointerId);
        }

        dragging = false;
        pointerId = null;
        document.body.classList.remove("is-orbiting");
        flushOrbitMove();
        worker.postMessage({ type: "orbitEnd" });

        if (moved < 7) {
            markInteraction(root);
            worker.postMessage({ type: "pick", mode: "commit", x: event.clientX, y: event.clientY });
        }
    };

    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);

    disposers.push(() => canvas.removeEventListener("wheel", wheel));
    disposers.push(() => canvas.removeEventListener("pointerdown", pointerDown));
    disposers.push(() => canvas.removeEventListener("pointermove", pointerMove));
    disposers.push(() => canvas.removeEventListener("pointerup", pointerUp));
    disposers.push(() => canvas.removeEventListener("pointercancel", pointerUp));

    window.addEventListener("wheel", wheel, { passive: false });
    disposers.push(() => window.removeEventListener("wheel", wheel));

    return () => {
        if (hoverFrame) {
            cancelAnimationFrame(hoverFrame);
        }
        if (orbitFrame) {
            cancelAnimationFrame(orbitFrame);
        }
        if (wheelFrame) {
            cancelAnimationFrame(wheelFrame);
        }

        document.body.classList.remove("is-orbiting");
        disposers.forEach((dispose) => dispose());
    };
}

function attachResize(canvas, worker, dprCap) {
    const sendResize = () => {
        const bounds = canvas.getBoundingClientRect();
        worker.postMessage({
            type: "resize",
            width: Math.max(1, Math.round(bounds.width)),
            height: Math.max(1, Math.round(bounds.height)),
            dpr: Math.min(window.devicePixelRatio || 1, dprCap)
        });
    };

    const observer = new ResizeObserver(sendResize);
    observer.observe(canvas);
    window.addEventListener("resize", sendResize, { passive: true });
    sendResize();

    return () => {
        observer.disconnect();
        window.removeEventListener("resize", sendResize);
    };
}

export function bootScaleObservatory({
    canvas,
    hudRoot = document,
    initialTargetId = "helios",
    initialDistance = SCALE_OBSERVATORY_MAX_DISTANCE
} = {}) {
    if (!canvas) {
        throw new Error("bootScaleObservatory requires a canvas.");
    }

    if (!("gpu" in navigator) || !("Worker" in window) || !("OffscreenCanvas" in window) || !canvas.transferControlToOffscreen) {
        setUnsupported(hudRoot, "This template requires WebGPU, Dedicated Worker, and OffscreenCanvas.");
        return {
            focusTarget() {},
            setDistance() {},
            dispose() {}
        };
    }

    const offscreen = canvas.transferControlToOffscreen();
    const workerUrl = new URL("./scale-observatory-worker.js", import.meta.url);
    const moduleVersion = new URL(import.meta.url).searchParams.get("v");
    const workerVersion = new URLSearchParams(window.location.search).get("v") || moduleVersion || WORKER_CACHE_VERSION;
    if (workerVersion) {
        workerUrl.searchParams.set("v", workerVersion);
    }
    const worker = new Worker(workerUrl, { type: "module" });
    const budget = detectBudget();
    const dprCap = detectDprCap(budget);
    const catalogCount = detectCatalogCount();
    const debugVisible = detectDebugMode();
    const disposers = [];
    let lastState = {
        distance: initialDistance,
        targetDistance: initialDistance,
        activeId: initialTargetId,
        hoverId: null,
        regime: "Initializing",
        initPhase: "boot",
        catalogCount: 0,
        qualityTier: budget,
        visibleCatalogCount: 0,
        visibleLabelCount: 0,
        cameraMode: "map",
        yaw: 0,
        pitch: 0,
        inspectorVisible: false,
        debugVisible,
        ready: false
    };
    let lastHudUpdate = 0;

    const pushHudState = (state, force = false) => {
        const now = performance.now();
        lastState = { ...lastState, ...state };
        updateImmersiveState(hudRoot, lastState, debugVisible);
        if (!force && now - lastHudUpdate < HUD_UPDATE_INTERVAL) {
            return;
        }

        lastHudUpdate = now;
        updateRail(hudRoot, lastState.targetDistance || lastState.distance);
        updateTargetHud(hudRoot, SCALE_TARGETS, lastState);
    };

    worker.addEventListener("message", (event) => {
        const message = event.data || {};
        if (message.type === "bootProgress") {
            updateLoading(hudRoot, message);
            pushHudState({
                initPhase: message.phase || lastState.initPhase,
                detail: message.detail || lastState.detail
            });
            return;
        }

        if (message.type === "firstFrameReady") {
            hudRoot.classList.add("has-first-frame");
            pushHudState({ ready: true, ...(message.state || {}) }, true);
            return;
        }

        if (message.type === "ready") {
            hudRoot.classList.remove("is-unsupported");
            hudRoot.classList.add("has-first-frame");
            pushHudState({ ready: true, ...message.state }, true);
            return;
        }

        if (message.type === "state") {
            pushHudState(message.state || {});
            return;
        }

        if (message.type === "hover") {
            pushHudState({ hoverId: message.id || null });
            return;
        }

        if (message.type === "focusChanged") {
            pushHudState({
                activeId: message.id,
                activeTarget: message.activeTarget || lastState.activeTarget,
                targetDistance: message.targetDistance || lastState.targetDistance
            }, true);
            return;
        }

        if (message.type === "unsupported") {
            setUnsupported(hudRoot, message.reason || "WebGPU worker unavailable.");
            return;
        }

        if (message.type === "error") {
            setUnsupported(hudRoot, message.message || "WebGPU worker crashed.");
            console.error(message.error || message.message);
        }
    });

    worker.addEventListener("error", (error) => {
        const details = [
            error.message || "WebGPU worker crashed.",
            error.filename ? `at ${error.filename}` : "",
            Number.isFinite(error.lineno) ? `${error.lineno}:${error.colno || 0}` : ""
        ].filter(Boolean).join(" ");
        setUnsupported(hudRoot, details);
        console.error("[scale-observatory] worker module error", {
            message: error.message,
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno
        });
    });

    worker.addEventListener("messageerror", (error) => {
        setUnsupported(hudRoot, "WebGPU worker message serialization failed.");
        console.error("[scale-observatory] worker message error", error);
    });

    disposers.push(attachResize(canvas, worker, dprCap));
    disposers.push(attachRail(hudRoot, worker));
    disposers.push(attachViewport(canvas, worker, hudRoot));

    worker.postMessage({
        type: "init",
        canvas: offscreen,
        width: Math.max(1, Math.round(canvas.clientWidth || window.innerWidth)),
        height: Math.max(1, Math.round(canvas.clientHeight || window.innerHeight)),
        dpr: Math.min(window.devicePixelRatio || 1, dprCap),
        budget,
        catalogCount,
        targets: SCALE_TARGETS,
        initialTargetId,
        initialDistance: clamp(initialDistance, SCALE_OBSERVATORY_MIN_DISTANCE, SCALE_OBSERVATORY_MAX_DISTANCE),
        debug: debugVisible
    }, [offscreen]);

    pushHudState(lastState, true);

    return {
        focusTarget(id) {
            worker.postMessage({ type: "focusTarget", id });
        },
        setDistance(distance) {
            worker.postMessage({
                type: "setDistance",
                distance: clamp(distance, SCALE_OBSERVATORY_MIN_DISTANCE, SCALE_OBSERVATORY_MAX_DISTANCE)
            });
        },
        dispose() {
            if (hudRoot.__scaleObservatoryScaleTimer) {
                clearTimeout(hudRoot.__scaleObservatoryScaleTimer);
                hudRoot.__scaleObservatoryScaleTimer = null;
            }
            disposers.forEach((dispose) => dispose());
            worker.postMessage({ type: "dispose" });
            worker.terminate();
        }
    };
}
