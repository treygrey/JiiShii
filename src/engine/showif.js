// =============================================================================
// showIf — the tiny, human condition syntax shared by the runtime (to decide
// whether a choice option shows) and the validator (to check the variable
// exists). Forms: "flag", "!flag", "name OP value" (OP in > >= < <= == = !=),
// or a (vars) => boolean function.
// =============================================================================

/**
 * Human truthiness: off = false / 0 / "" / "0" / "false" / "no" / "off" /
 * null / undefined; on = everything else. (So storing the word "false" doesn't
 * count as on.)
 *
 * @param {*} value - Value to test.
 * @returns {boolean} Whether it reads as "on".
 */
export function isOn(value) {
  return !(
    value === false ||
    value === 0 ||
    value === "" ||
    value === "0" ||
    value === "false" ||
    value === "no" ||
    value === "off" ||
    value === null ||
    value === undefined
  );
}

/**
 * Parses a showIf string into its parts, or null if it isn't shaped like one.
 *
 * @param {string} expr - The condition string.
 * @returns {{ name: string, neg: boolean, op: string|null, value: * }|null}
 */
export function parseShowIf(expr) {
  const match = String(expr).trim().match(/^(!?)\s*([A-Za-z_$][\w$]*)\s*(==|=|!=|>=|<=|>|<)?\s*(.*)$/);
  if (!match) {
    return null;
  }
  const [, neg, name, op, rawValue] = match;
  return {
    name,
    neg: neg === "!",
    op: op === "=" ? "==" : op || null,
    value: parseValue(rawValue)
  };
}

/**
 * Coerces a raw comparison value (true/false/number/quoted-or-bare string).
 *
 * @param {string} raw - Raw text after the operator.
 * @returns {*} Parsed value.
 */
function parseValue(raw) {
  const text = (raw ?? "").trim();
  if (text === "") return undefined;
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text.replace(/^["']|["']$/g, "");
}

/**
 * Evaluates a showIf (string or function) against the variable store.
 *
 * @param {string|Function} showIf - Condition.
 * @param {object} vars - The variable store.
 * @returns {boolean} Whether the option should show.
 */
export function evalShowIf(showIf, vars) {
  if (typeof showIf === "function") {
    return Boolean(showIf(vars));
  }
  if (typeof showIf !== "string") {
    return true;
  }
  const parsed = parseShowIf(showIf);
  if (!parsed) {
    return true;
  }
  const left = vars[parsed.name];
  if (!parsed.op) {
    const on = isOn(left);
    return parsed.neg ? !on : on;
  }
  let result;
  switch (parsed.op) {
    case ">": result = left > parsed.value; break;
    case ">=": result = left >= parsed.value; break;
    case "<": result = left < parsed.value; break;
    case "<=": result = left <= parsed.value; break;
    case "!=": result = left !== parsed.value; break;
    default: result = left === parsed.value; break;
  }
  return parsed.neg ? !result : result;
}
