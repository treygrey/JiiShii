/**
 * Returns true when a value is an inline command block.
 *
 * @param {*} value - Candidate branch payload.
 * @returns {boolean} True when the value is a command array.
 */
function isCommandBlock(value) {
  return Array.isArray(value);
}

/**
 * Returns true when a condition command uses inline command blocks.
 *
 * @param {object} command - Candidate command.
 * @returns {boolean} True when the condition needs compilation.
 */
function isBlockCondition(command) {
  return command?.type === "condition" && (
    isCommandBlock(command.then) ||
    isCommandBlock(command.else) ||
    Array.isArray(command.elseIf)
  );
}

/**
 * Creates a synthetic mark name that will not collide with authored marks.
 *
 * @param {Set<string>} usedMarks - Mark names already claimed.
 * @param {string} stem - Human-readable mark stem.
 * @returns {string} Unique synthetic mark name.
 */
function createSyntheticMark(usedMarks, stem) {
  let index = 0;
  let candidate = `__jiishii_${stem}`;
  while (usedMarks.has(candidate)) {
    index += 1;
    candidate = `__jiishii_${stem}_${index}`;
  }
  usedMarks.add(candidate);
  return candidate;
}

/**
 * Copies condition predicate fields while omitting branch payload fields.
 *
 * @param {object} definition - Condition or else-if definition.
 * @returns {object} Predicate-only condition fields.
 */
function conditionPredicate(definition) {
  return definition.if !== undefined ? { if: definition.if } : {};
}

/**
 * Resolves one condition branch to a target and optional compiled body.
 *
 * @param {string|Array<object>|undefined} branch - Target mark/scene or block.
 * @param {string} fallbackTarget - Target used when the branch is omitted.
 * @param {string} afterTarget - Synthetic mark after the whole condition.
 * @param {Set<string>} usedMarks - Mark names already claimed.
 * @returns {{ target: string, body: Array<object> }} Branch target and body.
 */
function compileConditionBranch(branch, fallbackTarget, afterTarget, usedMarks) {
  if (isCommandBlock(branch)) {
    const branchTarget = createSyntheticMark(usedMarks, "condition_branch");
    return {
      target: branchTarget,
      body: [
        { type: "label", id: branchTarget },
        ...compileSceneScript(branch, usedMarks),
        { type: "goto", target: afterTarget }
      ]
    };
  }

  if (typeof branch === "string" && branch.trim()) {
    return { target: branch, body: [] };
  }

  return { target: fallbackTarget, body: [] };
}

/**
 * Compiles block-style condition() commands into flat mark/goto flow.
 *
 * @param {object} command - Block condition command.
 * @param {Set<string>} usedMarks - Mark names already claimed.
 * @returns {Array<object>} Flat command sequence.
 */
function compileConditionCommand(command, usedMarks) {
  const output = [];
  const branchBodies = [];
  const afterTarget = createSyntheticMark(usedMarks, "condition_after");
  const elseIfDefinitions = Array.isArray(command.elseIf) ? command.elseIf : [];
  const conditionChain = [command, ...elseIfDefinitions];
  const elseTarget = isCommandBlock(command.else)
    ? createSyntheticMark(usedMarks, "condition_else")
    : command.else;

  conditionChain.forEach((branchDefinition, index) => {
    const nextTarget = index < conditionChain.length - 1
      ? createSyntheticMark(usedMarks, "condition_elseif")
      : (typeof elseTarget === "string" && elseTarget.trim() ? elseTarget : afterTarget);
    const thenBranch = compileConditionBranch(
      branchDefinition.then,
      afterTarget,
      afterTarget,
      usedMarks
    );
    branchBodies.push(...thenBranch.body);

    output.push({
      type: "condition",
      ...conditionPredicate(branchDefinition),
      then: thenBranch.target,
      else: nextTarget
    });

    if (nextTarget.startsWith?.("__jiishii_condition_elseif")) {
      output.push({ type: "label", id: nextTarget });
    }
  });

  if (isCommandBlock(command.else)) {
    branchBodies.push(
      { type: "label", id: elseTarget },
      ...compileSceneScript(command.else, usedMarks),
      { type: "goto", target: afterTarget }
    );
  }

  output.push(...branchBodies);
  output.push({ type: "label", id: afterTarget });
  return output;
}

/**
 * Compiles author-friendly script conveniences into the flat command list the
 * runner executes. Today this expands block-style condition() into ordinary
 * condition/mark/goto flow.
 *
 * @param {Array<object>} script - Authored command list.
 * @param {Set<string>} [usedMarks] - Mark names already claimed.
 * @returns {Array<object>} Flat command list.
 */
function compileSceneScript(script = [], usedMarks = new Set()) {
  const output = [];

  for (const command of script) {
    if (command?.type === "label" && command.id) {
      usedMarks.add(command.id);
    }
  }

  for (const command of script) {
    if (isBlockCondition(command)) {
      output.push(...compileConditionCommand(command, usedMarks));
      continue;
    }
    output.push(command);
  }

  return output;
}

/**
 * Creates a full scene definition.
 *
 * @param {object} definition - Scene metadata and script commands.
 * @param {string} definition.id - Unique scene id.
 * @param {Array<object>} [definition.characters] - Scene character declarations.
 * @param {Array<object>} definition.script - Ordered scene command list.
 * @returns {object} Scene definition.
 */
export function scene(definition) {
  return {
    characters: [],
    ...definition,
    script: compileSceneScript(definition.script ?? [])
  };
}

/**
 * References a global character while allowing scene-specific overrides.
 *
 * @param {string} id - Global character id.
 * @param {object} [overrides] - Scene-specific character fields.
 * @returns {object} Character declaration command.
 */
export function useCharacter(id, overrides = {}) {
  return {
    type: "character",
    id,
    useGlobal: true,
    overrides
  };
}

/**
 * Declares a scene-local character.
 *
 * @param {object} definition - Character presentation defaults.
 * @param {string} definition.id - Character id used by script commands.
 * @param {string} definition.name - Display name.
 * @param {string} definition.color - Accent color.
 * @param {"left" | "right" | "center"} definition.side - Default message side.
 * @returns {object} Character declaration command.
 */
export function character(definition) {
  return {
    ...definition,
    type: "character",
    useGlobal: false
  };
}
