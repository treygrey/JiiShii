// =============================================================================
// markup.js — tiny, CSS-driven text markup for authored lines.
//
// Philosophy (Programming for English Majors): the author writes a word, CSS
// does the styling, and they can invent their own words. A macro is just a name
// that maps to a CSS class. Ship a few; let authors register the rest.
//
//   say("alex", "that was {b}not{/b} enough")          -> bold "not"
//   narrate("the room went {color=#ff5a5f}red{/color}")
//   say("alex", "you owe me {$debt} dollars")           -> interpolates a var
//
// Built-in macros: b, i, u, s, color(param). Add your own anywhere:
//   import { registerMarkup } from "../engine/dom/markup.js";
//   registerMarkup("whisper", "mk-whisper");   // then define .mk-whisper in CSS
//   registerMarkup("shake", { class: "mk-shake" });
//
// Safety: all literal text and interpolated values are HTML-escaped; the only
// tags emitted are <span> elements with class/style we control, so author text
// can never inject markup even though renderers use innerHTML.
// =============================================================================

/**
 * @typedef {Object} MacroDef
 * @property {string} [class] - CSS class applied to a `{name}…{/name}` span.
 * @property {(value: string) => { class?: string, style?: string }} [param]
 *   - For `{name=value}…{/name}`; returns the class/style for the span.
 */

/** @type {Record<string, MacroDef>} */
const MACROS = {
  b: { class: "mk-b" },
  i: { class: "mk-i" },
  u: { class: "mk-u" },
  s: { class: "mk-s" },
  // Expressive extras shipped with matching CSS (see styles.css).
  whisper: { class: "mk-whisper" },
  shake: { class: "mk-shake" },
  // Parameterized: {color=#ff5a5f}…{/color} or {color=rebeccapurple}…{/color}
  color: { param: (value) => ({ style: `color:${sanitizeColor(value)}` }) }
};

/** Provides the current variable bag for `{$var}` interpolation. */
let varsProvider = () => ({});

/**
 * Registers (or overrides) a markup macro.
 *
 * @param {string} name - Macro name used as `{name}…{/name}`.
 * @param {string | MacroDef} def - A CSS class name, or a full macro def.
 * @returns {void}
 */
export function registerMarkup(name, def) {
  MACROS[name] = typeof def === "string" ? { class: def } : def;
}

/**
 * Points the `{$var}` interpolation at the live variable bag. Called once at
 * boot with `() => runner.state.vars` so it stays correct across loads.
 *
 * @param {() => Record<string, unknown>} fn - Returns the current vars object.
 * @returns {void}
 */
export function setMarkupVarsProvider(fn) {
  varsProvider = fn;
}

/**
 * Renders an authored string to safe HTML: macros become styled spans, `{$var}`
 * is interpolated, and everything else is escaped literal text.
 *
 * @param {string} text - Authored line, possibly with markup.
 * @returns {string} Safe HTML.
 */
export function renderMarkup(text) {
  if (text == null) {
    return "";
  }
  const source = String(text);
  const vars = varsProvider() ?? {};
  let html = "";
  const openStack = []; // names of currently-open known macros
  let lastIndex = 0;
  const TOKEN = /\{([^{}]*)\}/g;
  let match;

  while ((match = TOKEN.exec(source)) !== null) {
    // Escaped literal text before this token.
    html += escapeHtml(source.slice(lastIndex, match.index));
    lastIndex = TOKEN.lastIndex;

    const body = match[1].trim();

    // Interpolation: {$varName}
    if (body.startsWith("$")) {
      const name = body.slice(1).trim();
      html += escapeHtml(String(vars[name] ?? ""));
      continue;
    }

    // Closing tag: {/name}
    if (body.startsWith("/")) {
      const name = body.slice(1).trim();
      if (MACROS[name] && openStack.length) {
        openStack.pop();
        html += "</span>";
      } else {
        html += escapeHtml(match[0]); // not a known/open macro — show literally
      }
      continue;
    }

    // Opening tag: {name} or {name=value}
    const eq = body.indexOf("=");
    const name = (eq === -1 ? body : body.slice(0, eq)).trim();
    const value = eq === -1 ? null : body.slice(eq + 1).trim();
    const def = MACROS[name];

    if (!def) {
      html += escapeHtml(match[0]); // unknown macro — show literally (loud-ish)
      continue;
    }

    let attrs;
    if (value !== null && def.param) {
      attrs = def.param(value);
    } else if (value === null && def.class) {
      attrs = { class: def.class };
    } else {
      html += escapeHtml(match[0]); // wrong form for this macro — show literally
      continue;
    }

    html += openSpan(attrs);
    openStack.push(name);
  }

  // Trailing literal text + close any spans the author left open.
  html += escapeHtml(source.slice(lastIndex));
  while (openStack.length) {
    openStack.pop();
    html += "</span>";
  }
  return html;
}

/**
 * Strips markup to plain text (for length-based timing and history logs).
 *
 * @param {string} text - Authored line.
 * @returns {string} Plain text with tags removed and vars interpolated.
 */
export function stripMarkup(text) {
  if (text == null) {
    return "";
  }
  const vars = varsProvider() ?? {};
  return String(text).replace(/\{([^{}]*)\}/g, (whole, inner) => {
    const body = inner.trim();
    if (body.startsWith("$")) {
      return String(vars[body.slice(1).trim()] ?? "");
    }
    const name = (body.startsWith("/") ? body.slice(1) : body.split("=")[0]).trim();
    return MACROS[name] ? "" : whole; // drop known tags, keep unknown text
  });
}

/**
 * Builds an opening span with controlled class/style attributes.
 *
 * @param {{ class?: string, style?: string }} attrs - Span attributes.
 * @returns {string} `<span …>`.
 */
function openSpan(attrs) {
  const parts = [];
  if (attrs.class) {
    parts.push(`class="${escapeAttr(attrs.class)}"`);
  }
  if (attrs.style) {
    parts.push(`style="${escapeAttr(attrs.style)}"`);
  }
  return parts.length ? `<span ${parts.join(" ")}>` : "<span>";
}

/**
 * Allows only safe color syntax (hex, named, rgb/hsl functions). Anything else
 * resolves to "inherit" so a bad value can't smuggle in other CSS.
 *
 * @param {string} value - Author-supplied color.
 * @returns {string} A safe color value.
 */
function sanitizeColor(value) {
  return /^[#\w(),.%\s-]+$/.test(value) ? value : "inherit";
}

/**
 * Escapes text for use as HTML body content.
 *
 * @param {string} text - Raw text.
 * @returns {string} Escaped text.
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escapes a value for use inside a double-quoted HTML attribute.
 *
 * @param {string} text - Raw attribute value.
 * @returns {string} Escaped value.
 */
function escapeAttr(text) {
  return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
