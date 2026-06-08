// =============================================================================
// debug-overlay.js — a live inspector for the runner. Toggle with the backtick
// key (`). Dumb display code: it renders runner.getDebugSnapshot() and reaches
// into no internals. Read-only; pointer-events off so it never eats clicks.
// =============================================================================

/**
 * Creates the debug overlay and starts polling the runner for state.
 *
 * @param {object} options - { getRunner } — returns the live SceneRunner or null.
 * @returns {void}
 */
export function createDebugOverlay({ getRunner }) {
  const el = document.createElement("div");
  el.className = "debug-overlay";
  el.hidden = true;
  document.body.append(el);

  let visible = false;

  const render = () => {
    if (!visible) {
      return;
    }
    const runner = getRunner?.();
    if (!runner?.getDebugSnapshot) {
      el.textContent = "debug · no game running";
      return;
    }
    el.textContent = describe(runner.getDebugSnapshot());
  };

  window.addEventListener("keydown", (event) => {
    if (event.key === "`" || event.key === "~") {
      visible = !visible;
      el.hidden = !visible;
      render();
    }
  });

  // Poll rather than hook every render path — cheap and decoupled.
  window.setInterval(render, 150);
}

/**
 * Builds the multi-line readout from a runner debug snapshot.
 *
 * @param {object} snap - runner.getDebugSnapshot() output.
 * @returns {string} Text block.
 */
function describe(snap) {
  const lines = [
    `scene   ${snap.sceneId}   cmd #${snap.commandIndex}/${snap.commandCount}`,
    `stage   ${snap.activeSurface ?? "—"}   stack [${snap.surfaceStack.join(" › ") || "—"}]`,
    `next    ${snap.nextCommand ?? "— (end)"}`,
    `speaker ${snap.speaker ?? "—"}`,
    `rewind  ${snap.rollback.size ? `${snap.rollback.pos + 1}/${snap.rollback.size}` : "—"}${snap.rollback.rewound ? "  ⟲ REWOUND" : ""}`,
    "sprites"
  ];

  if (snap.sprites.length) {
    for (const sprite of snap.sprites) {
      lines.push(`  ${sprite.id}: ${sprite.body ?? "default"} / ${sprite.outfit ?? "—"} / ${sprite.expression ?? "—"} @ ${sprite.side}${sprite.flip ? " ⇆" : ""}`);
    }
  } else {
    lines.push("  (none)");
  }

  const varKeys = Object.keys(snap.vars);
  lines.push(`vars    ${varKeys.length ? varKeys.map((k) => `${k}=${snap.vars[k]}`).join("  ") : "—"}`);

  return lines.join("\n");
}
