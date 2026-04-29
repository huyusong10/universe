import { bootObservatoryStage } from "./observatory-stage.js";

export async function bootAcademyStageShell({ preset = "academy" } = {}) {
    const canvas = document.getElementById("sceneCanvas");
    const codeCopyButton = document.querySelector(".code-copy");
    const codeBlock = document.querySelector(".code-shell code");
    const runtimeState = document.getElementById("runtimeState");
    const runtimeStateText = document.getElementById("runtimeStateText");

    window.__ACADEMY_STAR_READY = false;
    window.__ACADEMY_STAR_ERROR = "";

    function setRuntimeState(mode, text) {
        if (!runtimeState || !runtimeStateText) {
            return;
        }

        runtimeState.hidden = false;
        runtimeState.dataset.mode = mode;
        runtimeStateText.textContent = text;
    }

    if (codeCopyButton && codeBlock && !codeCopyButton.dataset.academyCopyBound) {
        codeCopyButton.dataset.academyCopyBound = "true";
        const defaultLabel = codeCopyButton.textContent.trim();
        let resetTimer = 0;

        codeCopyButton.addEventListener("click", async () => {
            window.clearTimeout(resetTimer);

            try {
                await navigator.clipboard.writeText(codeBlock.textContent);
                codeCopyButton.textContent = "Copied";
            } catch (error) {
                codeCopyButton.textContent = "Copy failed";
            }

            resetTimer = window.setTimeout(() => {
                codeCopyButton.textContent = defaultLabel;
            }, 1200);
        });
    }

    try {
        const runtime = await bootObservatoryStage({
            canvas,
            preset,
            statusEl: runtimeStateText
        });

        if (runtime) {
            window.__ACADEMY_STAR_READY = true;
            setRuntimeState("live", runtimeStateText?.textContent || "WebGPU observatory runtime • layered deep-space field active");
        } else {
            setRuntimeState("unsupported", runtimeStateText?.textContent || "WebGPU unavailable");
        }
    } catch (error) {
        window.__ACADEMY_STAR_ERROR = error instanceof Error ? error.message : String(error);
        console.error(error);
        setRuntimeState("unsupported", `WebGPU init failed: ${window.__ACADEMY_STAR_ERROR}`);
    }
}
