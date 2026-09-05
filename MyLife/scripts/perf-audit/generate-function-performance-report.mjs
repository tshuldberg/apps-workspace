#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import ts from "typescript";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "artifacts", "perf-audit");

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".swift",
  ".m",
  ".mm",
  ".h",
]);

const TS_LIKE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const NATIVE_EXTENSIONS = new Set([".swift", ".m", ".mm", ".h"]);

const EVENT_PROPS = new Set([
  "onPress",
  "onClick",
  "onSubmit",
  "onLongPress",
  "onChange",
  "onChangeText",
  "onBlur",
  "onFocus",
  "onSelect",
  "onKeyDown",
  "onKeyUp",
  "onTouchStart",
  "onTouchEnd",
]);

const ITERATION_METHODS = new Set([
  "forEach",
  "map",
  "filter",
  "reduce",
  "flatMap",
  "some",
  "every",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "sort",
  "toSorted",
]);

const NLOGN_METHODS = new Set(["sort", "toSorted"]);

const LINEAR_LOOKUP_METHODS = new Set([
  "includes",
  "indexOf",
  "lastIndexOf",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
]);

const ALLOCATION_METHODS = new Set([
  "map",
  "filter",
  "flatMap",
  "slice",
  "concat",
  "toSorted",
  "toReversed",
  "Object.keys",
  "Object.values",
  "Object.entries",
  "Object.fromEntries",
]);

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function getScriptKind(ext) {
  if (ext === ".ts") {
    return ts.ScriptKind.TS;
  }
  if (ext === ".tsx") {
    return ts.ScriptKind.TSX;
  }
  if (ext === ".js" || ext === ".cjs" || ext === ".mjs") {
    return ts.ScriptKind.JS;
  }
  if (ext === ".jsx") {
    return ts.ScriptKind.JSX;
  }
  return ts.ScriptKind.Unknown;
}

function listStandaloneApps() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^My[A-Z]/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function listWorkspaceRoots() {
  const roots = ["apps", "modules", "packages", ...listStandaloneApps()];
  return roots.filter((dir) => fs.existsSync(path.join(ROOT, dir)));
}

function listExpectedAppKeys() {
  const keys = [];

  const appsDir = path.join(ROOT, "apps");
  if (fs.existsSync(appsDir)) {
    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        keys.push(`apps/${entry.name}`);
      }
    }
  }

  const modulesDir = path.join(ROOT, "modules");
  if (fs.existsSync(modulesDir)) {
    for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        keys.push(`modules/${entry.name}`);
      }
    }
  }

  const packagesDir = path.join(ROOT, "packages");
  if (fs.existsSync(packagesDir)) {
    for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        keys.push(`packages/${entry.name}`);
      }
    }
  }

  for (const standalone of listStandaloneApps()) {
    keys.push(standalone);
  }

  return [...new Set(keys)].sort((a, b) => a.localeCompare(b));
}

function listSourceFiles(roots) {
  const quotedRoots = roots.map((root) => `"${root}"`).join(" ");
  const command = [
    "rg --files",
    quotedRoots,
    "-g '!**/node_modules/**'",
    "-g '!**/.git/**'",
    "-g '!**/.next/**'",
    "-g '!**/dist/**'",
    "-g '!**/build/**'",
    "-g '!**/coverage/**'",
    "-g '!**/vendor/**'",
  ].join(" ");

  const raw = execSync(command, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(toPosixPath)
    .filter((file) => {
      const ext = path.extname(file).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) {
        return false;
      }
      if (file.endsWith(".d.ts")) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.localeCompare(b));
}

function inferAppKey(relPath) {
  const parts = toPosixPath(relPath).split("/");
  const [first, second] = parts;

  if (!first) {
    return "unknown";
  }

  if (first === "apps" && second) {
    return `apps/${second}`;
  }
  if (first === "modules" && second) {
    return `modules/${second}`;
  }
  if (first === "packages" && second) {
    return `packages/${second}`;
  }
  if (/^My[A-Z]/.test(first)) {
    return first;
  }

  return first;
}

function appDisplayName(appKey) {
  if (appKey === "apps/mobile") {
    return "MyLife Hub Mobile";
  }
  if (appKey === "apps/web") {
    return "MyLife Hub Web";
  }
  if (appKey.startsWith("modules/")) {
    return `Hub Module ${appKey.split("/")[1]}`;
  }
  if (appKey.startsWith("packages/")) {
    return `Shared Package ${appKey.split("/")[1]}`;
  }
  return appKey;
}

function inferRouteFromAppPath(relPath) {
  const normalized = toPosixPath(relPath);
  const marker = "/app/";
  const markerIdx = normalized.indexOf(marker);
  if (markerIdx === -1) {
    return null;
  }

  const after = normalized.slice(markerIdx + marker.length);
  const segments = after.split("/");
  segments.pop();

  if (!segments.length) {
    return "/";
  }
  return `/${segments.join("/")}`;
}

function inferSurface(relPath, sourceText) {
  const normalized = toPosixPath(relPath).toLowerCase();
  const base = path.basename(relPath);
  const ext = path.extname(relPath).toLowerCase();
  const nameNoExt = base.slice(0, base.length - ext.length);
  const route = inferRouteFromAppPath(relPath);

  if (route && /\/app\/.*\/page\.(tsx?|jsx?)$/.test(normalized)) {
    return {
      type: "page",
      name: `route ${route}`,
    };
  }
  if (route && /\/app\/page\.(tsx?|jsx?)$/.test(normalized)) {
    return {
      type: "page",
      name: "route /",
    };
  }
  if (route && /\/app\/.*\/layout\.(tsx?|jsx?)$/.test(normalized)) {
    return {
      type: "layout",
      name: `route ${route}`,
    };
  }
  if (normalized.includes("/screens/") || /screen/i.test(nameNoExt)) {
    return {
      type: "screen",
      name: nameNoExt,
    };
  }
  if (normalized.includes("/forms/") || /form/i.test(nameNoExt) || sourceText.includes("<form")) {
    return {
      type: "form",
      name: nameNoExt,
    };
  }
  if (/button/i.test(nameNoExt)) {
    return {
      type: "button-component",
      name: nameNoExt,
    };
  }
  if (normalized.includes("/components/")) {
    return {
      type: "component",
      name: nameNoExt,
    };
  }
  if (normalized.includes("/hooks/") || /^use[A-Z]/.test(nameNoExt)) {
    return {
      type: "hook",
      name: nameNoExt,
    };
  }
  if (normalized.includes("/services/") || normalized.includes("/service/")) {
    return {
      type: "service",
      name: nameNoExt,
    };
  }
  if (normalized.includes("/store/") || normalized.includes("/state/") || normalized.includes("/context/")) {
    return {
      type: "state",
      name: nameNoExt,
    };
  }
  if (normalized.includes("/lib/") || normalized.includes("/utils/") || normalized.includes("/util/")) {
    return {
      type: "utility",
      name: nameNoExt,
    };
  }
  if (NATIVE_EXTENSIONS.has(ext)) {
    return {
      type: "native",
      name: nameNoExt,
    };
  }
  return {
    type: "file",
    name: nameNoExt,
  };
}

function lineOfPosition(sourceFile, pos) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  return {
    line: line + 1,
    column: character + 1,
  };
}

function isFunctionNode(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  );
}

function propertyNameToString(nameNode, sourceFile) {
  if (!nameNode) {
    return "anonymous";
  }
  if (ts.isIdentifier(nameNode) || ts.isPrivateIdentifier(nameNode)) {
    return nameNode.text;
  }
  if (ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode)) {
    return nameNode.text;
  }
  return nameNode.getText(sourceFile);
}

function enclosingClassName(node) {
  let cursor = node.parent;
  while (cursor) {
    if (ts.isClassLike(cursor) && cursor.name) {
      return cursor.name.text;
    }
    cursor = cursor.parent;
  }
  return null;
}

function resolveFunctionIdentity(node, sourceFile) {
  const start = lineOfPosition(sourceFile, node.getStart(sourceFile));
  const className = enclosingClassName(node);
  let simpleName = null;
  let displayName = null;
  let kind = "function";

  if (ts.isFunctionDeclaration(node)) {
    kind = "function_declaration";
    simpleName = node.name ? node.name.text : `anonymous_L${start.line}`;
  } else if (ts.isMethodDeclaration(node)) {
    kind = "method";
    simpleName = propertyNameToString(node.name, sourceFile);
  } else if (ts.isGetAccessorDeclaration(node)) {
    kind = "getter";
    simpleName = `get_${propertyNameToString(node.name, sourceFile)}`;
  } else if (ts.isSetAccessorDeclaration(node)) {
    kind = "setter";
    simpleName = `set_${propertyNameToString(node.name, sourceFile)}`;
  } else if (ts.isConstructorDeclaration(node)) {
    kind = "constructor";
    simpleName = "constructor";
  } else if (ts.isArrowFunction(node)) {
    kind = "arrow_function";
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      simpleName = parent.name.text;
    } else if (ts.isPropertyAssignment(parent)) {
      simpleName = propertyNameToString(parent.name, sourceFile);
    } else if (ts.isBinaryExpression(parent)) {
      simpleName = parent.left.getText(sourceFile);
    } else {
      simpleName = `inline_L${start.line}`;
    }
  } else if (ts.isFunctionExpression(node)) {
    kind = "function_expression";
    if (node.name) {
      simpleName = node.name.text;
    } else {
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        simpleName = parent.name.text;
      } else if (ts.isPropertyAssignment(parent)) {
        simpleName = propertyNameToString(parent.name, sourceFile);
      } else if (ts.isBinaryExpression(parent)) {
        simpleName = parent.left.getText(sourceFile);
      } else {
        simpleName = `inline_L${start.line}`;
      }
    }
  }

  if (!displayName) {
    if (className && simpleName && simpleName !== "constructor") {
      displayName = `${className}.${simpleName}`;
    } else if (className && simpleName === "constructor") {
      displayName = `${className}.constructor`;
    } else {
      displayName = simpleName ?? `anonymous_L${start.line}`;
    }
  }

  return { kind, simpleName: simpleName ?? "anonymous", displayName, className };
}

function emptyMetrics() {
  return {
    cyclomatic: 1,
    loopCount: 0,
    iterationMethodCount: 0,
    maxLoopDepth: 0,
    recursionCalls: 0,
    hasSort: false,
    allocations: 0,
    allocationsInLoop: 0,
    patterns: new Set(),
  };
}

function getCallInfo(expression, sourceFile) {
  if (ts.isIdentifier(expression)) {
    return {
      method: expression.text,
      fullName: expression.text,
    };
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const method = expression.name.text;
    const base = expression.expression.getText(sourceFile);
    return {
      method,
      fullName: `${base}.${method}`,
    };
  }
  return {
    method: expression.getText(sourceFile),
    fullName: expression.getText(sourceFile),
  };
}

function registerAllocation(metrics, inLoop) {
  metrics.allocations += 1;
  if (inLoop) {
    metrics.allocationsInLoop += 1;
    metrics.patterns.add("allocation inside loop");
  }
}

function isLoopNode(node) {
  return (
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

function analyzeTsFunctionMetrics(node, sourceFile, identity) {
  const metrics = emptyMetrics();

  const bodyNode = node.body;
  if (!bodyNode) {
    return metrics;
  }

  const walk = (currentNode, state) => {
    if (currentNode !== node && isFunctionNode(currentNode)) {
      return;
    }

    if (ts.isIfStatement(currentNode)) {
      metrics.cyclomatic += 1;
    } else if (ts.isConditionalExpression(currentNode)) {
      metrics.cyclomatic += 1;
    } else if (ts.isCaseClause(currentNode)) {
      metrics.cyclomatic += 1;
    } else if (ts.isCatchClause(currentNode)) {
      metrics.cyclomatic += 1;
    } else if (ts.isBinaryExpression(currentNode)) {
      const operator = currentNode.operatorToken.kind;
      if (
        operator === ts.SyntaxKind.AmpersandAmpersandToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken
      ) {
        metrics.cyclomatic += 1;
      }
    }

    if (isLoopNode(currentNode)) {
      const nextDepth = state.loopDepth + 1;
      metrics.loopCount += 1;
      metrics.cyclomatic += 1;
      metrics.maxLoopDepth = Math.max(metrics.maxLoopDepth, nextDepth);
      ts.forEachChild(currentNode, (child) => walk(child, { loopDepth: nextDepth }));
      return;
    }

    if (ts.isCallExpression(currentNode)) {
      const callInfo = getCallInfo(currentNode.expression, sourceFile);
      const { method, fullName } = callInfo;
      const inLoop = state.loopDepth > 0;

      if (ITERATION_METHODS.has(method)) {
        metrics.iterationMethodCount += 1;
        metrics.maxLoopDepth = Math.max(metrics.maxLoopDepth, state.loopDepth + 1);
        if (inLoop) {
          metrics.patterns.add("nested iteration");
        }
      }

      if (NLOGN_METHODS.has(method)) {
        metrics.hasSort = true;
        if (inLoop) {
          metrics.patterns.add("sort inside loop");
        }
      }

      if (LINEAR_LOOKUP_METHODS.has(method) && inLoop) {
        metrics.patterns.add("linear lookup inside loop");
      }

      if (ALLOCATION_METHODS.has(method) || ALLOCATION_METHODS.has(fullName)) {
        registerAllocation(metrics, inLoop);
      }

      if (identity.simpleName) {
        if (ts.isIdentifier(currentNode.expression) && currentNode.expression.text === identity.simpleName) {
          metrics.recursionCalls += 1;
        }
        if (
          ts.isPropertyAccessExpression(currentNode.expression) &&
          currentNode.expression.name.text === identity.simpleName &&
          currentNode.expression.expression.kind === ts.SyntaxKind.ThisKeyword
        ) {
          metrics.recursionCalls += 1;
        }
      }
    }

    if (ts.isArrayLiteralExpression(currentNode) && currentNode.elements.length > 0) {
      registerAllocation(metrics, state.loopDepth > 0);
    }

    if (ts.isObjectLiteralExpression(currentNode) && currentNode.properties.length > 0) {
      registerAllocation(metrics, state.loopDepth > 0);
    }

    if (ts.isNewExpression(currentNode)) {
      const ctor = currentNode.expression.getText(sourceFile);
      if (["Array", "Map", "Set", "Object"].includes(ctor)) {
        registerAllocation(metrics, state.loopDepth > 0);
      }
    }

    ts.forEachChild(currentNode, (child) => walk(child, state));
  };

  walk(bodyNode, { loopDepth: 0 });
  return metrics;
}

function estimateTimeComplexity(metrics) {
  if (metrics.recursionCalls > 1) {
    return {
      label: "O(2^n) (estimated)",
      tier: 15,
    };
  }
  if (metrics.hasSort && metrics.maxLoopDepth >= 1) {
    return {
      label: "O(n^2 log n) (estimated)",
      tier: 12,
    };
  }
  if (metrics.maxLoopDepth >= 3) {
    return {
      label: "O(n^3) (estimated)",
      tier: 11,
    };
  }
  if (metrics.maxLoopDepth >= 2 || metrics.patterns.has("linear lookup inside loop")) {
    return {
      label: "O(n^2) (estimated)",
      tier: 8,
    };
  }
  if (metrics.hasSort) {
    return {
      label: "O(n log n) (estimated)",
      tier: 5,
    };
  }
  if (metrics.loopCount > 0 || metrics.iterationMethodCount > 0 || metrics.recursionCalls === 1) {
    return {
      label: "O(n) (estimated)",
      tier: 3,
    };
  }
  return {
    label: "O(1) (estimated)",
    tier: 1,
  };
}

function estimateSpaceComplexity(metrics) {
  if (metrics.recursionCalls > 0) {
    return {
      label: "O(n) stack (estimated)",
      tier: 3,
    };
  }
  if (metrics.allocationsInLoop > 0) {
    return {
      label: "O(n) to O(n^2) (estimated)",
      tier: 4,
    };
  }
  if (metrics.allocations > 0) {
    return {
      label: "O(n) (estimated)",
      tier: 2,
    };
  }
  return {
    label: "O(1) (estimated)",
    tier: 1,
  };
}

function riskLevel(score) {
  if (score >= 16) {
    return "critical";
  }
  if (score >= 12) {
    return "high";
  }
  if (score >= 8) {
    return "medium";
  }
  return "low";
}

function buildRiskScore(metrics, timeComplexity, spaceComplexity, linesOfCode) {
  const score =
    timeComplexity.tier +
    spaceComplexity.tier * 0.5 +
    metrics.cyclomatic * 0.35 +
    metrics.maxLoopDepth * 2 +
    metrics.patterns.size * 1.6 +
    metrics.allocationsInLoop * 0.8 +
    (linesOfCode >= 120 ? 2.5 : linesOfCode >= 80 ? 1.5 : linesOfCode >= 40 ? 0.8 : 0);
  return Math.round(score * 100) / 100;
}

function extractUiBindings(sourceFile) {
  const bindings = [];

  const getControlName = (jsxAttributes, tagName) => {
    let descriptor = tagName;
    const labelCandidates = ["aria-label", "accessibilityLabel", "name", "id", "testID", "title"];
    for (const prop of jsxAttributes.properties) {
      if (!ts.isJsxAttribute(prop) || !prop.initializer) {
        continue;
      }
      const propName = prop.name.getText(sourceFile);
      if (!labelCandidates.includes(propName)) {
        continue;
      }
      if (ts.isStringLiteral(prop.initializer)) {
        descriptor = `${tagName}[${prop.initializer.text}]`;
        break;
      }
      if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
        descriptor = `${tagName}[${propName}]`;
        break;
      }
    }
    return descriptor;
  };

  const visit = (node) => {
    if (ts.isJsxAttribute(node)) {
      const eventName = node.name.getText(sourceFile);
      if (!EVENT_PROPS.has(eventName)) {
        ts.forEachChild(node, visit);
        return;
      }

      const location = lineOfPosition(sourceFile, node.getStart(sourceFile));
      let handlerExpression = "unknown";
      let handlerKind = "unknown";
      let inlineLine = null;
      let handlerTail = null;

      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        const expr = node.initializer.expression;
        if (ts.isIdentifier(expr)) {
          handlerExpression = expr.text;
          handlerKind = "identifier";
          handlerTail = expr.text;
        } else if (ts.isPropertyAccessExpression(expr)) {
          handlerExpression = expr.getText(sourceFile);
          handlerKind = "property";
          handlerTail = expr.name.text;
        } else if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
          const inlinePos = lineOfPosition(sourceFile, expr.getStart(sourceFile));
          handlerExpression = `inline_L${inlinePos.line}`;
          handlerKind = "inline";
          inlineLine = inlinePos.line;
          handlerTail = handlerExpression;
        } else {
          handlerExpression = expr.getText(sourceFile);
          handlerKind = "expression";
          handlerTail = handlerExpression.split(".").at(-1) ?? handlerExpression;
        }
      }

      let controlTag = "Unknown";
      let controlName = "Unknown";
      if (node.parent && ts.isJsxAttributes(node.parent)) {
        const owner = node.parent.parent;
        if (ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner)) {
          controlTag = owner.tagName.getText(sourceFile);
          controlName = getControlName(owner.attributes, controlTag);
        }
      }

      bindings.push({
        event: eventName,
        line: location.line,
        column: location.column,
        controlTag,
        controlName,
        handlerExpression,
        handlerTail,
        handlerKind,
        inlineLine,
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return bindings;
}

function functionSnippet(node, sourceFile, sourceText) {
  const start = node.getStart(sourceFile);
  const end = Math.min(node.end, sourceText.length);
  const text = sourceText.slice(start, end).split(/\r?\n/)[0] ?? "";
  return text.trim().slice(0, 180);
}

function buildFunctionSuggestions(record) {
  const suggestions = [];
  const metrics = record.metrics;

  if (metrics.maxLoopDepth >= 2) {
    suggestions.push("Replace nested loops with indexed lookup structures (Map/Set) to remove repeated scans.");
  }
  if (metrics.patterns.has("linear lookup inside loop")) {
    suggestions.push("Pre-index collections before looping so membership checks become O(1).");
  }
  if (metrics.hasSort) {
    suggestions.push("Avoid repeated sorting in hot paths by caching or memoizing sorted results.");
  }
  if (metrics.patterns.has("sort inside loop")) {
    suggestions.push("Move sorting outside loops and sort once per input batch.");
  }
  if (metrics.allocationsInLoop > 0) {
    suggestions.push("Lift allocations out of loops and reuse buffers to reduce GC pressure.");
  }
  if (metrics.recursionCalls > 0) {
    suggestions.push("Consider iterative traversal or memoization to reduce recursion overhead.");
  }
  if (record.cyclomatic >= 12) {
    suggestions.push("Split this function into smaller pure helpers and add guard clauses.");
  }
  if (record.boundControls.length > 0 && /\.(tsx|jsx)$/.test(record.filePath)) {
    suggestions.push("Stabilize UI handlers with memoization (for example useCallback) when passed to children.");
  }
  if (!suggestions.length) {
    suggestions.push("Profile this function in production-like workloads and optimize only if it appears in a hot path.");
  }

  return [...new Set(suggestions)];
}

function extractTsFunctions(relPath, sourceText, appKey, surface) {
  const ext = path.extname(relPath).toLowerCase();
  const sourceFile = ts.createSourceFile(relPath, sourceText, ts.ScriptTarget.Latest, true, getScriptKind(ext));
  const uiBindings = extractUiBindings(sourceFile);
  const functions = [];

  const visit = (node) => {
    if (isFunctionNode(node) && node.body) {
      const identity = resolveFunctionIdentity(node, sourceFile);
      const startPos = lineOfPosition(sourceFile, node.getStart(sourceFile));
      const endPos = lineOfPosition(sourceFile, node.end);
      const linesOfCode = Math.max(1, endPos.line - startPos.line + 1);
      const metrics = analyzeTsFunctionMetrics(node, sourceFile, identity);
      const timeComplexity = estimateTimeComplexity(metrics);
      const spaceComplexity = estimateSpaceComplexity(metrics);
      const score = buildRiskScore(metrics, timeComplexity, spaceComplexity, linesOfCode);
      const id = `${relPath}#${identity.displayName}@L${startPos.line}`;

      functions.push({
        id,
        appKey,
        appDisplay: appDisplayName(appKey),
        surfaceType: surface.type,
        surfaceName: surface.name,
        filePath: relPath,
        fileName: path.basename(relPath),
        functionName: identity.displayName,
        simpleName: identity.simpleName,
        functionKind: identity.kind,
        startLine: startPos.line,
        endLine: endPos.line,
        lineCount: linesOfCode,
        paramsCount: node.parameters.length,
        isAsync: Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)),
        isGenerator: Boolean(node.asteriskToken),
        cyclomatic: metrics.cyclomatic,
        loopCount: metrics.loopCount,
        iterationMethodCount: metrics.iterationMethodCount,
        maxLoopDepth: metrics.maxLoopDepth,
        recursionCalls: metrics.recursionCalls,
        hasSort: metrics.hasSort,
        allocations: metrics.allocations,
        allocationsInLoop: metrics.allocationsInLoop,
        patterns: [...metrics.patterns],
        metrics,
        timeComplexity: timeComplexity.label,
        timeComplexityTier: timeComplexity.tier,
        spaceComplexity: spaceComplexity.label,
        spaceComplexityTier: spaceComplexity.tier,
        riskScore: score,
        riskLevel: riskLevel(score),
        boundControls: [],
        uiBindingsInFile: uiBindings.length,
        snippet: functionSnippet(node, sourceFile, sourceText),
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  for (const fn of functions) {
    const matches = uiBindings.filter((binding) => {
      if (binding.handlerKind === "inline") {
        return binding.inlineLine === fn.startLine;
      }
      if (binding.handlerKind === "identifier") {
        return binding.handlerExpression === fn.simpleName || binding.handlerExpression === fn.functionName;
      }
      if (binding.handlerKind === "property") {
        return binding.handlerExpression === fn.functionName || binding.handlerTail === fn.simpleName;
      }
      if (binding.handlerKind === "expression") {
        return binding.handlerTail === fn.simpleName;
      }
      return false;
    });

    fn.boundControls = matches.map((match) => ({
      event: match.event,
      control: match.controlName,
      handler: match.handlerExpression,
      line: match.line,
      column: match.column,
    }));

    fn.suggestions = buildFunctionSuggestions(fn);
  }

  return {
    functions,
    uiBindings,
  };
}

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function extractBraceBlock(sourceText, fromIndex) {
  const start = sourceText.indexOf("{", fromIndex);
  if (start === -1) {
    return null;
  }
  let depth = 0;
  for (let i = start; i < sourceText.length; i += 1) {
    const ch = sourceText[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          start,
          end: i + 1,
          text: sourceText.slice(start, i + 1),
        };
      }
    }
  }
  return null;
}

function nativeComplexityMetrics(blockText) {
  const loopCount = countMatches(blockText, /\b(for|while|repeat)\b/g);
  const conditionals = countMatches(blockText, /\b(if|guard|switch|case)\b/g);
  const recursionSignals = countMatches(blockText, /\breturn\b[^;\n]*\bself\b/g);
  const allocations = countMatches(blockText, /\b(Array|Dictionary|Set|NSMutableArray|NSMutableDictionary|new)\b/g);
  const hasSort = /\bsort(ed)?\b/.test(blockText);
  const patterns = new Set();
  if (/\bfor\b[\s\S]{0,200}\bfor\b/.test(blockText)) {
    patterns.add("nested iteration");
  }
  if (hasSort && loopCount > 0) {
    patterns.add("sort inside loop");
  }
  if (allocations > 0 && loopCount > 0) {
    patterns.add("allocation inside loop");
  }

  return {
    cyclomatic: 1 + conditionals + loopCount,
    loopCount,
    iterationMethodCount: 0,
    maxLoopDepth: patterns.has("nested iteration") ? 2 : loopCount > 0 ? 1 : 0,
    recursionCalls: recursionSignals,
    hasSort,
    allocations,
    allocationsInLoop: patterns.has("allocation inside loop") ? 1 : 0,
    patterns,
  };
}

function extractNativeFunctions(relPath, sourceText, appKey, surface) {
  const ext = path.extname(relPath).toLowerCase();
  const functions = [];

  let matcher;
  if (ext === ".swift") {
    matcher = /\bfunc\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  } else if (ext === ".m" || ext === ".mm" || ext === ".h") {
    matcher = /^[\t ]*[-+]\s*\([^)]*\)\s*([A-Za-z_][A-Za-z0-9_]*)/gm;
  }

  if (!matcher) {
    return functions;
  }

  let match;
  while ((match = matcher.exec(sourceText)) !== null) {
    const functionName = match[1];
    const startIndex = match.index;
    const startLine = sourceText.slice(0, startIndex).split(/\r?\n/).length;
    const block = extractBraceBlock(sourceText, startIndex);
    const endLine = block
      ? sourceText.slice(0, block.end).split(/\r?\n/).length
      : Math.min(startLine + 1, sourceText.split(/\r?\n/).length);
    const lineCount = Math.max(1, endLine - startLine + 1);
    const metrics = nativeComplexityMetrics(block ? block.text : match[0]);
    const timeComplexity = estimateTimeComplexity(metrics);
    const spaceComplexity = estimateSpaceComplexity(metrics);
    const score = buildRiskScore(metrics, timeComplexity, spaceComplexity, lineCount);

    const record = {
      id: `${relPath}#${functionName}@L${startLine}`,
      appKey,
      appDisplay: appDisplayName(appKey),
      surfaceType: surface.type,
      surfaceName: surface.name,
      filePath: relPath,
      fileName: path.basename(relPath),
      functionName,
      simpleName: functionName,
      functionKind: "native_function",
      startLine,
      endLine,
      lineCount,
      paramsCount: null,
      isAsync: false,
      isGenerator: false,
      cyclomatic: metrics.cyclomatic,
      loopCount: metrics.loopCount,
      iterationMethodCount: metrics.iterationMethodCount,
      maxLoopDepth: metrics.maxLoopDepth,
      recursionCalls: metrics.recursionCalls,
      hasSort: metrics.hasSort,
      allocations: metrics.allocations,
      allocationsInLoop: metrics.allocationsInLoop,
      patterns: [...metrics.patterns],
      metrics,
      timeComplexity: timeComplexity.label,
      timeComplexityTier: timeComplexity.tier,
      spaceComplexity: spaceComplexity.label,
      spaceComplexityTier: spaceComplexity.tier,
      riskScore: score,
      riskLevel: riskLevel(score),
      boundControls: [],
      uiBindingsInFile: 0,
      snippet: match[0].trim(),
    };

    record.suggestions = buildFunctionSuggestions(record);
    functions.push(record);
  }

  return functions;
}

function summarizeBy(list, keySelector) {
  const summary = new Map();
  for (const item of list) {
    const key = keySelector(item);
    summary.set(key, (summary.get(key) ?? 0) + 1);
  }
  return summary;
}

function scoreReason(fn) {
  const reasons = [];
  if (fn.timeComplexityTier >= 8) {
    reasons.push(fn.timeComplexity);
  }
  if (fn.maxLoopDepth >= 2) {
    reasons.push(`loop depth ${fn.maxLoopDepth}`);
  }
  if (fn.patterns.length > 0) {
    reasons.push(fn.patterns.join(", "));
  }
  if (fn.cyclomatic >= 12) {
    reasons.push(`cyclomatic ${fn.cyclomatic}`);
  }
  if (!reasons.length) {
    reasons.push("high cumulative risk score");
  }
  return reasons.join("; ");
}

function sanitizeMdCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeJsonReport(data) {
  const jsonPath = path.join(OUTPUT_DIR, "function-inventory.json");
  fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return jsonPath;
}

function writeCsvReport(functions) {
  const csvPath = path.join(OUTPUT_DIR, "function-inventory.csv");
  const headers = [
    "app_key",
    "app_display",
    "surface_type",
    "surface_name",
    "file_path",
    "function_name",
    "function_kind",
    "start_line",
    "end_line",
    "line_count",
    "cyclomatic",
    "loop_count",
    "max_loop_depth",
    "time_complexity",
    "space_complexity",
    "risk_level",
    "risk_score",
    "patterns",
    "bound_controls",
    "suggestions",
  ];
  const rows = [headers.join(",")];
  for (const fn of functions) {
    const values = [
      fn.appKey,
      fn.appDisplay,
      fn.surfaceType,
      fn.surfaceName,
      fn.filePath,
      fn.functionName,
      fn.functionKind,
      fn.startLine,
      fn.endLine,
      fn.lineCount,
      fn.cyclomatic,
      fn.loopCount,
      fn.maxLoopDepth,
      fn.timeComplexity,
      fn.spaceComplexity,
      fn.riskLevel,
      fn.riskScore,
      fn.patterns.join("; "),
      fn.boundControls.map((control) => `${control.event}:${control.control}`).join("; "),
      fn.suggestions.join("; "),
    ];
    const escaped = values.map((value) => {
      const text = String(value ?? "");
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    });
    rows.push(escaped.join(","));
  }
  fs.writeFileSync(csvPath, `${rows.join("\n")}\n`, "utf8");
  return csvPath;
}

function writeInventoryMarkdown({
  functions,
  allAppKeys,
  generatedAt,
  analyzedFileCount,
  totalUiBindings,
}) {
  const inventoryPath = path.join(OUTPUT_DIR, "function-inventory.md");
  const timeSummary = summarizeBy(functions, (fn) => fn.timeComplexity);
  const riskSummary = summarizeBy(functions, (fn) => fn.riskLevel);

  const lines = [];
  lines.push("# MyLife Function Inventory");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push("- Includes all source files under `apps/`, `modules/`, `packages/`, and standalone `My*/` app directories.");
  lines.push("- Includes TypeScript, JavaScript, Swift, Objective-C, and Objective-C++ source files.");
  lines.push("- Complexity values are static estimates intended for triage; confirm with runtime profiling for final tuning.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Source files analyzed: **${analyzedFileCount}**`);
  lines.push(`- Functions discovered: **${functions.length}**`);
  lines.push(`- UI control bindings detected: **${totalUiBindings}**`);
  lines.push(`- Applications/components represented: **${allAppKeys.length}**`);
  lines.push("");
  lines.push("### Complexity Distribution");
  lines.push("");
  lines.push("| Time Complexity | Count |");
  lines.push("|---|---:|");
  for (const [complexity, count] of [...timeSummary.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${sanitizeMdCell(complexity)} | ${count} |`);
  }
  lines.push("");
  lines.push("| Risk Level | Count |");
  lines.push("|---|---:|");
  for (const level of ["critical", "high", "medium", "low"]) {
    lines.push(`| ${level} | ${riskSummary.get(level) ?? 0} |`);
  }
  lines.push("");
  lines.push("## Application Breakdown");
  lines.push("");

  const functionsByApp = new Map();
  for (const appKey of allAppKeys) {
    functionsByApp.set(appKey, []);
  }
  for (const fn of functions) {
    if (!functionsByApp.has(fn.appKey)) {
      functionsByApp.set(fn.appKey, []);
    }
    functionsByApp.get(fn.appKey).push(fn);
  }

  for (const appKey of [...functionsByApp.keys()].sort((a, b) => a.localeCompare(b))) {
    const appFunctions = functionsByApp.get(appKey) ?? [];
    const display = appDisplayName(appKey);
    const surfaceSet = new Set(appFunctions.map((fn) => `${fn.surfaceType}|${fn.surfaceName}|${fn.filePath}`));
    lines.push(`## ${display} (\`${appKey}\`)`);
    lines.push("");
    lines.push(`- Functions: **${appFunctions.length}**`);
    lines.push(`- Surfaces/files with functions: **${surfaceSet.size}**`);
    lines.push("");

    if (!appFunctions.length) {
      lines.push("_No runtime functions found in supported source files._");
      lines.push("");
      continue;
    }

    const surfaceMap = new Map();
    for (const fn of appFunctions) {
      const key = `${fn.surfaceType}|${fn.surfaceName}|${fn.filePath}`;
      if (!surfaceMap.has(key)) {
        surfaceMap.set(key, {
          surfaceType: fn.surfaceType,
          surfaceName: fn.surfaceName,
          filePath: fn.filePath,
          functions: [],
          controls: [],
        });
      }
      surfaceMap.get(key).functions.push(fn);
      for (const control of fn.boundControls) {
        surfaceMap.get(key).controls.push(control);
      }
    }

    const sortedSurfaces = [...surfaceMap.values()].sort((a, b) => {
      if (a.surfaceType !== b.surfaceType) {
        return a.surfaceType.localeCompare(b.surfaceType);
      }
      if (a.surfaceName !== b.surfaceName) {
        return a.surfaceName.localeCompare(b.surfaceName);
      }
      return a.filePath.localeCompare(b.filePath);
    });

    for (const surface of sortedSurfaces) {
      lines.push(`### ${surface.surfaceType.toUpperCase()}: ${surface.surfaceName}`);
      lines.push("");
      lines.push(`- File: \`${surface.filePath}\``);
      lines.push(`- Function count: **${surface.functions.length}**`);
      lines.push("");

      const uniqueControls = [];
      const seenControl = new Set();
      for (const control of surface.controls) {
        const key = `${control.event}|${control.control}|${control.handler}|${control.line}|${control.column}`;
        if (!seenControl.has(key)) {
          seenControl.add(key);
          uniqueControls.push(control);
        }
      }

      if (uniqueControls.length) {
        lines.push("Control bindings detected:");
        lines.push("");
        lines.push("| Event | Control | Handler | Line |");
        lines.push("|---|---|---|---:|");
        for (const control of uniqueControls.sort((a, b) => a.line - b.line)) {
          lines.push(
            `| ${sanitizeMdCell(control.event)} | ${sanitizeMdCell(control.control)} | ${sanitizeMdCell(
              control.handler,
            )} | ${control.line} |`,
          );
        }
        lines.push("");
      }

      lines.push("| Function | Kind | Location | Time | Space | Cyclomatic | Loop Depth | Risk | Linked Controls |");
      lines.push("|---|---|---|---|---|---:|---:|---|---|");
      for (const fn of surface.functions.sort((a, b) => a.startLine - b.startLine)) {
        const controls = fn.boundControls.map((control) => `${control.event}:${control.control}`).join(", ");
        lines.push(
          `| ${sanitizeMdCell(fn.functionName)} | ${sanitizeMdCell(fn.functionKind)} | ${sanitizeMdCell(
            `${fn.filePath}:${fn.startLine}`,
          )} | ${sanitizeMdCell(fn.timeComplexity)} | ${sanitizeMdCell(fn.spaceComplexity)} | ${fn.cyclomatic} | ${
            fn.maxLoopDepth
          } | ${fn.riskLevel.toUpperCase()} (${fn.riskScore}) | ${sanitizeMdCell(controls || "-")} |`,
        );
      }
      lines.push("");
    }
  }

  fs.writeFileSync(inventoryPath, `${lines.join("\n")}\n`, "utf8");
  return inventoryPath;
}

function writeWorstFunctionsMarkdown(functions, generatedAt) {
  const worstPath = path.join(OUTPUT_DIR, "worst-performing-functions.md");
  const candidates = functions
    .filter(
      (fn) =>
        fn.riskLevel === "critical" ||
        fn.riskLevel === "high" ||
        fn.timeComplexityTier >= 8 ||
        fn.maxLoopDepth >= 2 ||
        fn.patterns.length > 0,
    )
    .sort((a, b) => b.riskScore - a.riskScore || b.cyclomatic - a.cyclomatic || a.filePath.localeCompare(b.filePath));

  const lines = [];
  lines.push("# Worst Performing Functions");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");
  lines.push("This report ranks static high-risk functions first. Validate with runtime profiling before refactors.");
  lines.push("");
  lines.push(`Total high-risk candidates: **${candidates.length}**`);
  lines.push("");
  lines.push("| Rank | App | Function | Location | Time | Space | Risk | Why flagged | Primary recommendation |");
  lines.push("|---:|---|---|---|---|---|---|---|---|");
  candidates.forEach((fn, index) => {
    lines.push(
      `| ${index + 1} | ${sanitizeMdCell(fn.appDisplay)} | ${sanitizeMdCell(fn.functionName)} | ${sanitizeMdCell(
        `${fn.filePath}:${fn.startLine}`,
      )} | ${sanitizeMdCell(fn.timeComplexity)} | ${sanitizeMdCell(fn.spaceComplexity)} | ${fn.riskLevel.toUpperCase()} (${
        fn.riskScore
      }) | ${sanitizeMdCell(scoreReason(fn))} | ${sanitizeMdCell(fn.suggestions[0] ?? "Profile and optimize hot path.")} |`,
    );
  });

  fs.writeFileSync(worstPath, `${lines.join("\n")}\n`, "utf8");
  return worstPath;
}

function taskPrefix(appKey) {
  const clean = appKey.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return clean.slice(0, 12) || "APP";
}

function writeImplementationPlan(functions, allAppKeys, generatedAt) {
  const planPath = path.join(OUTPUT_DIR, "performance-remediation-plan.md");
  const lines = [];

  lines.push("# MyLife Performance Remediation Plan");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");
  lines.push("This plan creates one optimization task per discovered function.");
  lines.push("Tasks are grouped by application, then by page/form/surface.");
  lines.push("");
  lines.push("## Execution Model");
  lines.push("");
  lines.push("1. Start with all CRITICAL and HIGH tasks from the worst-function report.");
  lines.push("2. Resolve per-app hotspots in batches while preserving standalone and hub parity.");
  lines.push("3. Add benchmarks or profiling evidence before and after each optimization.");
  lines.push("4. Run parity checks and regression tests after each batch.");
  lines.push("");
  lines.push("## Task Backlog");
  lines.push("");

  const byApp = new Map();
  for (const appKey of allAppKeys) {
    byApp.set(appKey, []);
  }
  for (const fn of functions) {
    if (!byApp.has(fn.appKey)) {
      byApp.set(fn.appKey, []);
    }
    byApp.get(fn.appKey).push(fn);
  }

  for (const appKey of [...byApp.keys()].sort((a, b) => a.localeCompare(b))) {
    const appFunctions = byApp.get(appKey) ?? [];
    const display = appDisplayName(appKey);
    lines.push(`## ${display} (\`${appKey}\`)`);
    lines.push("");
    lines.push(`- Total tasks: **${appFunctions.length}**`);
    lines.push("");

    if (!appFunctions.length) {
      lines.push("_No optimization tasks. No runtime functions were detected._");
      lines.push("");
      continue;
    }

    const prefix = taskPrefix(appKey);
    let counter = 1;

    const bySurface = new Map();
    for (const fn of appFunctions) {
      const key = `${fn.surfaceType}|${fn.surfaceName}|${fn.filePath}`;
      if (!bySurface.has(key)) {
        bySurface.set(key, {
          surfaceType: fn.surfaceType,
          surfaceName: fn.surfaceName,
          filePath: fn.filePath,
          functions: [],
        });
      }
      bySurface.get(key).functions.push(fn);
    }

    const sortedSurfaces = [...bySurface.values()].sort((a, b) => {
      if (a.surfaceType !== b.surfaceType) {
        return a.surfaceType.localeCompare(b.surfaceType);
      }
      if (a.surfaceName !== b.surfaceName) {
        return a.surfaceName.localeCompare(b.surfaceName);
      }
      return a.filePath.localeCompare(b.filePath);
    });

    for (const surface of sortedSurfaces) {
      lines.push(`### ${surface.surfaceType.toUpperCase()}: ${surface.surfaceName}`);
      lines.push("");
      lines.push(`- File: \`${surface.filePath}\``);
      lines.push("");

      const sortedFunctions = [...surface.functions].sort((a, b) => {
        if (a.riskScore !== b.riskScore) {
          return b.riskScore - a.riskScore;
        }
        return a.startLine - b.startLine;
      });

      for (const fn of sortedFunctions) {
        const taskId = `PERF-${prefix}-${String(counter).padStart(4, "0")}`;
        counter += 1;
        const primarySuggestion = fn.suggestions[0] ?? "Profile and optimize only if this is a measured hot path.";
        const controls = fn.boundControls.map((control) => `${control.event}:${control.control}`).join(", ");
        const complexitySnapshot = `Time ${fn.timeComplexity}, Space ${fn.spaceComplexity}, Cyclomatic ${fn.cyclomatic}, Risk ${fn.riskLevel.toUpperCase()} (${fn.riskScore})`;
        const evidence = fn.patterns.length ? fn.patterns.join(", ") : "No obvious anti-pattern; verify with profiling.";

        lines.push(`- [ ] ${taskId} Optimize \`${fn.functionName}\` at \`${fn.filePath}:${fn.startLine}\``);
        lines.push(`  Current profile: ${complexitySnapshot}`);
        lines.push(`  Evidence: ${evidence}`);
        lines.push(`  Suggested change: ${primarySuggestion}`);
        lines.push(
          `  Validation: benchmark or profile before/after, ensure behavioral parity, and run relevant tests${controls ? `; verify bound controls (${controls})` : ""}.`,
        );
        lines.push("");
      }
    }
  }

  fs.writeFileSync(planPath, `${lines.join("\n")}\n`, "utf8");
  return planPath;
}

function makeSummary(functions, files, uiBindingsCount, expectedAppKeys) {
  const byApp = summarizeBy(functions, (fn) => fn.appKey);
  const byRisk = summarizeBy(functions, (fn) => fn.riskLevel);
  const byTime = summarizeBy(functions, (fn) => fn.timeComplexity);

  return {
    generatedAt: new Date().toISOString(),
    analyzedFileCount: files.length,
    totalFunctions: functions.length,
    totalUiBindings: uiBindingsCount,
    applications: expectedAppKeys.map((appKey) => ({
      appKey,
      appDisplay: appDisplayName(appKey),
      functionCount: byApp.get(appKey) ?? 0,
    })),
    riskDistribution: Object.fromEntries([...byRisk.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    timeComplexityDistribution: Object.fromEntries([...byTime.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  };
}

function main() {
  const workspaceRoots = listWorkspaceRoots();
  const expectedAppKeys = listExpectedAppKeys();
  const sourceFiles = listSourceFiles(workspaceRoots);

  const functions = [];
  let totalUiBindings = 0;

  for (const relPath of sourceFiles) {
    const absolutePath = path.join(ROOT, relPath);
    const ext = path.extname(relPath).toLowerCase();
    const appKey = inferAppKey(relPath);
    const sourceText = fs.readFileSync(absolutePath, "utf8");
    const surface = inferSurface(relPath, sourceText);

    if (TS_LIKE_EXTENSIONS.has(ext)) {
      const { functions: tsFunctions, uiBindings } = extractTsFunctions(relPath, sourceText, appKey, surface);
      totalUiBindings += uiBindings.length;
      functions.push(...tsFunctions);
      continue;
    }

    if (NATIVE_EXTENSIONS.has(ext)) {
      functions.push(...extractNativeFunctions(relPath, sourceText, appKey, surface));
    }
  }

  const sortedFunctions = functions.sort((a, b) => {
    if (a.appKey !== b.appKey) {
      return a.appKey.localeCompare(b.appKey);
    }
    if (a.surfaceType !== b.surfaceType) {
      return a.surfaceType.localeCompare(b.surfaceType);
    }
    if (a.surfaceName !== b.surfaceName) {
      return a.surfaceName.localeCompare(b.surfaceName);
    }
    if (a.filePath !== b.filePath) {
      return a.filePath.localeCompare(b.filePath);
    }
    return a.startLine - b.startLine;
  });

  const generatedAt = new Date().toISOString();
  const summary = makeSummary(sortedFunctions, sourceFiles, totalUiBindings, expectedAppKeys);

  ensureOutputDir();

  const jsonReport = writeJsonReport({
    ...summary,
    filesAnalyzed: sourceFiles,
    functions: sortedFunctions,
  });

  const csvReport = writeCsvReport(sortedFunctions);
  const inventoryReport = writeInventoryMarkdown({
    functions: sortedFunctions,
    allAppKeys: expectedAppKeys,
    generatedAt,
    analyzedFileCount: sourceFiles.length,
    totalUiBindings,
  });
  const worstReport = writeWorstFunctionsMarkdown(sortedFunctions, generatedAt);
  const remediationPlan = writeImplementationPlan(sortedFunctions, expectedAppKeys, generatedAt);

  const manifest = {
    generatedAt,
    files: {
      json: path.relative(ROOT, jsonReport),
      csv: path.relative(ROOT, csvReport),
      inventory: path.relative(ROOT, inventoryReport),
      worst: path.relative(ROOT, worstReport),
      remediationPlan: path.relative(ROOT, remediationPlan),
    },
    summary,
  };

  const manifestPath = path.join(OUTPUT_DIR, "function-audit-manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const consoleSummary = [
    "Function performance audit complete.",
    `- Source files analyzed: ${sourceFiles.length}`,
    `- Functions discovered: ${sortedFunctions.length}`,
    `- UI control bindings: ${totalUiBindings}`,
    `- Inventory markdown: ${path.relative(ROOT, inventoryReport)}`,
    `- Worst functions report: ${path.relative(ROOT, worstReport)}`,
    `- Remediation plan: ${path.relative(ROOT, remediationPlan)}`,
  ];
  console.log(consoleSummary.join("\n"));
}

main();
