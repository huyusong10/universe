import * as THREE from "three/webgpu";
import { pass, clamp as tslClamp, color, dot, normalLocal, normalView, positionLocal, positionViewDirection, texture, time, uv, vec2 } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

const TAU = Math.PI * 2;

const PRESETS = {
    intro: {
        profile: "warm",
        star: { x: 3.35, y: 1.52, scale: 1.14 },
        mobileStar: { x: 2.4, y: 0.76, scale: 0.96 },
        camera: { x: 0.04, y: 0.12, z: 13.9, fov: 30 },
        mobileCamera: { x: 0.02, y: 0.1, z: 14.6, fov: 31 },
        stars: { far: 2200, near: 360 },
        fieldDensity: 1.02,
        opticsScale: 0.92,
        heroCount: 6,
        glow: 0.15,
        corona: 0.018,
        bloom: [0.44, 0.34, 0.12],
        haze: [0.24, 0.18],
        dust: [0.58, 0.42]
    },
    roam: {
        scene: "peripheral",
        profile: "warm",
        star: { x: 7.1, y: 0.54, scale: 0.48 },
        mobileStar: { x: 4.05, y: -0.42, scale: 0.5 },
        focus: { x: 0.54, y: -0.04 },
        mobileFocus: { x: 0.18, y: -0.08 },
        camera: { x: 0.07, y: 0.13, z: 13.3, fov: 29 },
        mobileCamera: { x: 0.04, y: 0.12, z: 14.0, fov: 30 },
        stars: { far: 2400, near: 440 },
        fieldDensity: 0.98,
        opticsScale: 0.92,
        heroCount: 6,
        glow: 0.14,
        corona: 0.018,
        bloom: [0.42, 0.34, 0.12],
        haze: [0.22, 0.17],
        dust: [0.56, 0.4],
        accentOrbs: [
            { x: -4.9, y: 2.0, z: -38, scale: 0.66, color: "cool", haloColor: "opticCool", opacity: 0.8, haloOpacity: 0.14, twinkle: 0.18 },
            { x: 4.3, y: -2.2, z: -42, scale: 0.46, color: "warm", haloColor: "opticWarm", opacity: 0.72, haloOpacity: 0.1, twinkle: 0.12 },
            { x: 1.8, y: -3.0, z: -54, scale: 0.3, color: "cool", haloColor: "opticCool", opacity: 0.62, haloOpacity: 0.08, twinkle: 0.1 }
        ]
    },
    survey: {
        scene: "deepField",
        profile: "warm",
        mainBodyVisible: false,
        star: { x: 3.55, y: -0.04, scale: 0.98 },
        mobileStar: { x: 2.64, y: 0.14, scale: 0.9 },
        focus: { x: 0.32, y: -0.2 },
        mobileFocus: { x: 0.12, y: -0.08 },
        camera: { x: 0.08, y: 0.12, z: 13.5, fov: 28.8 },
        mobileCamera: { x: 0.04, y: 0.1, z: 14.2, fov: 30.2 },
        stars: { far: 2600, near: 420 },
        fieldDensity: 1.08,
        opticsScale: 1.06,
        heroCount: 6,
        glow: 0.13,
        corona: 0.017,
        bloom: [0.4, 0.34, 0.12],
        haze: [0.28, 0.2],
        dust: [0.64, 0.46],
        accentOrbs: [
            { x: -5.0, y: 2.4, z: -48, scale: 0.34, color: "cool", haloColor: "opticCool", opacity: 0.58, haloOpacity: 0.06, twinkle: 0.08 },
            { x: 4.8, y: -1.8, z: -40, scale: 0.54, color: "warm", haloColor: "opticWarm", opacity: 0.72, haloOpacity: 0.1, twinkle: 0.12 },
            { x: 3.1, y: 2.2, z: -54, scale: 0.28, color: "cool", haloColor: "opticCool", opacity: 0.5, haloOpacity: 0.05, twinkle: 0.08 }
        ]
    },
    focus: {
        profile: "warm",
        star: { x: -2.9, y: 0.02, scale: 1.18 },
        mobileStar: { x: -1.36, y: 0.28, scale: 1.02 },
        camera: { x: 0.06, y: 0.12, z: 12.8, fov: 28.2 },
        mobileCamera: { x: 0.04, y: 0.1, z: 13.7, fov: 29.5 },
        stars: { far: 2100, near: 360 },
        fieldDensity: 0.92,
        opticsScale: 0.84,
        heroCount: 5,
        glow: 0.18,
        corona: 0.022,
        bloom: [0.46, 0.36, 0.12],
        haze: [0.2, 0.15],
        dust: [0.52, 0.38]
    },
    seed: {
        scene: "formation",
        profile: "blue",
        mainBodyVisible: false,
        star: { x: 3.95, y: -0.48, scale: 0.82 },
        mobileStar: { x: 3.08, y: 0.26, scale: 0.74 },
        focus: { x: -0.9, y: 0.08 },
        mobileFocus: { x: -0.42, y: -0.02 },
        camera: { x: 0.03, y: 0.08, z: 14.8, fov: 31 },
        mobileCamera: { x: 0.02, y: 0.08, z: 15.4, fov: 32 },
        stars: { far: 1900, near: 280 },
        fieldDensity: 0.82,
        opticsScale: 0.66,
        heroCount: 4,
        glow: 0.1,
        corona: 0.012,
        bloom: [0.3, 0.3, 0.1],
        haze: [0.22, 0.18],
        dust: [0.48, 0.34],
        accentOrbs: [
            { x: -4.7, y: 2.5, z: -44, scale: 0.42, color: "cool", haloColor: "opticCool", opacity: 0.68, haloOpacity: 0.12, twinkle: 0.1 },
            { x: -2.1, y: 0.7, z: -34, scale: 0.74, color: "cool", haloColor: "heroCool", opacity: 0.76, haloOpacity: 0.18, twinkle: 0.16 },
            { x: 2.7, y: -2.8, z: -38, scale: 0.34, color: "warm", haloColor: "opticWarm", opacity: 0.54, haloOpacity: 0.08, twinkle: 0.08 }
        ]
    },
    academy: {
        profile: "warm",
        star: { x: -2.55, y: 0.1, scale: 1.0 },
        mobileStar: { x: -0.45, y: -0.88, scale: 0.9 },
        camera: { x: 0.08, y: 0.14, z: 12.9, fov: 28 },
        mobileCamera: { x: 0.06, y: 0.1, z: 13.4, fov: 29 },
        stars: { far: 2400, near: 440 },
        fieldDensity: 1.02,
        opticsScale: 1.04,
        heroCount: 7,
        glow: 0.16,
        corona: 0.022,
        bloom: [0.44, 0.36, 0.12],
        haze: [0.26, 0.2],
        dust: [0.6, 0.46]
    },
    academyAdvanced: {
        profile: "warm",
        star: { x: -2.48, y: 0.08, scale: 1.02 },
        mobileStar: { x: -0.42, y: -0.9, scale: 0.92 },
        camera: { x: 0.08, y: 0.14, z: 12.8, fov: 28 },
        mobileCamera: { x: 0.06, y: 0.1, z: 13.25, fov: 29 },
        stars: { far: 2500, near: 460 },
        fieldDensity: 1.08,
        opticsScale: 1.12,
        heroCount: 7,
        glow: 0.17,
        corona: 0.024,
        bloom: [0.46, 0.36, 0.12],
        haze: [0.3, 0.22],
        dust: [0.64, 0.48]
    },
    system: {
        scene: "deepField",
        profile: "blue",
        mainBodyVisible: false,
        star: { x: 0, y: 0, scale: 0.84 },
        mobileStar: { x: 0, y: 0.18, scale: 0.76 },
        focus: { x: 0.18, y: -0.18 },
        mobileFocus: { x: 0.08, y: -0.08 },
        camera: { x: 0, y: 0.04, z: 15.0, fov: 31.4 },
        mobileCamera: { x: 0, y: 0.04, z: 15.6, fov: 32.2 },
        stars: { far: 1800, near: 260 },
        fieldDensity: 0.78,
        opticsScale: 0.62,
        heroCount: 4,
        glow: 0.12,
        corona: 0.012,
        bloom: [0.28, 0.3, 0.1],
        haze: [0.18, 0.16],
        dust: [0.42, 0.32],
        accentOrbs: [
            { x: -5.2, y: 2.8, z: -52, scale: 0.3, color: "cool", haloColor: "opticCool", opacity: 0.46, haloOpacity: 0.04, twinkle: 0.06 },
            { x: 5.0, y: -2.5, z: -44, scale: 0.36, color: "warm", haloColor: "opticWarm", opacity: 0.52, haloOpacity: 0.06, twinkle: 0.08 }
        ]
    },
    cruise: {
        profile: "warm",
        star: { x: 3.15, y: 0.14, scale: 1.22 },
        mobileStar: { x: 2.56, y: 0.44, scale: 1.08 },
        camera: { x: 0.05, y: 0.1, z: 13.4, fov: 29.2 },
        mobileCamera: { x: 0.03, y: 0.08, z: 14.2, fov: 30.4 },
        stars: { far: 2300, near: 380 },
        fieldDensity: 0.94,
        opticsScale: 0.94,
        heroCount: 6,
        glow: 0.17,
        corona: 0.021,
        bloom: [0.44, 0.34, 0.12],
        haze: [0.2, 0.15],
        dust: [0.54, 0.4]
    },
    bodies: {
        scene: "taxonomy",
        profile: "blue",
        mainBodyVisible: false,
        star: { x: 0, y: -3.8, scale: 1.84 },
        mobileStar: { x: 0.58, y: -1.78, scale: 1.34 },
        focus: { x: 0.12, y: -0.32 },
        mobileFocus: { x: 0.08, y: -0.14 },
        camera: { x: 0.02, y: 0.05, z: 14.7, fov: 30.6 },
        mobileCamera: { x: 0.02, y: 0.06, z: 15.2, fov: 31.2 },
        stars: { far: 1800, near: 300 },
        fieldDensity: 0.88,
        opticsScale: 0.74,
        heroCount: 5,
        glow: 0.12,
        corona: 0.014,
        bloom: [0.3, 0.3, 0.1],
        haze: [0.2, 0.16],
        dust: [0.5, 0.4],
        accentOrbs: [
            { x: -5.0, y: -2.0, z: -30, scale: 0.88, color: "warm", haloColor: "heroWarm", opacity: 0.92, haloOpacity: 0.18, twinkle: 0.12 },
            { x: -2.1, y: -1.0, z: -34, scale: 0.72, color: "cool", haloColor: "heroCool", opacity: 0.82, haloOpacity: 0.16, twinkle: 0.14 },
            { x: 0.7, y: -1.02, z: -38, scale: 0.28, color: "warm", haloColor: "opticWarm", opacity: 0.64, haloOpacity: 0.08, twinkle: 0.16 },
            { x: 1.18, y: -1.22, z: -40, scale: 0.2, color: "cool", haloColor: "opticCool", opacity: 0.56, haloOpacity: 0.06, twinkle: 0.16 },
            { x: 4.9, y: -1.88, z: -36, scale: 0.38, color: "cool", haloColor: "opticCool", opacity: 0.7, haloOpacity: 0.08, twinkle: 0.08 }
        ]
    },
    cinematic: {
        profile: "warm",
        star: { x: 2.9, y: 0.08, scale: 1.28 },
        mobileStar: { x: 2.25, y: 0.42, scale: 1.12 },
        camera: { x: 0.05, y: 0.08, z: 13.3, fov: 29.5 },
        mobileCamera: { x: 0.03, y: 0.08, z: 14.0, fov: 30.5 },
        stars: { far: 2200, near: 340 },
        fieldDensity: 0.92,
        opticsScale: 0.88,
        heroCount: 5,
        glow: 0.17,
        corona: 0.02,
        bloom: [0.42, 0.34, 0.12],
        haze: [0.2, 0.15],
        dust: [0.48, 0.36]
    },
    prototype: {
        profile: "warm",
        star: { x: 0, y: 0, scale: 1.38 },
        mobileStar: { x: 0, y: 0.18, scale: 1.08 },
        camera: { x: 0, y: 0.04, z: 12.3, fov: 27.8 },
        mobileCamera: { x: 0, y: 0.04, z: 13.4, fov: 29.2 },
        stars: { far: 2000, near: 260 },
        fieldDensity: 0.78,
        opticsScale: 0.62,
        heroCount: 4,
        glow: 0.12,
        corona: 0.015,
        bloom: [0.34, 0.3, 0.1],
        haze: [0.16, 0.13],
        dust: [0.42, 0.3]
    },
    index: {
        scene: "catalogField",
        profile: "warm",
        mainBodyVisible: false,
        star: { x: 3.94, y: -1.46, scale: 1.02 },
        mobileStar: { x: 2.92, y: -0.12, scale: 0.9 },
        focus: { x: 1.1, y: -0.46 },
        mobileFocus: { x: 0.18, y: -0.14 },
        camera: { x: 0.03, y: 0.08, z: 14.3, fov: 30.5 },
        mobileCamera: { x: 0.02, y: 0.08, z: 15.0, fov: 31.4 },
        stars: { far: 2200, near: 340 },
        fieldDensity: 1.02,
        opticsScale: 0.98,
        heroCount: 6,
        glow: 0.12,
        corona: 0.016,
        bloom: [0.34, 0.32, 0.1],
        haze: [0.24, 0.18],
        dust: [0.58, 0.42],
        accentOrbs: [
            { x: -5.2, y: 2.7, z: -54, scale: 0.26, color: "cool", haloColor: "opticCool", opacity: 0.44, haloOpacity: 0.04, twinkle: 0.06 },
            { x: 4.4, y: 2.1, z: -48, scale: 0.34, color: "warm", haloColor: "opticWarm", opacity: 0.52, haloOpacity: 0.06, twinkle: 0.08 }
        ]
    },
    cosmic: {
        profile: "warm",
        star: { x: 3.72, y: 0.18, scale: 1.04 },
        mobileStar: { x: 1.54, y: -1.22, scale: 0.8 },
        camera: { x: 0.05, y: 0.08, z: 14.05, fov: 29.5 },
        mobileCamera: { x: 0.02, y: 0.1, z: 14.9, fov: 31 },
        stars: { far: 2600, near: 460 },
        fieldDensity: 1.16,
        opticsScale: 1.24,
        heroCount: 9,
        glow: 0.16,
        corona: 0.022,
        bloom: [0.42, 0.36, 0.12],
        haze: [0.34, 0.26],
        dust: [0.78, 0.56]
    }
};

const COLOR_PROFILES = {
    warm: {
        baseTint: 0xffd8a5,
        baseMix: 0.64,
        hotTint: 0xfffff0,
        shadowTint: 0x3f1206,
        emberTint: 0xff7b1f,
        warmthTint: 0xffb858,
        glow: 0xffca86,
        corona: 0xffcc86,
        limb: 0xffd49b,
        hazeBlue: "156, 184, 255",
        hazeWarm: "255, 208, 142",
        opticWarm: 0xffddb0,
        opticCool: 0xb4d4ff,
        heroWarm: 0xffeacf,
        heroCool: 0xd9ecff
    },
    blue: {
        baseTint: 0xd7ecff,
        baseMix: 0.72,
        hotTint: 0xffffff,
        shadowTint: 0x0b2346,
        emberTint: 0x69c4ff,
        warmthTint: 0x9fdcff,
        glow: 0xaed8ff,
        corona: 0x8ccaff,
        limb: 0xcfeaff,
        hazeBlue: "144, 198, 255",
        hazeWarm: "182, 228, 255",
        opticWarm: 0xe4f3ff,
        opticCool: 0xb9ddff,
        heroWarm: 0xf1fbff,
        heroCool: 0xd7ecff
    }
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function hash(x, y, seed = 0) {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return value - Math.floor(value);
}

function gaussian() {
    let u = 0;
    let v = 0;

    while (u === 0) {
        u = Math.random();
    }

    while (v === 0) {
        v = Math.random();
    }

    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(TAU * v);
}

function scaledCount(base, scale) {
    return Math.max(1, Math.round(base * scale));
}

function textureCanvas(width, height = width) {
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    return output;
}

function configureTexture(texture, colorSpace = THREE.SRGBColorSpace) {
    texture.colorSpace = colorSpace;
    texture.needsUpdate = true;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        image.src = url;
    });
}

function buildGlowTexture(size, profile) {
    const output = textureCanvas(size);
    const context = output.getContext("2d");
    const center = size / 2;
    const gradient = context.createRadialGradient(center, center, size * 0.06, center, center, center);

    if (profile === "blue") {
        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.22, "rgba(232, 244, 255, 0.94)");
        gradient.addColorStop(0.5, "rgba(164, 210, 255, 0.32)");
        gradient.addColorStop(1, "rgba(164, 210, 255, 0)");
    } else {
        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.22, "rgba(255, 247, 233, 0.94)");
        gradient.addColorStop(0.5, "rgba(255, 205, 126, 0.32)");
        gradient.addColorStop(1, "rgba(255, 205, 126, 0)");
    }

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return output;
}

function buildPointStarTexture(size, profile, haloScale = 1) {
    const output = textureCanvas(size);
    const context = output.getContext("2d");
    const center = size / 2;
    const coreRadius = size * 0.024;
    const tint = profile === "blue"
        ? ["255, 255, 255", "212, 233, 255", "144, 192, 255"]
        : ["255, 255, 255", "255, 240, 214", "255, 199, 126"];

    context.clearRect(0, 0, size, size);

    const outer = context.createRadialGradient(center, center, 0, center, center, size * 0.48 * haloScale);
    outer.addColorStop(0, `rgba(${tint[1]}, 0.48)`);
    outer.addColorStop(0.16, `rgba(${tint[1]}, 0.22)`);
    outer.addColorStop(0.48, `rgba(${tint[2]}, 0.08)`);
    outer.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = outer;
    context.fillRect(0, 0, size, size);

    const inner = context.createRadialGradient(center, center, 0, center, center, size * 0.12);
    inner.addColorStop(0, `rgba(${tint[0]}, 1)`);
    inner.addColorStop(0.34, `rgba(${tint[0]}, 0.94)`);
    inner.addColorStop(0.74, `rgba(${tint[1]}, 0.18)`);
    inner.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = inner;
    context.fillRect(0, 0, size, size);

    context.fillStyle = "rgba(255,255,255,1)";
    context.beginPath();
    context.arc(center, center, coreRadius, 0, TAU);
    context.fill();

    return output;
}

function buildGalacticHazeTexture(width, height, tint) {
    const output = textureCanvas(width, height);
    const context = output.getContext("2d");
    const centerY = height * 0.5;

    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = "screen";
    context.filter = "blur(28px)";

    for (let index = 0; index < 82; index += 1) {
        const x = width * hash(index * 1.8, 2.4, 0.5);
        const spread = width * (0.08 + hash(index * 2.4, 4.4, 0.8) * 0.16);
        const heightSpread = height * (0.08 + hash(index * 1.2, 6.6, 1.1) * 0.18);
        const y = centerY + gaussian() * height * 0.12;
        const alpha = 0.032 + hash(index * 2.7, 7.8, 1.6) * 0.05;
        const puff = context.createRadialGradient(x, y, 0, x, y, spread);
        puff.addColorStop(0, `rgba(${tint}, ${alpha})`);
        puff.addColorStop(0.34, `rgba(${tint}, ${alpha * 0.62})`);
        puff.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = puff;
        context.beginPath();
        context.ellipse(x, y, spread, heightSpread, 0, 0, TAU);
        context.fill();
    }

    context.filter = "blur(34px)";
    const band = context.createLinearGradient(0, centerY - height * 0.12, width, centerY + height * 0.12);
    band.addColorStop(0, "rgba(148, 176, 255, 0)");
    band.addColorStop(0.18, "rgba(148, 176, 255, 0.1)");
    band.addColorStop(0.5, "rgba(255, 213, 148, 0.18)");
    band.addColorStop(0.82, "rgba(148, 176, 255, 0.1)");
    band.addColorStop(1, "rgba(148, 176, 255, 0)");
    context.fillStyle = band;
    context.fillRect(0, centerY - height * 0.28, width, height * 0.56);

    const ridge = context.createLinearGradient(0, centerY - height * 0.04, width, centerY + height * 0.04);
    ridge.addColorStop(0, "rgba(255, 236, 196, 0)");
    ridge.addColorStop(0.18, "rgba(255, 236, 196, 0.05)");
    ridge.addColorStop(0.5, "rgba(255, 214, 148, 0.12)");
    ridge.addColorStop(0.82, "rgba(164, 198, 255, 0.05)");
    ridge.addColorStop(1, "rgba(255, 236, 196, 0)");
    context.fillStyle = ridge;
    context.fillRect(0, centerY - height * 0.16, width, height * 0.32);

    context.filter = "none";
    return output;
}

function buildDustLaneTexture(width, height) {
    const output = textureCanvas(width, height);
    const context = output.getContext("2d");
    const centerY = height * 0.5;

    context.clearRect(0, 0, width, height);
    context.filter = "blur(16px)";

    for (let index = 0; index < 40; index += 1) {
        const x = width * hash(index * 1.9, 3.1, 4.2);
        const y = centerY + gaussian() * height * 0.1;
        const radiusX = width * (0.08 + hash(index * 2.6, 4.2, 2.7) * 0.12);
        const radiusY = height * (0.03 + hash(index * 3.2, 5.8, 5.1) * 0.09);
        const alpha = 0.22 + hash(index * 1.3, 7.6, 2.4) * 0.22;
        const veil = context.createRadialGradient(x, y, 0, x, y, radiusX);
        veil.addColorStop(0, `rgba(2, 4, 10, ${alpha})`);
        veil.addColorStop(0.42, `rgba(2, 4, 10, ${alpha * 0.68})`);
        veil.addColorStop(1, "rgba(2, 4, 10, 0)");
        context.fillStyle = veil;
        context.beginPath();
        context.ellipse(x, y, radiusX, radiusY, hash(index * 2.1, 1.4, 3.5) * 0.8 - 0.4, 0, TAU);
        context.fill();
    }

    context.filter = "none";
    return output;
}

function buildCoronaTexture(size, profile) {
    const output = textureCanvas(size);
    const context = output.getContext("2d");
    const center = size / 2;
    const baseRadius = size * 0.22;
    const tint = profile === "blue"
        ? ["245, 251, 255", "180, 222, 255", "120, 170, 255"]
        : ["255, 244, 220", "255, 206, 126", "255, 172, 88"];

    context.translate(center, center);
    context.globalCompositeOperation = "screen";

    const mist = context.createRadialGradient(0, 0, baseRadius * 0.86, 0, 0, baseRadius * 2.4);
    mist.addColorStop(0, "rgba(255,255,255,0)");
    mist.addColorStop(0.22, `rgba(${tint[0]}, 0.05)`);
    mist.addColorStop(0.52, `rgba(${tint[1]}, 0.02)`);
    mist.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = mist;
    context.beginPath();
    context.arc(0, 0, baseRadius * 2.4, 0, TAU);
    context.fill();

    for (let index = 0; index < 96; index += 1) {
        const angle = hash(index * 2.4, 4.4, 3.5) * TAU;
        const plume = Math.pow(hash(index * 1.6, 1.2, 8.1), 2.4);
        const inner = baseRadius * (0.98 + hash(index * 2.1, 1.4, 6.3) * 0.05);
        const outer = baseRadius * (1.14 + plume * 0.64);
        const bend = (hash(index * 4.2, 5.3, 11.9) - 0.5) * 0.18;
        const width = 1.2 + plume * 4.8;

        const startX = Math.cos(angle) * inner;
        const startY = Math.sin(angle) * inner;
        const controlX = Math.cos(angle + bend * 0.35) * (inner + (outer - inner) * 0.42);
        const controlY = Math.sin(angle + bend * 0.35) * (inner + (outer - inner) * 0.42);
        const endX = Math.cos(angle + bend * 0.68) * outer;
        const endY = Math.sin(angle + bend * 0.68) * outer;

        const gradient = context.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, `rgba(${tint[0]}, 0.05)`);
        gradient.addColorStop(0.34, `rgba(${tint[1]}, ${0.025 + plume * 0.03})`);
        gradient.addColorStop(1, `rgba(${tint[2]}, 0)`);

        context.strokeStyle = gradient;
        context.lineCap = "round";
        context.lineWidth = width;
        context.filter = `blur(${8 + plume * 12}px)`;
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo(controlX, controlY, endX, endY);
        context.stroke();
    }

    context.filter = "none";
    return output;
}

function buildProminenceTexture(width, height, seed, profile) {
    const output = textureCanvas(width, height);
    const context = output.getContext("2d");
    const midY = height * 0.5;
    const tint = profile === "blue"
        ? ["245, 252, 255", "194, 230, 255", "126, 182, 255"]
        : ["255, 244, 224", "255, 211, 140", "255, 155, 74"];

    context.globalCompositeOperation = "screen";

    for (let index = 0; index < 16; index += 1) {
        const anchor = width * (0.14 + hash(index * 1.4, seed * 4.2, seed + 1.9) * 0.72);
        const spread = width * (0.08 + hash(index * 2.8, seed * 3.3, seed + 7.2) * 0.14);
        const thickness = height * (0.12 + hash(index * 4.1, seed * 6.4, seed + 2.2) * 0.16);
        const alpha = 0.08 + hash(index * 3.7, seed * 2.8, seed + 4.4) * 0.06;
        const puff = context.createRadialGradient(anchor, midY, 0, anchor, midY, spread);
        puff.addColorStop(0, `rgba(${tint[0]}, ${alpha})`);
        puff.addColorStop(0.34, `rgba(${tint[1]}, ${alpha * 0.62})`);
        puff.addColorStop(1, `rgba(${tint[2]}, 0)`);
        context.fillStyle = puff;
        context.beginPath();
        context.ellipse(anchor, midY, spread, thickness, 0, 0, TAU);
        context.fill();
    }

    context.filter = "blur(10px)";
    context.filter = "none";
    return output;
}

function sampleUniform(bounds, zMin, zMax) {
    return {
        x: (Math.random() - 0.5) * bounds.x,
        y: (Math.random() - 0.5) * bounds.y,
        z: -rand(zMin, zMax)
    };
}

function sampleBand(centerX, centerY, angle, length, spread, zMin, zMax) {
    const along = (Math.random() - 0.5) * length;
    const offset = gaussian() * spread;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;

    return {
        x: centerX + dx * along + nx * offset,
        y: centerY + dy * along + ny * offset,
        z: -rand(zMin, zMax)
    };
}

function sampleMixedField(starPosition) {
    if (Math.random() < 0.7) {
        return sampleBand(-0.6, -0.3, -0.55, 88, 7.8, 26, 130);
    }

    return sampleUniform({ x: 96, y: 58 }, 24, 136);
}

function sampleAnchorField(starPosition) {
    if (Math.random() < 0.8) {
        return sampleBand(-0.42, -0.22, -0.55, 82, 5.2, 24, 124);
    }

    return sampleMixedField(starPosition);
}

function tooCloseToStar(point, starPosition, radius) {
    const dx = point.x - starPosition.x;
    const dy = point.y - starPosition.y;
    return dx * dx + dy * dy < radius * radius;
}

function pickStarColor(mode, profile) {
    const roll = Math.random();

    if (profile === "blue") {
        if (mode === "band") {
            if (roll < 0.58) {
                return [0.78, 0.86, 1.04];
            }
            if (roll < 0.9) {
                return [0.9, 0.96, 1.02];
            }
            return [0.7, 0.8, 1.04];
        }

        if (roll < 0.68) {
            return [0.84, 0.92, 1.06];
        }
        if (roll < 0.9) {
            return [0.94, 0.98, 1.02];
        }
        return [0.74, 0.86, 1.04];
    }

    if (mode === "band") {
        if (roll < 0.52) {
            return [0.72, 0.78, 1.0];
        }
        if (roll < 0.84) {
            return [0.96, 0.93, 0.82];
        }
        return [0.82, 0.88, 1.0];
    }

    if (roll < 0.6) {
        return [0.88, 0.92, 1.0];
    }
    if (roll < 0.86) {
        return [1.0, 0.96, 0.88];
    }
    return [0.76, 0.86, 1.0];
}

function createPoints(positions, colors, size, opacity, glowTexture) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));

    const material = new THREE.PointsMaterial({
        map: glowTexture,
        size,
        sizeAttenuation: true,
        transparent: true,
        opacity,
        depthWrite: false,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });

    return new THREE.Points(geometry, material);
}

function createStarLayer({
    count,
    size,
    opacity,
    glowTexture,
    sampler,
    colorMode,
    profile,
    starPosition,
    exclusionRadius
}) {
    const positions = [];
    const colors = [];
    let created = 0;
    let attempts = 0;

    while (created < count && attempts < count * 24) {
        attempts += 1;
        const point = sampler();

        if (tooCloseToStar(point, starPosition, exclusionRadius)) {
            continue;
        }

        const tint = pickStarColor(colorMode, profile);
        const shimmer = 0.9 + Math.random() * 0.36;
        positions.push(point.x, point.y, point.z);
        colors.push(tint[0] * shimmer, tint[1] * shimmer, tint[2] * shimmer);
        created += 1;
    }

    return createPoints(positions, colors, size, opacity, glowTexture);
}

function createAnchorBursts(glowTexture, starPosition, colors, count, exclusionRadius = 5.2) {
    const group = new THREE.Group();
    const items = [];

    for (let index = 0; index < count; index += 1) {
        let point = sampleAnchorField(starPosition);
        let guard = 0;

        while (tooCloseToStar(point, starPosition, exclusionRadius) && guard < 20) {
            point = sampleAnchorField(starPosition);
            guard += 1;
        }

        const material = new THREE.SpriteMaterial({
            map: glowTexture,
            color: index % 4 === 0 ? colors.opticCool : index % 3 === 0 ? colors.opticWarm : 0xf4f8ff,
            transparent: true,
            opacity: 0.12 + Math.random() * 0.16,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });

        const sprite = new THREE.Sprite(material);
        const scale = 0.32 + Math.random() * 0.88;
        sprite.position.set(point.x, point.y, point.z);
        sprite.scale.set(scale, scale, 1);
        group.add(sprite);

        items.push({
            sprite,
            material,
            scale,
            phase: Math.random() * TAU,
            baseOpacity: material.opacity
        });
    }

    return { group, items };
}

function createGalacticKnots(glowTexture, starPosition, colors, count, exclusionRadius = 6.2) {
    const group = new THREE.Group();
    const items = [];

    for (let index = 0; index < count; index += 1) {
        let point = sampleBand(-0.35, -0.24, -0.55, 74, 4.8, 42, 116);
        let guard = 0;

        while (tooCloseToStar(point, starPosition, exclusionRadius) && guard < 24) {
            point = sampleBand(-0.35, -0.24, -0.55, 74, 4.8, 42, 116);
            guard += 1;
        }

        const warm = index % 3 !== 0;
        const material = new THREE.SpriteMaterial({
            map: glowTexture,
            color: warm ? colors.opticWarm : colors.opticCool,
            transparent: true,
            opacity: 0.04 + Math.random() * 0.05,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });

        const sprite = new THREE.Sprite(material);
        const scaleX = 4.8 + Math.random() * 7.2;
        const scaleY = 0.9 + Math.random() * 1.7;
        sprite.position.set(point.x, point.y, point.z);
        sprite.scale.set(scaleX, scaleY, 1);
        sprite.material.rotation = -0.55 + (Math.random() - 0.5) * 0.18;
        group.add(sprite);

        items.push({
            sprite,
            material,
            scaleX,
            scaleY,
            phase: Math.random() * TAU,
            baseOpacity: material.opacity
        });
    }

    return { group, items };
}

function createAnchorOptics(glowTexture, starPosition, colors, count, exclusionRadius = 6.4) {
    const group = new THREE.Group();
    const items = [];

    for (let index = 0; index < count; index += 1) {
        let point = sampleAnchorField(starPosition);
        let guard = 0;

        while (tooCloseToStar(point, starPosition, exclusionRadius) && guard < 24) {
            point = sampleAnchorField(starPosition);
            guard += 1;
        }

        const brightness = Math.random();
        const warm = brightness > 0.45;
        const tint = warm ? colors.opticWarm : colors.opticCool;
        const baseScale = 0.4 + brightness * 0.88;
        const coreOpacity = 0.18 + brightness * 0.2;

        const coreMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            color: tint,
            transparent: true,
            opacity: coreOpacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });
        const haloMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            color: tint,
            transparent: true,
            opacity: coreOpacity * 0.28,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });

        const core = new THREE.Sprite(coreMaterial);
        const halo = new THREE.Sprite(haloMaterial);

        core.position.set(point.x, point.y, point.z);
        halo.position.copy(core.position);

        core.scale.set(baseScale, baseScale, 1);
        halo.scale.set(baseScale * (2.3 + brightness * 0.88), baseScale * (2.3 + brightness * 0.88), 1);

        group.add(halo);
        group.add(core);

        items.push({
            core,
            halo,
            coreMaterial,
            haloMaterial,
            baseScale,
            haloScale: halo.scale.x,
            brightness,
            phase: Math.random() * TAU
        });
    }

    return { group, items };
}

function createHeroPsfMaterial(tint) {
    const material = new THREE.MeshBasicNodeMaterial();
    material.transparent = true;
    material.blending = THREE.AdditiveBlending;
    material.depthWrite = false;
    material.toneMapped = false;

    const centered = uv().sub(vec2(0.5, 0.5)).mul(2.0);
    const radiusSq = dot(centered, centered);
    const halo = radiusSq.mul(1.06).oneMinus().clamp(0, 1).pow(1.8).mul(0.5);
    const core = radiusSq.mul(5.2).oneMinus().clamp(0, 1).pow(10.2).mul(1.26);
    const shoulder = radiusSq.mul(2.1).oneMinus().clamp(0, 1).pow(4.0).mul(0.16);
    const spikeFalloff = radiusSq.mul(0.64).oneMinus().clamp(0, 1).pow(1.18);
    const spikeX = centered.x.abs().mul(22.0).oneMinus().clamp(0, 1).pow(8.0).mul(spikeFalloff);
    const spikeY = centered.y.abs().mul(22.0).oneMinus().clamp(0, 1).pow(8.0).mul(spikeFalloff);
    const diagA = centered.x.add(centered.y).abs().mul(14.0).oneMinus().clamp(0, 1).pow(6.4).mul(spikeFalloff.mul(0.8));
    const diagB = centered.x.sub(centered.y).abs().mul(14.0).oneMinus().clamp(0, 1).pow(6.4).mul(spikeFalloff.mul(0.8));
    const diffraction = spikeX.add(spikeY).mul(0.42).add(diagA.add(diagB).mul(0.16));
    const psf = halo.add(shoulder).add(core).add(diffraction);

    material.colorNode = color(tint)
        .mul(psf.mul(1.02))
        .add(color(0xffffff).mul(core.mul(0.32)));
    material.opacityNode = psf.clamp(0, 1);

    return material;
}

function createHeroAnchorPsf(starPosition, colors, count, exclusionRadius = 7.2) {
    const group = new THREE.Group();
    const items = [];
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);

    for (let index = 0; index < count; index += 1) {
        let point = sampleAnchorField(starPosition);
        let guard = 0;

        while (tooCloseToStar(point, starPosition, exclusionRadius) && guard < 24) {
            point = sampleAnchorField(starPosition);
            guard += 1;
        }

        const brightness = 0.55 + Math.random() * 0.45;
        const warm = brightness > 0.7 || index % 3 !== 0;
        const tint = warm ? colors.heroWarm : colors.heroCool;
        const material = createHeroPsfMaterial(tint);
        const mesh = new THREE.Mesh(geometry, material);
        const scale = 1.04 + brightness * 1.6;
        mesh.position.set(point.x, point.y, point.z);
        mesh.scale.set(scale, scale, 1);
        group.add(mesh);

        items.push({
            mesh,
            material,
            scale,
            brightness,
            phase: Math.random() * TAU,
            baseOpacity: 0.82 + brightness * 0.16
        });
    }

    return { group, items };
}

function resolveAccentColor(colors, token, fallback = 0xffffff) {
    if (typeof token === "number") {
        return token;
    }

    switch (token) {
        case "warm":
        case "heroWarm":
            return colors.heroWarm;
        case "cool":
        case "heroCool":
            return colors.heroCool;
        case "opticWarm":
            return colors.opticWarm;
        case "opticCool":
            return colors.opticCool;
        case "glow":
            return colors.glow;
        case "corona":
            return colors.corona;
        default:
            return fallback;
    }
}

function createAccentOrbs(pointTexture, glowTexture, colors, specs = []) {
    const group = new THREE.Group();
    const items = [];

    specs.forEach((spec) => {
        const coreMaterial = new THREE.SpriteMaterial({
            map: pointTexture,
            color: resolveAccentColor(colors, spec.color, colors.heroWarm),
            transparent: true,
            opacity: spec.opacity ?? 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });
        const haloMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            color: resolveAccentColor(colors, spec.haloColor ?? spec.color, colors.opticWarm),
            transparent: true,
            opacity: spec.haloOpacity ?? 0.08,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });

        const core = new THREE.Sprite(coreMaterial);
        const halo = new THREE.Sprite(haloMaterial);
        const x = spec.x ?? 0;
        const y = spec.y ?? 0;
        const z = spec.z ?? -36;
        const scale = spec.scale ?? 0.5;
        const haloScale = scale * (spec.haloScale ?? 2.8);

        core.position.set(x, y, z);
        halo.position.set(x, y, z);
        core.scale.set(scale, scale, 1);
        halo.scale.set(haloScale, haloScale, 1);

        group.add(halo);
        group.add(core);

        items.push({
            core,
            halo,
            coreMaterial,
            haloMaterial,
            baseOpacity: coreMaterial.opacity,
            baseHaloOpacity: haloMaterial.opacity,
            baseScale: scale,
            baseHaloScale: haloScale,
            x,
            y,
            z,
            phase: Math.random() * TAU,
            twinkle: spec.twinkle ?? 0.1
        });
    });

    return { group, items };
}

function revealStatus(statusEl, text) {
    if (!statusEl) {
        return;
    }

    statusEl.textContent = text;
    const hiddenAncestor = statusEl.closest("[hidden]");

    if (hiddenAncestor && "hidden" in hiddenAncestor) {
        hiddenAncestor.hidden = false;
    }

    if (statusEl.parentElement && "hidden" in statusEl.parentElement) {
        statusEl.parentElement.hidden = false;
    }
}

export async function bootObservatoryStage({
    canvas,
    preset = "academy",
    statusEl = null
} = {}) {
    const config = PRESETS[preset] || PRESETS.academy;
    const colors = COLOR_PROFILES[config.profile] || COLOR_PROFILES.warm;

    if (!canvas || !("gpu" in navigator)) {
        revealStatus(statusEl, "WebGPU unavailable");
        return null;
    }

    try {
        const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const [surfaceSource, paletteSource] = await Promise.all([
            loadImage(new URL("./academy-star/sun_surface.png", import.meta.url).href),
            loadImage(new URL("./academy-star/star_colorshift.png", import.meta.url).href)
        ]);

        const renderer = new THREE.WebGPURenderer({
            canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });

        const getPixelRatioCap = () => (window.innerWidth < 900 ? 1.42 : 1.82);
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getPixelRatioCap()));
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.78;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        const mobile = window.innerWidth < 900;
        const cameraConfig = mobile && config.mobileCamera ? config.mobileCamera : config.camera;
        const baseCameraPosition = new THREE.Vector3(cameraConfig.x, cameraConfig.y, cameraConfig.z);
        const camera = new THREE.PerspectiveCamera(cameraConfig.fov, window.innerWidth / window.innerHeight, 0.1, 260);
        camera.position.copy(baseCameraPosition);

        const postProcessing = new THREE.PostProcessing(renderer);
        const scenePass = pass(scene, camera);
        const scenePassColor = scenePass.getTextureNode("output");
        const bloomPass = bloom(scenePassColor, ...config.bloom);
        postProcessing.outputNode = scenePassColor.add(bloomPass);

        const glowTexture = configureTexture(new THREE.CanvasTexture(buildGlowTexture(96, config.profile)));
        const pointTexture = configureTexture(new THREE.CanvasTexture(buildPointStarTexture(96, config.profile, 1)));
        const sparkleTexture = configureTexture(new THREE.CanvasTexture(buildPointStarTexture(128, config.profile, 1.55)));
        const hazeTextureA = configureTexture(new THREE.CanvasTexture(buildGalacticHazeTexture(2048, 640, colors.hazeBlue)));
        const hazeTextureB = configureTexture(new THREE.CanvasTexture(buildGalacticHazeTexture(2048, 640, colors.hazeWarm)));
        const dustTextureA = configureTexture(new THREE.CanvasTexture(buildDustLaneTexture(2048, 640)));
        const dustTextureB = configureTexture(new THREE.CanvasTexture(buildDustLaneTexture(2048, 640)));
        const coronaTexture = configureTexture(new THREE.CanvasTexture(buildCoronaTexture(window.innerWidth < 900 ? 720 : 1024, config.profile)));
        const prominenceTextureA = configureTexture(new THREE.CanvasTexture(buildProminenceTexture(window.innerWidth < 900 ? 640 : 760, window.innerWidth < 900 ? 220 : 260, 2.8, config.profile)));
        const prominenceTextureB = configureTexture(new THREE.CanvasTexture(buildProminenceTexture(window.innerWidth < 900 ? 640 : 760, window.innerWidth < 900 ? 220 : 260, 7.6, config.profile)));
        const sourceSurfaceTexture = configureTexture(new THREE.Texture(surfaceSource));
        const paletteTexture = configureTexture(new THREE.Texture(paletteSource));

        sourceSurfaceTexture.wrapS = THREE.RepeatWrapping;
        sourceSurfaceTexture.wrapT = THREE.RepeatWrapping;
        sourceSurfaceTexture.anisotropy = 12;
        paletteTexture.wrapS = THREE.ClampToEdgeWrapping;
        paletteTexture.wrapT = THREE.ClampToEdgeWrapping;

        const backgroundRoot = new THREE.Group();
        scene.add(backgroundRoot);

        const hazeA = new THREE.Sprite(new THREE.SpriteMaterial({
            map: hazeTextureA,
            transparent: true,
            opacity: config.haze[0],
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        }));
        hazeA.position.set(-3.4, -0.38, -82);
        hazeA.scale.set(112, 30, 1);
        hazeA.material.rotation = -0.56;
        backgroundRoot.add(hazeA);

        const bandCoreA = new THREE.Sprite(new THREE.SpriteMaterial({
            map: hazeTextureB,
            transparent: true,
            opacity: config.haze[0] * 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        }));
        bandCoreA.position.set(-0.8, -0.42, -84);
        bandCoreA.scale.set(90, 11.2, 1);
        bandCoreA.material.rotation = -0.55;
        backgroundRoot.add(bandCoreA);

        const hazeB = new THREE.Sprite(new THREE.SpriteMaterial({
            map: hazeTextureB,
            transparent: true,
            opacity: config.haze[1],
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        }));
        hazeB.position.set(0.8, -1.08, -78);
        hazeB.scale.set(96, 24, 1);
        hazeB.material.rotation = -0.51;
        backgroundRoot.add(hazeB);

        const bandCoreB = new THREE.Sprite(new THREE.SpriteMaterial({
            map: hazeTextureA,
            transparent: true,
            opacity: config.haze[1] * 0.68,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        }));
        bandCoreB.position.set(2.4, -0.84, -76);
        bandCoreB.scale.set(82, 10.4, 1);
        bandCoreB.material.rotation = -0.5;
        backgroundRoot.add(bandCoreB);

        const dustA = new THREE.Sprite(new THREE.SpriteMaterial({
            map: dustTextureA,
            transparent: true,
            opacity: config.dust[0],
            depthWrite: false,
            toneMapped: false
        }));
        dustA.position.set(-1.2, -1.1, -74);
        dustA.scale.set(92, 24, 1);
        dustA.material.rotation = -0.55;
        backgroundRoot.add(dustA);

        const dustB = new THREE.Sprite(new THREE.SpriteMaterial({
            map: dustTextureB,
            transparent: true,
            opacity: config.dust[1],
            depthWrite: false,
            toneMapped: false
        }));
        dustB.position.set(3.2, -0.5, -70);
        dustB.scale.set(84, 20, 1);
        dustB.material.rotation = -0.5;
        backgroundRoot.add(dustB);

        const starRoot = new THREE.Group();
        scene.add(starRoot);
        const activeStarPosition = mobile ? config.mobileStar : config.star;
        const starPosition = new THREE.Vector3(activeStarPosition.x, activeStarPosition.y, 0);

        const mainBodyVisible = config.mainBodyVisible !== false;
        starRoot.visible = mainBodyVisible;
        const sceneKind = config.scene || (mainBodyVisible ? "heroStar" : "deepField");

        const activeFocus = mobile && config.mobileFocus
            ? config.mobileFocus
            : config.focus || { x: activeStarPosition.x, y: activeStarPosition.y };
        const focusPosition = new THREE.Vector3(activeFocus.x, activeFocus.y, 0);
        const backgroundAnchor = mainBodyVisible ? starPosition : focusPosition;

        const deviceScale = window.innerWidth < 900 ? 0.58 : window.innerWidth > 1600 ? 1.08 : 0.86;
        const fieldScale = deviceScale * config.fieldDensity;
        const opticsScale = fieldScale * config.opticsScale;
        const exclusionBase = mainBodyVisible
            ? 1
            : sceneKind === "catalogField"
                ? 0.08
                : sceneKind === "taxonomy"
                    ? 0.12
                    : sceneKind === "formation"
                        ? 0.16
                        : 0.18;

        const farUniform = createStarLayer({
            count: scaledCount(config.stars.far * 4.0, fieldScale),
            size: 0.09,
            opacity: 0.64,
            glowTexture: pointTexture,
            sampler: () => sampleUniform({ x: 108, y: 64 }, 36, 180),
            colorMode: "mixed",
            profile: config.profile,
            starPosition: backgroundAnchor,
            exclusionRadius: 2.8 * exclusionBase
        });
        backgroundRoot.add(farUniform);

        const galacticDense = createStarLayer({
            count: scaledCount(config.stars.far * 2.7, fieldScale),
            size: 0.114,
            opacity: 0.86,
            glowTexture: pointTexture,
            sampler: () => sampleBand(-0.6, -0.3, -0.55, 90, 6.9, 30, 150),
            colorMode: "band",
            profile: config.profile,
            starPosition: backgroundAnchor,
            exclusionRadius: 3.8 * exclusionBase
        });
        backgroundRoot.add(galacticDense);

        const { group: galacticKnots, items: galacticKnotItems } = createGalacticKnots(
            glowTexture,
            backgroundAnchor,
            colors,
            scaledCount(16, config.fieldDensity * (window.innerWidth < 900 ? 0.68 : 1)),
            6.2 * exclusionBase
        );
        backgroundRoot.add(galacticKnots);

        const sparkleField = createStarLayer({
            count: scaledCount(config.stars.far * 1.05, fieldScale),
            size: 0.14,
            opacity: 0.42,
            glowTexture: sparkleTexture,
            sampler: () => sampleUniform({ x: 102, y: 62 }, 28, 168),
            colorMode: "mixed",
            profile: config.profile,
            starPosition: backgroundAnchor,
            exclusionRadius: 4.2 * exclusionBase
        });
        backgroundRoot.add(sparkleField);

        const nearBand = createStarLayer({
            count: scaledCount(config.stars.near * 3.4, fieldScale),
            size: 0.17,
            opacity: 0.64,
            glowTexture: pointTexture,
            sampler: () => sampleBand(-0.8, -0.15, -0.55, 84, 9.4, 22, 118),
            colorMode: "band",
            profile: config.profile,
            starPosition: backgroundAnchor,
            exclusionRadius: 4.4 * exclusionBase
        });
        backgroundRoot.add(nearBand);

        const bandHighlights = createStarLayer({
            count: scaledCount(config.stars.near * 2.0, fieldScale),
            size: 0.23,
            opacity: 0.98,
            glowTexture: sparkleTexture,
            sampler: () => sampleBand(-0.42, -0.22, -0.55, 82, 4.6, 24, 126),
            colorMode: "band",
            profile: config.profile,
            starPosition: backgroundAnchor,
            exclusionRadius: 4.8 * exclusionBase
        });
        backgroundRoot.add(bandHighlights);

        const midField = createStarLayer({
            count: scaledCount(config.stars.near * 2.6, fieldScale),
            size: 0.22,
            opacity: 0.8,
            glowTexture: sparkleTexture,
            sampler: () => sampleMixedField(backgroundAnchor),
            colorMode: "mixed",
            profile: config.profile,
            starPosition: backgroundAnchor,
            exclusionRadius: 4.4 * exclusionBase
        });
        backgroundRoot.add(midField);

        const brightField = createStarLayer({
            count: scaledCount(config.stars.near * 0.55, fieldScale),
            size: 0.38,
            opacity: 1,
            glowTexture: sparkleTexture,
            sampler: () => sampleMixedField(backgroundAnchor),
            colorMode: "band",
            profile: config.profile,
            starPosition: backgroundAnchor,
            exclusionRadius: 5.4 * exclusionBase
        });
        backgroundRoot.add(brightField);

        const { group: anchorBursts, items: anchorBurstItems } = createAnchorBursts(
            sparkleTexture,
            backgroundAnchor,
            colors,
            scaledCount(28, opticsScale),
            5.2 * exclusionBase
        );
        backgroundRoot.add(anchorBursts);

        const { group: anchorOptics, items: anchorOpticItems } = createAnchorOptics(
            sparkleTexture,
            backgroundAnchor,
            colors,
            scaledCount(14, opticsScale),
            6.4 * exclusionBase
        );
        backgroundRoot.add(anchorOptics);

        const { group: heroPsfGroup, items: heroPsfItems } = createHeroAnchorPsf(
            backgroundAnchor,
            colors,
            Math.max(3, Math.round(config.heroCount * (window.innerWidth < 900 ? 0.6 : 1))),
            7.2 * exclusionBase
        );
        backgroundRoot.add(heroPsfGroup);

        // Create accent orbs if specified (for non-hero scenes)
        let accentOrbsGroup = null;
        let accentOrbItems = [];
        if (config.accentOrbs && config.accentOrbs.length > 0) {
            const { group, items } = createAccentOrbs(pointTexture, glowTexture, colors, config.accentOrbs);
            accentOrbsGroup = group;
            accentOrbItems = items;
            scene.add(accentOrbsGroup);
        }

        // Main star body - only created if mainBodyVisible is true (defaults to true for backward compatibility)
        let coreMesh = null;
        let limbGlowMesh = null;
        let softGlowMaterial = null;
        let coronaMaterial = null;
        let softGlowSprite = null;
        let coronaSprite = null;
        let prominenceSprites = [];

        if (mainBodyVisible) {
            const segments = window.innerWidth > 1600 ? 224 : window.innerWidth < 900 ? 156 : 192;
            const coreGeometry = new THREE.SphereGeometry(1.68, segments, segments);
            const glowGeometry = new THREE.SphereGeometry(1.75, segments, segments);

            const coreMaterial = new THREE.MeshBasicNodeMaterial();
            coreMaterial.toneMapped = true;

            const baseUv = uv();
            const flowUvA = baseUv.add(vec2(time.mul(0.0033), 0.0));
            const flowUvB = baseUv.add(vec2(time.mul(-0.0076), time.mul(0.1).sin().mul(0.016)));
            const flowUvC = baseUv.add(vec2(baseUv.y.mul(8.4).sin().mul(0.016), time.mul(0.0044)));
            const flowUvD = baseUv.add(vec2(time.mul(-0.0028), time.mul(0.005)));
            const baseField = texture(sourceSurfaceTexture, flowUvA).r.mul(0.48);
            const secondaryField = texture(sourceSurfaceTexture, flowUvB).r.mul(0.32);
            const detailField = texture(sourceSurfaceTexture, flowUvC).r.mul(0.2);
            const convectionField = texture(
                sourceSurfaceTexture,
                flowUvD.add(vec2(baseUv.y.mul(22.0).sin().mul(0.008), baseUv.x.mul(15.0).cos().mul(0.008)))
            ).r.mul(0.22);
            const surfaceField = tslClamp(
                baseField
                    .add(secondaryField)
                    .add(detailField)
                    .add(convectionField)
                    .add(baseUv.x.mul(13.4).add(baseUv.y.mul(5.1)).add(time.mul(0.05)).sin().mul(0.032))
                    .add(baseUv.y.mul(17.2).sub(baseUv.x.mul(3.6)).sub(time.mul(0.033)).sin().mul(0.026)),
                0,
                1
            );
            const hotField = texture(sourceSurfaceTexture, flowUvB.add(vec2(0.044, -0.03))).r;
            const patchField = texture(sourceSurfaceTexture, flowUvC.add(vec2(-0.036, 0.024))).r;
            const flowBand = baseUv.y.mul(24.0).add(time.mul(0.07)).sin().mul(0.5).add(0.5);
            const paletteField = tslClamp(surfaceField.mul(0.76).add(hotField.mul(0.18)).add(flowBand.mul(0.06)), 0, 1);
            const paletteBase = texture(paletteTexture, vec2(paletteField.mul(0.88).add(0.04), 0.5)).rgb;
            const paletteHot = texture(paletteTexture, vec2(tslClamp(paletteField.mul(0.74).add(0.24), 0, 1), 0.5)).rgb;
            const paletteShadow = texture(paletteTexture, vec2(paletteField.mul(0.36).add(0.04), 0.5)).rgb;
            const facing = dot(normalView, positionViewDirection).clamp();
            const rimHeat = facing.oneMinus().pow(3.5);
            const centerHeat = facing.pow(0.78);
            const hotMask = tslClamp(
                hotField.mul(0.62)
                    .add(surfaceField.mul(surfaceField).mul(0.42))
                    .add(detailField.mul(0.14))
                    .sub(patchField.oneMinus().mul(0.06)),
                0,
                1
            );
            const darkPatchMask = tslClamp(
                patchField.oneMinus().mul(patchField.oneMinus()).mul(0.34)
                    .add(baseField.oneMinus().mul(0.16))
                    .add(rimHeat.mul(0.06)),
                0,
                1
            );

            coreMaterial.colorNode = paletteBase
                .mul(color(colors.baseTint))
                .mul(colors.baseMix)
                .add(paletteHot.mul(color(colors.hotTint)).mul(hotMask.mul(1.28).add(centerHeat.mul(0.06))))
                .sub(paletteShadow.mul(color(colors.shadowTint)).mul(darkPatchMask.mul(0.26)))
                .add(color(colors.warmthTint).mul(centerHeat.mul(0.14).add(rimHeat.mul(0.12))))
                .add(color(colors.emberTint).mul(surfaceField.mul(0.1).add(hotMask.mul(0.44))))
                .add(color(colors.hotTint).mul(centerHeat.mul(0.16)))
                .add(color(colors.glow).mul(rimHeat.mul(0.1)))
                .sub(color(colors.shadowTint).mul(darkPatchMask.mul(0.92)));

            const limbGlowMaterial = new THREE.MeshBasicNodeMaterial();
            limbGlowMaterial.transparent = true;
            limbGlowMaterial.blending = THREE.AdditiveBlending;
            limbGlowMaterial.side = THREE.BackSide;
            limbGlowMaterial.depthWrite = false;
            limbGlowMaterial.toneMapped = false;

            const shellRim = dot(normalView, positionViewDirection).abs().oneMinus().pow(2.0);
            const shellBands = uv().y.mul(18.0).add(time.mul(0.12)).sin().mul(0.5).add(0.5);
            const shellSwirl = positionLocal.x.mul(6.1)
                .add(positionLocal.y.mul(4.9))
                .sub(positionLocal.z.mul(3.2))
                .add(time.mul(0.07))
                .sin()
                .mul(0.5)
                .add(0.5);
            const shellMask = tslClamp(shellBands.mul(0.54).add(shellSwirl.mul(0.46)), 0, 1);
            limbGlowMaterial.positionNode = positionLocal.add(normalLocal.mul(shellRim.mul(0.14).mul(shellMask.mul(0.32).add(0.72)).add(0.03)));
            limbGlowMaterial.colorNode = color(colors.limb).mul(shellRim.mul(0.6).add(shellMask.mul(0.13)).add(0.08));
            limbGlowMaterial.opacityNode = shellRim.mul(shellMask.mul(0.36).add(0.64)).pow(1.18).mul(0.24);

            coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
            limbGlowMesh = new THREE.Mesh(glowGeometry, limbGlowMaterial);
            coreMesh.rotation.z = -0.1;
            limbGlowMesh.rotation.z = -0.08;
            starRoot.add(coreMesh);
            starRoot.add(limbGlowMesh);

            softGlowMaterial = new THREE.SpriteMaterial({
                map: glowTexture,
                color: colors.glow,
                transparent: true,
                opacity: config.glow,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false
            });
            coronaMaterial = new THREE.SpriteMaterial({
                map: coronaTexture,
                color: colors.corona,
                transparent: true,
                opacity: config.corona,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false
            });

            softGlowSprite = new THREE.Sprite(softGlowMaterial);
            softGlowSprite.scale.set(5.1, 5.1, 1);
            starRoot.add(softGlowSprite);

            coronaSprite = new THREE.Sprite(coronaMaterial);
            coronaSprite.scale.set(7.2, 7.2, 1);
            starRoot.add(coronaSprite);

            const prominenceConfigs = [
                { angle: 0.4, radius: 1.96, scaleX: 1.12, scaleY: 0.32, opacity: 0.022, phase: 0.2, rotationOffset: 1.56 },
                { angle: 2.5, radius: 2.02, scaleX: 1.22, scaleY: 0.34, opacity: 0.026, phase: 2.4, rotationOffset: 1.42 },
                { angle: 3.46, radius: 2.08, scaleX: 1.08, scaleY: 0.28, opacity: 0.02, phase: 3.0, rotationOffset: 1.62 },
                { angle: 5.72, radius: 2.02, scaleX: 0.92, scaleY: 0.24, opacity: 0.018, phase: 4.1, rotationOffset: 1.74 }
            ];

            prominenceSprites = prominenceConfigs.map((entry, index) => {
                const material = new THREE.SpriteMaterial({
                    map: index % 2 === 0 ? prominenceTextureA : prominenceTextureB,
                    color: index % 2 === 0 ? colors.limb : colors.corona,
                    transparent: true,
                    opacity: entry.opacity,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    toneMapped: false
                });

                const sprite = new THREE.Sprite(material);
                sprite.scale.set(entry.scaleX, entry.scaleY, 1);
                starRoot.add(sprite);

                return { sprite, material, entry };
            });
        }

        const pointerTarget = new THREE.Vector2();
        const pointerCurrent = new THREE.Vector2();
        const lookTarget = new THREE.Vector3();
        const clock = new THREE.Clock();

        function applyLayout() {
            const isMobile = window.innerWidth < 900;
            const star = isMobile ? config.mobileStar : config.star;
            const activeCamera = isMobile && config.mobileCamera ? config.mobileCamera : config.camera;
            const layoutFocus = isMobile && config.mobileFocus
                ? config.mobileFocus
                : config.focus || star;

            focusPosition.set(layoutFocus.x, layoutFocus.y, 0);
            starRoot.visible = mainBodyVisible;
            starRoot.position.set(mainBodyVisible ? star.x : focusPosition.x, mainBodyVisible ? star.y : focusPosition.y, 0);
            starRoot.scale.setScalar(star.scale);

            baseCameraPosition.set(activeCamera.x, activeCamera.y, activeCamera.z);
            camera.fov = activeCamera.fov;

            if (isMobile) {
                hazeA.scale.set(92, 28, 1);
                bandCoreA.scale.set(76, 10.6, 1);
                hazeB.scale.set(78, 22, 1);
                bandCoreB.scale.set(68, 9.8, 1);
                dustA.scale.set(86, 25, 1);
                dustB.scale.set(74, 20, 1);
            } else {
                hazeA.scale.set(112, 30, 1);
                bandCoreA.scale.set(90, 11.2, 1);
                hazeB.scale.set(96, 24, 1);
                bandCoreB.scale.set(82, 10.4, 1);
                dustA.scale.set(92, 24, 1);
                dustB.scale.set(84, 20, 1);
            }

            camera.updateProjectionMatrix();
        }

        function resize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            applyLayout();
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getPixelRatioCap()));
            renderer.setSize(window.innerWidth, window.innerHeight, false);
        }

        function onPointerMove(event) {
            const nx = event.clientX / window.innerWidth * 2 - 1;
            const ny = event.clientY / window.innerHeight * 2 - 1;
            pointerTarget.set(nx * (window.innerWidth < 900 ? 0.22 : 0.42), -ny * (window.innerWidth < 900 ? 0.14 : 0.24));
        }

        function onPointerLeave() {
            pointerTarget.set(0, 0);
        }

        function render() {
            const elapsed = clock.getElapsedTime();
            const motionFactor = reducedMotionQuery.matches ? 0 : 1;
            const isMobile = window.innerWidth < 900;
            const star = isMobile ? config.mobileStar : config.star;

            pointerCurrent.lerp(pointerTarget, reducedMotionQuery.matches ? 1 : 0.032);
            const focusDriftX = pointerCurrent.x * (mainBodyVisible ? 0.22 : 0.12);
            const focusDriftY = pointerCurrent.y * (mainBodyVisible ? 0.16 : 0.08);

            if (mainBodyVisible) {
                starRoot.position.x = star.x + focusDriftX;
                starRoot.position.y = star.y + focusDriftY;

                coreMesh.rotation.y = elapsed * 0.082 * motionFactor;
                limbGlowMesh.rotation.y = elapsed * 0.026 * motionFactor;
                softGlowMaterial.opacity = config.glow + Math.sin(elapsed * 0.44) * 0.012 * motionFactor;
                coronaMaterial.opacity = config.corona + Math.sin(elapsed * 0.38 + 0.4) * 0.006 * motionFactor;
                coronaMaterial.rotation = elapsed * 0.03 * motionFactor;
                softGlowSprite.scale.setScalar(5.1 + Math.sin(elapsed * 0.36) * 0.05 * motionFactor);
                coronaSprite.scale.setScalar(7.2 + Math.sin(elapsed * 0.32 + 0.4) * 0.1 * motionFactor);

                prominenceSprites.forEach(({ sprite, material, entry }, index) => {
                    const pulse = Math.sin(elapsed * (0.3 + index * 0.02) + entry.phase) * 0.5 + 0.5;
                    const radius = entry.radius + Math.sin(elapsed * 0.22 + entry.phase) * 0.04 * motionFactor;
                    material.opacity = entry.opacity * (0.82 + pulse * 0.38 * motionFactor);
                    sprite.position.set(Math.cos(entry.angle) * radius, Math.sin(entry.angle) * radius, -0.12);
                    sprite.scale.set(entry.scaleX * (0.96 + pulse * 0.12 * motionFactor), entry.scaleY * (0.92 + pulse * 0.2 * motionFactor), 1);
                    material.rotation = entry.angle + entry.rotationOffset + Math.sin(elapsed * 0.18 + entry.phase) * 0.05 * motionFactor;
                });
            }

            anchorBursts.position.x = pointerCurrent.x * 0.58;
            anchorBursts.position.y = pointerCurrent.y * 0.28;
            anchorBurstItems.forEach((item, index) => {
                const pulse = Math.sin(elapsed * (0.18 + index * 0.007) + item.phase) * 0.5 + 0.5;
                item.material.opacity = item.baseOpacity * (0.84 + pulse * 0.32 * motionFactor);
                const scalar = item.scale * (0.94 + pulse * 0.12 * motionFactor);
                item.sprite.scale.set(scalar, scalar, 1);
            });

            anchorOptics.position.x = pointerCurrent.x * 0.54;
            anchorOptics.position.y = pointerCurrent.y * 0.26;
            anchorOpticItems.forEach((item, index) => {
                const pulse = Math.sin(elapsed * (0.12 + index * 0.006) + item.phase) * 0.5 + 0.5;
                const shimmer = 0.88 + pulse * 0.22 * motionFactor;
                item.coreMaterial.opacity = (0.16 + item.brightness * 0.18) * shimmer;
                item.haloMaterial.opacity = (0.045 + item.brightness * 0.05) * (0.82 + pulse * 0.2 * motionFactor);

                const coreScale = item.baseScale * (0.96 + pulse * 0.08 * motionFactor);
                item.core.scale.set(coreScale, coreScale, 1);

                const haloScale = item.haloScale * (0.94 + pulse * 0.12 * motionFactor);
                item.halo.scale.set(haloScale, haloScale, 1);
            });

            heroPsfGroup.position.x = pointerCurrent.x * 0.48;
            heroPsfGroup.position.y = pointerCurrent.y * 0.24;
            heroPsfItems.forEach((item, index) => {
                const pulse = Math.sin(elapsed * (0.1 + index * 0.004) + item.phase) * 0.5 + 0.5;
                const scalar = item.scale * (0.96 + pulse * 0.08 * motionFactor);
                item.mesh.scale.set(scalar, scalar, 1);
                item.mesh.quaternion.copy(camera.quaternion);
                item.material.opacity = item.baseOpacity * (0.88 + pulse * 0.16 * motionFactor);
            });

            galacticKnots.position.x = pointerCurrent.x * 0.12;
            galacticKnots.position.y = pointerCurrent.y * 0.08;
            galacticKnotItems.forEach((item, index) => {
                const pulse = Math.sin(elapsed * (0.08 + index * 0.005) + item.phase) * 0.5 + 0.5;
                item.material.opacity = item.baseOpacity * (0.9 + pulse * 0.18 * motionFactor);
                item.sprite.scale.set(
                    item.scaleX * (0.98 + pulse * 0.06 * motionFactor),
                    item.scaleY * (0.98 + pulse * 0.08 * motionFactor),
                    1
                );
            });

            if (accentOrbsGroup) {
                const accentParallax = sceneKind === "taxonomy" ? 0.4 : sceneKind === "catalogField" ? 0.22 : 0.3;
                accentOrbsGroup.position.x = pointerCurrent.x * accentParallax;
                accentOrbsGroup.position.y = pointerCurrent.y * accentParallax * 0.56;
                accentOrbItems.forEach((item, index) => {
                    const pulse = Math.sin(elapsed * (0.12 + index * 0.03) + item.phase) * 0.5 + 0.5;
                    const twinkle = 1 + pulse * item.twinkle * motionFactor;
                    item.coreMaterial.opacity = item.baseOpacity * twinkle;
                    item.haloMaterial.opacity = item.baseHaloOpacity * (0.9 + pulse * 0.45 * motionFactor);
                    item.core.scale.set(item.baseScale * (0.98 + pulse * 0.08 * motionFactor), item.baseScale * (0.98 + pulse * 0.08 * motionFactor), 1);
                    item.halo.scale.set(
                        item.baseHaloScale * (0.96 + pulse * 0.12 * motionFactor),
                        item.baseHaloScale * (0.96 + pulse * 0.12 * motionFactor),
                        1
                    );
                });
            }

            backgroundRoot.position.x = pointerCurrent.x * 0.18;
            backgroundRoot.position.y = pointerCurrent.y * 0.12;
            farUniform.rotation.y = elapsed * 0.0012 * motionFactor;
            galacticDense.rotation.y = -elapsed * 0.0016 * motionFactor;
            sparkleField.rotation.y = elapsed * 0.0017 * motionFactor;
            nearBand.rotation.y = elapsed * 0.0021 * motionFactor;
            bandHighlights.rotation.y = -elapsed * 0.0018 * motionFactor;
            midField.rotation.y = elapsed * 0.0024 * motionFactor;
            brightField.rotation.y = -elapsed * 0.0032 * motionFactor;

            if (mainBodyVisible) {
                lookTarget.copy(starRoot.position);
            } else {
                lookTarget.set(focusPosition.x + focusDriftX, focusPosition.y + focusDriftY, 0);
            }
            camera.position.x = baseCameraPosition.x + pointerCurrent.x * (isMobile ? 0.18 : 0.3);
            camera.position.y = baseCameraPosition.y + pointerCurrent.y * (isMobile ? 0.1 : 0.18);
            camera.position.z = baseCameraPosition.z;
            camera.lookAt(lookTarget);

            postProcessing.render();
        }

        function updateAnimationMode() {
            const label = reducedMotionQuery.matches
                ? "WebGPU observatory runtime • reduced motion"
                : "WebGPU observatory runtime • layered deep-space field active";

            revealStatus(statusEl, label);

            if (reducedMotionQuery.matches) {
                renderer.setAnimationLoop(null);
                render();
                return;
            }

            renderer.setAnimationLoop(render);
        }

        window.addEventListener("resize", resize, { passive: true });
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        document.body.addEventListener("pointerleave", onPointerLeave, { passive: true });

        if (typeof reducedMotionQuery.addEventListener === "function") {
            reducedMotionQuery.addEventListener("change", updateAnimationMode);
        } else if (typeof reducedMotionQuery.addListener === "function") {
            reducedMotionQuery.addListener(updateAnimationMode);
        }

        applyLayout();
        resize();
        updateAnimationMode();

        return {
            renderer,
            scene,
            camera,
            dispose() {
                renderer.setAnimationLoop(null);
                renderer.dispose();
            }
        };
    } catch (error) {
        console.error(error);
        revealStatus(statusEl, "WebGPU init failed");
        return null;
    }
}
