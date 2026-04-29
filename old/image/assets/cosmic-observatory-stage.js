import { bootObservatoryStage } from "./observatory-stage.js";

export function bootCosmicObservatoryStage(options = {}) {
    return bootObservatoryStage({
        ...options,
        preset: "cosmic"
    });
}
