export function bootCollapsiblePanels(root = document) {
    const panels = [...root.querySelectorAll("[data-collapsible-panel]")];

    panels.forEach((panel, index) => {
        const toggle = panel.querySelector("[data-panel-toggle]");
        if (!toggle) {
            return;
        }

        const panelId = panel.id || `panel-${index + 1}`;
        if (!panel.id) {
            panel.id = panelId;
        }

        const bodyNodes = [...panel.querySelectorAll("[data-panel-body]")];
        bodyNodes.forEach((node, bodyIndex) => {
            if (!node.id) {
                node.id = `${panelId}-body-${bodyIndex + 1}`;
            }
        });

        if (bodyNodes.length > 0) {
            toggle.setAttribute("aria-controls", bodyNodes.map((node) => node.id).join(" "));
        }

        const openLabel = toggle.dataset.openLabel || "Collapse panel";
        const closedLabel = toggle.dataset.closedLabel || "Expand panel";

        function sync(collapsed) {
            panel.dataset.collapsed = collapsed ? "true" : "false";
            toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
            toggle.setAttribute("aria-label", collapsed ? closedLabel : openLabel);
            const textSlot = toggle.querySelector("[data-panel-toggle-text]");
            if (textSlot) {
                textSlot.textContent = collapsed ? "Expand" : "Collapse";
            }
        }

        toggle.addEventListener("click", () => {
            sync(panel.dataset.collapsed !== "true");
        });

        sync(panel.dataset.defaultCollapsed === "true");
    });
}
