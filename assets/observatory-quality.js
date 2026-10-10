// One finite policy shared by world representation, textures and GPU work.
export const QUALITY_KEYS = Object.freeze(['safe', 'standard', 'immersive']);
const profiles = {
  safe: {
    budget: { draw: 6000, dust: 10000, labels: 18, sky: 2500, transit: 650, galaxyStars: 512, galaxyReferences: 1536 },
    dustEnergy: 1.6, pixels: 518400, environmentScale: 1 / 4, bloomScale: 1 / 4, volumeScale: 1 / 3,
    earth: 1024, moon: 1024, mars: 1024, jupiter: 1024, mercury: 1024, height: 512, clouds: 1024, sky: 512,
    nebulaSteps: 12, galaxyLayers: 3
  },
  standard: {
    budget: { draw: 14000, dust: 30000, labels: 26, sky: 5000, transit: 1200, galaxyStars: 2048, galaxyReferences: 6144 },
    pixels: 2073600, environmentScale: 1 / 2, bloomScale: 1 / 4, volumeScale: 2 / 3,
    earth: 2048, moon: 2048, mars: 2048, jupiter: 2048, mercury: 2048, height: 1024, clouds: 2048, sky: 1024,
    nebulaSteps: 20, galaxyLayers: 4
  },
  immersive: {
    budget: { draw: 20000, dust: 45000, labels: 34, sky: 7000, transit: 1600, galaxyStars: 4096, galaxyReferences: 12288 },
    pixels: 2600000, environmentScale: 5 / 8, bloomScale: 1 / 3, volumeScale: 3 / 5,
    earth: 4096, moon: 2048, mars: 4096, jupiter: 4096, mercury: 4096, height: 1024, clouds: 2048, sky: 1024,
    nebulaSteps: 32, galaxyLayers: 6
  }
};
for (const [key, profile] of Object.entries(profiles)) {
  profile.key = key;
  Object.freeze(profile.budget);
  Object.freeze(profile);
}
export function qualityProfile(key) {
  return profiles[Object.hasOwn(profiles, key) ? key : 'standard'];
}
