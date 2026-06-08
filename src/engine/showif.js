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
 * Normalizes common author-facing values for forgiving equality checks.
 *
 * @param {*} value - Candidate value.
 * @returns {*} Normalized comparison value.
 */
function normalizeComparableValue(value) {
  if (!isOn(value)) {
    return false;
  }
  if (value === true) {
    return true;
  }
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "true" || text === "yes" || text === "on") {
      return true;
    }
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      return Number(text);
    }
    return value.trim();
  }
  return value;
}

/**
 * Returns a finite numeric value when a comparison can reasonably be numeric.
 *
 * @param {*} value - Candidate value.
 * @returns {number|null} Numeric value or null.
 */
function comparableNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    return Number(value);
  }
  if (value === true) {
    return 1;
  }
  if (!isOn(value)) {
    return 0;
  }
  return null;
}

/**
 * Tests author-facing equality without requiring JavaScript edge-case knowledge.
 *
 * @param {*} left - Left value.
 * @param {*} right - Right value.
 * @returns {boolean} Whether the values read as equal.
 */
export function authorEquals(left, right) {
  return Object.is(normalizeComparableValue(left), normalizeComparableValue(right));
}

/**
 * Compares two values using author-facing coercion rules.
 *
 * @param {*} left - Left value.
 * @param {string} op - Comparison operator.
 * @param {*} right - Right value.
 * @returns {boolean} Comparison result.
 */
export function authorCompare(left, op, right) {
  switch (op) {
    case "!=":
    case "!==":
      return !authorEquals(left, right);
    case "=":
    case "==":
    case "===":
      return authorEquals(left, right);
    default:
      break;
  }

  const leftNumber = comparableNumber(left);
  const rightNumber = comparableNumber(right);
  const comparableLeft = leftNumber ?? String(left ?? "");
  const comparableRight = rightNumber ?? String(right ?? "");
  switch (op) {
    case ">": return comparableLeft > comparableRight;
    case ">=": return comparableLeft >= comparableRight;
    case "<": return comparableLeft < comparableRight;
    case "<=": return comparableLeft <= comparableRight;
    default: return authorEquals(left, right);
  }
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
  const result = authorCompare(left, parsed.op, parsed.value);
  return parsed.neg ? !result : result;
}
