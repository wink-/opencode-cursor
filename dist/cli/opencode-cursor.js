#!/usr/bin/env node
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/utils/errors.ts
function stripAnsi(str) {
  if (typeof str !== "string")
    return String(str ?? "");
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}
function parseAgentError(stderr) {
  const input = typeof stderr === "string" ? stderr : String(stderr ?? "");
  const clean = stripAnsi(input).trim();
  if (clean.includes("usage limit") || clean.includes("hit your usage limit")) {
    const savingsMatch = clean.match(/saved \$(\d+(?:\.\d+)?)/i);
    const resetMatch = clean.match(/reset[^0-9]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    const modelMatch = clean.match(/continue with (\w+)/i);
    const details = {};
    if (savingsMatch)
      details.savings = `$${savingsMatch[1]}`;
    if (resetMatch)
      details.resetDate = resetMatch[1];
    if (modelMatch)
      details.affectedModel = modelMatch[1];
    return {
      type: "quota",
      recoverable: false,
      message: clean,
      userMessage: "You've hit your Cursor usage limit",
      details,
      suggestion: "Switch to a different model or set a Spend Limit in Cursor settings"
    };
  }
  if (clean.includes("not logged in") || clean.includes("auth") || clean.includes("unauthorized")) {
    return {
      type: "auth",
      recoverable: false,
      message: clean,
      userMessage: "Not authenticated with Cursor",
      details: {},
      suggestion: "Run: opencode auth login → Other → cursor-acp, or: cursor-agent login"
    };
  }
  if (clean.includes("ECONNREFUSED") || clean.includes("network") || clean.includes("fetch failed")) {
    return {
      type: "network",
      recoverable: true,
      message: clean,
      userMessage: "Connection to Cursor failed",
      details: {},
      suggestion: "Check your internet connection and try again"
    };
  }
  if (clean.includes("model not found") || clean.includes("invalid model") || clean.includes("Cannot use this model")) {
    const modelMatch = clean.match(/Cannot use this model: ([^.]+)/);
    const availableMatch = clean.match(/Available models: (.+)/);
    const details = {};
    if (modelMatch)
      details.requested = modelMatch[1];
    if (availableMatch)
      details.available = availableMatch[1].split(", ").slice(0, 5).join(", ") + "...";
    return {
      type: "model",
      recoverable: false,
      message: clean,
      userMessage: modelMatch ? `Model '${modelMatch[1]}' not available` : "Requested model not available",
      details,
      suggestion: "Use cursor-acp/auto or check available models with: cursor-agent models"
    };
  }
  const recoverable = clean.includes("timeout") || clean.includes("ETIMEDOUT");
  return {
    type: "unknown",
    recoverable,
    message: clean,
    userMessage: clean.substring(0, 200) || "An error occurred",
    details: {}
  };
}
function isTransientContinuation(tail) {
  const trimmed = tail.trim();
  if (!trimmed)
    return false;
  const stripped = trimmed.replace(/^[\s:;,.]+/, "");
  const causalMatch = stripped.match(/^(?:because of|due to)\s+(.+)/i);
  if (causalMatch) {
    const cause = causalMatch[1];
    if (SESSION_SPECIFIC_CAUSE_WORDS.test(cause)) {
      return false;
    }
    if (TRANSIENT_CAUSE_WORDS.test(cause)) {
      return true;
    }
  }
  const firstSegment = stripped.split(/[,;]/)[0]?.trim() ?? "";
  if (firstSegment) {
    if (SESSION_SPECIFIC_CAUSE_WORDS.test(firstSegment)) {
      return false;
    }
    if (TRANSIENT_CAUSE_WORDS.test(firstSegment)) {
      return true;
    }
  }
  if (SESSION_SPECIFIC_CAUSE_WORDS.test(stripped)) {
    return false;
  }
  if (TRANSIENT_CAUSE_WORDS.test(stripped)) {
    return true;
  }
  return TRANSIENT_CONTINUATION_PATTERN.test(tail);
}
function isResumeSpecificFailure(stderr) {
  const text = typeof stderr === "string" ? stderr : String(stderr ?? "");
  const clean = stripAnsi(text);
  for (const pattern of RESUME_FAILURE_PATTERNS) {
    const match = clean.match(pattern);
    if (!match)
      continue;
    const tail = clean.slice(match.index + match[0].length);
    if (!isTransientContinuation(tail)) {
      return true;
    }
  }
  return false;
}
function formatErrorForUser(error) {
  let output = `cursor-acp error: ${error.userMessage || error.message || "Unknown error"}`;
  const details = error.details || {};
  if (Object.keys(details).length > 0) {
    const detailParts = Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(" | ");
    output += `
  ${detailParts}`;
  }
  if (error.suggestion) {
    output += `
  Suggestion: ${error.suggestion}`;
  }
  return output;
}
var BinaryNotFoundError, RESUME_FAILURE_PATTERNS, TRANSIENT_CONTINUATION_PATTERN, TRANSIENT_CAUSE_WORDS, SESSION_SPECIFIC_CAUSE_WORDS;
var init_errors = __esm(() => {
  BinaryNotFoundError = class BinaryNotFoundError extends Error {
    attemptedPath;
    constructor(attemptedPath) {
      super(`cursor-agent binary not found on Windows. Expected at: ${attemptedPath}. ` + `Install Cursor or set CURSOR_AGENT_EXECUTABLE env var.`);
      this.name = "BinaryNotFoundError";
      this.attemptedPath = attemptedPath;
    }
  };
  RESUME_FAILURE_PATTERNS = [
    /\bsession\s+(?:has\s+(?:been\s+)?|is\s+|was\s+)?(?:not\s+found|expired|deleted|missing|no\s+longer\s+exists)/i,
    /\bchat\s+(?:has\s+(?:been\s+)?|is\s+|was\s+)?(?:not\s+found|expired|deleted|missing|no\s+longer\s+exists)/i,
    /\bconversation\s+(?:has\s+(?:been\s+)?|is\s+|was\s+)?(?:not\s+found|expired|deleted|missing|no\s+longer\s+exists)/i,
    /\bthread\s+(?:has\s+(?:been\s+)?|is\s+|was\s+)?(?:not\s+found|expired|deleted|missing|no\s+longer\s+exists)/i,
    /\bresume\s+(?:failed|error|invalid|aborted)(?:\s+(?:session|chat|conversation|thread))?/i,
    /\bfailed\s+to\s+resume(?:\s+(?:session|chat|conversation|thread))?/i,
    /\bcould\s+not\s+resume(?:\s+(?:session|chat|conversation|thread))?/i,
    /\bno\s+active\s+session/i,
    /\bno\s+such\s+session/i,
    /\bno\s+such\s+chat/i,
    /\binvalid\s+(?:session|chat|conversation|thread)(?:\s+id)?/i,
    /\b(?:session|chat|conversation|thread)\s+invalid(?:\s+id)?/i,
    /\b(?:session|chat|conversation|thread)\s+id\s+(?:is\s+)?(?:invalid|not\s+found|expired|missing)/i,
    /\b(?:session|chat|conversation|thread)\s+(?:isn['’]t|wasn['’]t)\s+found/i,
    /\b(?:session|chat|conversation|thread)\s+(?:can(?:not|\s+not)|could\s+not)\s+(?:be\s+)?resumed/i,
    /\bunable\s+to\s+resume\b/i,
    /\bcan(?:not|\s+not)\s+resume\b/i
  ];
  TRANSIENT_CONTINUATION_PATTERN = /^\s*[:;]?\s*(?:token|credential|credentials|auth|secret|password|format|network|quota|usage|limit|api|key|request(?:_|-|\s+)?id?|due\s+to\s+(?:network|auth|quota)|because\s+of\s+(?:network|auth|quota)|caused\s+by\s+(?:network|auth|quota))/i;
  TRANSIENT_CAUSE_WORDS = /\b(?:auth(?:enticat(?:e|ion|ed))?|re-auth(?:enticate)?|token(?:\s+rotation)?|credential|password|secret|network|connection|internet|offline|quota|usage(?:\s+limit)?|api[\s-]?key|fetch\s+failed|econnrefused|timeout|timed\s+out)\b/i;
  SESSION_SPECIFIC_CAUSE_WORDS = /\b(?:inactiv(?:ity|e)|idle|policy|retention|archiv(?:e|ed)|purged|deleted|removed|expired)\b/i;
});

// src/utils/logger.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
function getConfiguredLevel() {
  const env = process.env.CURSOR_ACP_LOG_LEVEL?.toLowerCase();
  if (env && env in LEVEL_PRIORITY) {
    return env;
  }
  return "info";
}
function isSilent() {
  return process.env.CURSOR_ACP_LOG_SILENT === "1" || process.env.CURSOR_ACP_LOG_SILENT === "true";
}
function shouldLog(level) {
  if (isSilent())
    return false;
  const configured = getConfiguredLevel();
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configured];
}
function formatMessage(level, component, message, data) {
  const prefix = `[cursor-acp:${component}]`;
  const levelTag = level.toUpperCase().padEnd(5);
  let formatted = `${prefix} ${levelTag} ${message}`;
  if (data !== undefined) {
    if (typeof data === "object") {
      formatted += ` ${JSON.stringify(data)}`;
    } else {
      formatted += ` ${data}`;
    }
  }
  return formatted;
}
function isConsoleEnabled() {
  const consoleEnv = process.env.CURSOR_ACP_LOG_CONSOLE;
  return consoleEnv === "1" || consoleEnv === "true";
}
function getLogDir() {
  const override = process.env.CURSOR_ACP_LOG_DIR?.trim();
  return override || path.join(os.homedir(), ".opencode-cursor");
}
function getLogFile() {
  return path.join(getLogDir(), "plugin.log");
}
function ensureLogDir() {
  if (logDirEnsured)
    return;
  try {
    const logDir = getLogDir();
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    logDirEnsured = true;
  } catch {
    logFileError = true;
  }
}
function openLogStream() {
  if (logStream || logFileError)
    return;
  ensureLogDir();
  if (logFileError)
    return;
  try {
    try {
      logBytesWritten = fs.statSync(getLogFile()).size;
    } catch {
      logBytesWritten = 0;
    }
    logStream = fs.createWriteStream(getLogFile(), { flags: "a" });
    logStream.on("error", () => {
      if (!logFileError) {
        logFileError = true;
        console.error(`[cursor-acp] Failed to write logs. Using: ${getLogFile()}`);
      }
      logStream = null;
    });
  } catch {
    logFileError = true;
  }
}
function rotateIfNeeded() {
  if (logBytesWritten < MAX_LOG_SIZE)
    return;
  try {
    if (logStream) {
      logStream.end();
      logStream = null;
    }
    const logFile = getLogFile();
    fs.renameSync(logFile, logFile + ".1");
    logBytesWritten = 0;
    openLogStream();
  } catch {
    if (!logFileError && !logStream) {
      openLogStream();
    }
  }
}
function writeToFile(message) {
  if (logFileError)
    return;
  if (!logStream)
    openLogStream();
  if (logFileError || !logStream)
    return;
  rotateIfNeeded();
  if (logFileError || !logStream)
    return;
  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${message}
`;
  logStream.write(line);
  logBytesWritten += Buffer.byteLength(line);
}
function createLogger(component) {
  return {
    isDebugEnabled: () => shouldLog("debug"),
    debug: (message, data) => {
      if (!shouldLog("debug"))
        return;
      const formatted = formatMessage("debug", component, message, data);
      writeToFile(formatted);
      if (isConsoleEnabled())
        console.error(formatted);
    },
    info: (message, data) => {
      if (!shouldLog("info"))
        return;
      const formatted = formatMessage("info", component, message, data);
      writeToFile(formatted);
      if (isConsoleEnabled())
        console.error(formatted);
    },
    warn: (message, data) => {
      if (!shouldLog("warn"))
        return;
      const formatted = formatMessage("warn", component, message, data);
      writeToFile(formatted);
      if (isConsoleEnabled())
        console.error(formatted);
    },
    error: (message, data) => {
      if (!shouldLog("error"))
        return;
      const formatted = formatMessage("error", component, message, data);
      writeToFile(formatted);
      if (isConsoleEnabled())
        console.error(formatted);
    }
  };
}
var MAX_LOG_SIZE, LEVEL_PRIORITY, logDirEnsured = false, logFileError = false, logStream = null, logBytesWritten = 0;
var init_logger = __esm(() => {
  MAX_LOG_SIZE = 5 * 1024 * 1024;
  LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
});

// src/utils/binary.ts
import { existsSync as fsExistsSync } from "fs";
import * as pathModule from "path";
import { homedir as osHomedir } from "os";
function resolveCursorAgentBinary(deps = {}) {
  const platform = deps.platform ?? process.platform;
  const env = deps.env ?? process.env;
  const checkExists = deps.existsSync ?? fsExistsSync;
  const home = (deps.homedir ?? osHomedir)();
  const envOverride = env.CURSOR_AGENT_EXECUTABLE;
  if (envOverride && envOverride.length > 0) {
    return envOverride;
  }
  if (platform === "win32") {
    const pathJoin = pathModule.win32.join;
    const localAppData = env.LOCALAPPDATA ?? pathJoin(home, "AppData", "Local");
    const knownPath = pathJoin(localAppData, "cursor-agent", "cursor-agent.cmd");
    if (checkExists(knownPath)) {
      return knownPath;
    }
    log.warn("cursor-agent not found at known Windows path, falling back to PATH", { checkedPath: knownPath });
    return "cursor-agent.cmd";
  }
  const knownPaths = [
    pathModule.join(home, ".cursor-agent", "cursor-agent"),
    "/usr/local/bin/cursor-agent"
  ];
  for (const p of knownPaths) {
    if (checkExists(p)) {
      return p;
    }
  }
  log.warn("cursor-agent not found at known paths, falling back to PATH", { checkedPaths: knownPaths });
  return "cursor-agent";
}
function resolveCursorAgentBinaryStrict(deps = {}) {
  const platform = deps.platform ?? process.platform;
  const env = deps.env ?? process.env;
  const checkExists = deps.existsSync ?? fsExistsSync;
  const home = (deps.homedir ?? osHomedir)();
  const envOverride = env.CURSOR_AGENT_EXECUTABLE;
  if (envOverride && envOverride.length > 0) {
    return envOverride;
  }
  if (platform === "win32") {
    const pathJoin = pathModule.win32.join;
    const localAppData = env.LOCALAPPDATA ?? pathJoin(home, "AppData", "Local");
    const knownPath = pathJoin(localAppData, "cursor-agent", "cursor-agent.cmd");
    if (checkExists(knownPath)) {
      return knownPath;
    }
    throw new BinaryNotFoundError(knownPath);
  }
  return resolveCursorAgentBinary(deps);
}
function formatShellCommandForPlatform(command, platform = process.platform) {
  if (platform !== "win32") {
    return command;
  }
  if (command.startsWith('"') && command.endsWith('"')) {
    return command;
  }
  return `"${command}"`;
}
var log;
var init_binary = __esm(() => {
  init_logger();
  init_errors();
  log = createLogger("binary");
});

// src/cli/model-discovery.ts
import { execFileSync } from "child_process";
function parseCursorModelsOutput(output) {
  const clean = stripAnsi(output);
  const models = [];
  const seen = new Set;
  for (const line of clean.split(`
`)) {
    const trimmed = line.trim();
    if (!trimmed)
      continue;
    const match = trimmed.match(/^([a-zA-Z0-9._-]+)\s+-\s+(.+?)(?:\s+\((?:current|default)\))*\s*$/);
    if (!match)
      continue;
    const id = match[1];
    if (seen.has(id))
      continue;
    seen.add(id);
    models.push({ id, name: match[2].trim() });
  }
  return models;
}
function discoverModelsFromCursorAgent(deps = {}) {
  const platform = deps.platform ?? process.platform;
  const exec = deps.execFileSync ?? execFileSync;
  const resolveBinary = deps.resolveBinary ?? resolveCursorAgentBinary;
  const raw = exec(formatShellCommandForPlatform(resolveBinary(), platform), ["models"], {
    encoding: "utf8",
    shell: platform === "win32",
    ...platform !== "win32" && { killSignal: "SIGTERM" },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: MODEL_DISCOVERY_TIMEOUT_MS
  });
  const models = parseCursorModelsOutput(raw);
  if (models.length === 0) {
    throw new Error("No models parsed from cursor-agent output");
  }
  return models;
}
function fallbackModels() {
  return [
    { id: "auto", name: "Auto" },
    { id: "composer-1.5", name: "Composer 1.5" },
    { id: "composer-1", name: "Composer 1" },
    { id: "opus-4.6-thinking", name: "Claude 4.6 Opus (Thinking)" },
    { id: "opus-4.6", name: "Claude 4.6 Opus" },
    { id: "sonnet-4.6", name: "Claude 4.6 Sonnet" },
    { id: "sonnet-4.6-thinking", name: "Claude 4.6 Sonnet (Thinking)" },
    { id: "opus-4.5", name: "Claude 4.5 Opus" },
    { id: "opus-4.5-thinking", name: "Claude 4.5 Opus (Thinking)" },
    { id: "sonnet-4.5", name: "Claude 4.5 Sonnet" },
    { id: "sonnet-4.5-thinking", name: "Claude 4.5 Sonnet (Thinking)" },
    { id: "gpt-5.4-high", name: "GPT-5.4 High" },
    { id: "gpt-5.4-medium", name: "GPT-5.4" },
    { id: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
    { id: "gpt-5.2", name: "GPT-5.2" },
    { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro" },
    { id: "gemini-3-pro", name: "Gemini 3 Pro" },
    { id: "gemini-3-flash", name: "Gemini 3 Flash" },
    { id: "grok", name: "Grok" },
    { id: "kimi-k2.5", name: "Kimi K2.5" }
  ];
}
var MODEL_DISCOVERY_TIMEOUT_MS = 5000;
var init_model_discovery = __esm(() => {
  init_errors();
  init_binary();
});

// src/auth.ts
import { existsSync as existsSync2 } from "fs";
import { homedir as homedir2, platform } from "os";
import { join as join3 } from "path";
function getHomeDir() {
  const override = process.env.CURSOR_ACP_HOME_DIR;
  if (override && override.length > 0) {
    return override;
  }
  return homedir2();
}
function verifyCursorAuth() {
  const apiKey = process.env.CURSOR_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    log2.debug("CURSOR_API_KEY found, auth verified");
    return true;
  }
  const possiblePaths = getPossibleAuthPaths();
  for (const authPath of possiblePaths) {
    if (existsSync2(authPath)) {
      log2.debug("Auth file found", { path: authPath });
      return true;
    }
  }
  log2.debug("No auth found (no CURSOR_API_KEY, no auth file)", { checkedPaths: possiblePaths });
  return false;
}
function isUsableSdkApiKey(value) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }
  return !PLACEHOLDER_API_KEYS.has(trimmed.toLowerCase());
}
function normalizeAuthorizationHeader(value) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return;
  }
  const bearerMatch = /^bearer\s+(.+)$/i.exec(trimmed);
  return bearerMatch?.[1]?.trim() ?? trimmed;
}
function resolveSdkApiKey(input) {
  const candidates = [
    input.env?.CURSOR_API_KEY,
    input.storedApiKey,
    normalizeAuthorizationHeader(input.authorizationHeader)
  ];
  return candidates.find(isUsableSdkApiKey)?.trim();
}
function getPossibleAuthPaths() {
  const home = getHomeDir();
  const paths = [];
  const isDarwin = platform() === "darwin";
  const authFiles = ["cli-config.json", "auth.json"];
  if (isDarwin) {
    for (const file of authFiles) {
      paths.push(join3(home, ".cursor", file));
    }
    for (const file of authFiles) {
      paths.push(join3(home, ".config", "cursor", file));
    }
  } else {
    for (const file of authFiles) {
      paths.push(join3(home, ".config", "cursor", file));
    }
    const xdgConfig = process.env.XDG_CONFIG_HOME;
    if (xdgConfig && xdgConfig !== join3(home, ".config")) {
      for (const file of authFiles) {
        paths.push(join3(xdgConfig, "cursor", file));
      }
    }
    for (const file of authFiles) {
      paths.push(join3(home, ".cursor", file));
    }
  }
  return paths;
}
function getAuthFilePath() {
  const possiblePaths = getPossibleAuthPaths();
  for (const authPath of possiblePaths) {
    if (existsSync2(authPath)) {
      return authPath;
    }
  }
  return possiblePaths[0];
}
var log2, AUTH_POLL_TIMEOUT, PLACEHOLDER_API_KEYS;
var init_auth = __esm(() => {
  init_logger();
  log2 = createLogger("auth");
  AUTH_POLL_TIMEOUT = 5 * 60 * 1000;
  PLACEHOLDER_API_KEYS = new Set(["cursor-agent"]);
});

// src/provider/backend.ts
function parseCursorBackendPreference(value) {
  if (value === undefined || value.trim() === "") {
    return { preference: "auto", valid: true };
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto" || normalized === "cursor-agent" || normalized === "sdk") {
    return { preference: normalized, valid: true };
  }
  return { preference: "auto", valid: false };
}
function selectBackendForRequest(input) {
  if (input.preference === "sdk") {
    return "sdk";
  }
  if (input.preference === "auto" && !input.cursorAgentAvailable && isUsableSdkApiKey(input.sdkApiKey)) {
    return "sdk";
  }
  return "cursor-agent";
}
var init_backend = __esm(() => {
  init_auth();
  init_auth();
});

// src/client/sdk-child.ts
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync as existsSync3 } from "node:fs";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { randomBytes } from "node:crypto";
function extractEventJson(line) {
  const idx = line.indexOf(EVENT_KEY);
  if (idx < 0)
    return line;
  const start = idx + EVENT_KEY.length;
  const end = line.lastIndexOf("}");
  if (end <= start)
    return line;
  return line.substring(start, end);
}
function resolveNodeBinary() {
  return process.env.CURSOR_ACP_NODE_BIN || "node";
}
function resolveRunnerPath(currentFile = fileURLToPath(import.meta.url), checkExists = existsSync3, env = process.env) {
  const override = env.CURSOR_ACP_SDK_RUNNER_PATH?.trim();
  if (override) {
    if (checkExists(override)) {
      return override;
    }
    throw new Error(`CURSOR_ACP_SDK_RUNNER_PATH does not exist: ${override}`);
  }
  const currentDir = dirname(currentFile);
  const candidates = [
    resolve(currentDir, "../../scripts/sdk-runner.mjs"),
    resolve(currentDir, "../scripts/sdk-runner.mjs")
  ];
  for (const candidate of candidates) {
    if (checkExists(candidate)) {
      return candidate;
    }
  }
  log3.error("Could not resolve sdk-runner.mjs", {
    currentFile,
    candidates
  });
  throw new Error(`sdk-runner.mjs not found. Tried: ${candidates.join(", ")}`);
}
function generateRequestId() {
  return randomBytes(8).toString("hex");
}

class SdkRunnerSingleton {
  runnerProcess = null;
  lastApiKey = null;
  pendingRequests = new Map;
  lineBuffer = "";
  starting = null;
  async ensureRunning(apiKey) {
    if (this.lastApiKey && this.lastApiKey !== apiKey) {
      log3.info("API key changed, restarting runner");
      this.kill();
      this.starting = null;
    }
    if (this.runnerProcess) {
      return;
    }
    if (this.starting) {
      return this.starting;
    }
    this.starting = this.doSpawn(apiKey);
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }
  async doSpawn(apiKey) {
    const nodeBin = resolveNodeBinary();
    const runnerPath = resolveRunnerPath();
    log3.info("spawning persistent sdk runner", {
      runnerPath,
      nodeBin
    });
    this.lastApiKey = apiKey;
    this.runnerProcess = spawn(nodeBin, [runnerPath], {
      env: { ...process.env, CURSOR_API_KEY: apiKey },
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.runnerProcess.stdout?.on("data", (chunk) => {
      this.handleStdoutChunk(chunk);
    });
    this.runnerProcess.stderr?.on("data", (chunk) => {
      const text = chunk.toString("utf8").trimEnd();
      for (const line of text.split(`
`)) {
        if (line) {
          log3.debug(`[runner stderr] ${line}`);
        }
      }
    });
    this.runnerProcess.on("close", (code) => {
      log3.error(`sdk runner exited with code ${code}`);
      this.runnerProcess = null;
      for (const [id, pending] of this.pendingRequests.entries()) {
        pending.promiseRejector(new Error(`Runner exited with code ${code}`));
        pending.controller.error(new Error(`Runner exited with code ${code}`));
      }
      this.pendingRequests.clear();
    });
    this.runnerProcess.on("error", (err) => {
      log3.error("sdk runner spawn error", { error: err.message });
      this.runnerProcess = null;
      for (const [id, pending] of this.pendingRequests.entries()) {
        pending.promiseRejector(err);
        pending.controller.error(err);
      }
      this.pendingRequests.clear();
    });
  }
  sendRequest(requestId, model, cwd, prompt) {
    if (!this.runnerProcess || !this.runnerProcess.stdin) {
      throw new Error("Runner process not ready");
    }
    const request = { id: requestId, model, cwd, prompt };
    this.runnerProcess.stdin.write(JSON.stringify(request) + `
`);
  }
  sendRawRequest(request) {
    if (!this.runnerProcess || !this.runnerProcess.stdin) {
      throw new Error("Runner process not ready");
    }
    this.runnerProcess.stdin.write(JSON.stringify(request) + `
`);
  }
  handleStdoutChunk(chunk) {
    this.lineBuffer += chunk.toString("utf8");
    const lines = this.lineBuffer.split(`
`);
    this.lineBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim())
        continue;
      try {
        const wrapped = JSON.parse(line);
        const requestId = wrapped.id;
        if (!requestId) {
          log3.warn("Wrapped response missing id", { wrapped });
          continue;
        }
        const pending = this.pendingRequests.get(requestId);
        if (!pending) {
          log3.warn(`Received response for unknown request ${requestId}`, { wrapped });
          continue;
        }
        if (wrapped.done) {
          log3.info(`Request ${requestId} complete with exitCode ${wrapped.exitCode}`);
          pending.controller.close();
          pending.promiseResolver(wrapped.exitCode ?? 0);
          this.pendingRequests.delete(requestId);
        } else if (wrapped.event) {
          const eventJson = extractEventJson(line);
          pending.controller.enqueue(textEncoder.encode(eventJson + `
`));
        }
      } catch (err) {
        log3.error("Failed to parse wrapped response line", {
          line,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }
  registerPending(controller, promiseResolver, promiseRejector) {
    const id = generateRequestId();
    this.pendingRequests.set(id, { controller, promiseResolver, promiseRejector });
    return id;
  }
  kill() {
    if (this.runnerProcess) {
      try {
        this.runnerProcess.kill("SIGKILL");
      } catch {}
      this.runnerProcess = null;
    }
  }
}
function createSdkBunChild(options) {
  log3.info("creating sdk bun child", {
    model: options.model,
    cwd: options.cwd
  });
  let requestId;
  let resolveExited;
  let rejectExited;
  const exited = new Promise((resolve2, reject) => {
    resolveExited = resolve2;
    rejectExited = reject;
  });
  const stdout = new ReadableStream({
    start: async (controller) => {
      try {
        await singleton.ensureRunning(options.apiKey);
        requestId = singleton.registerPending(controller, resolveExited, rejectExited);
        log3.info(`request ${requestId} registered (bun)`);
        singleton.sendRequest(requestId, options.model, options.cwd, options.prompt);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log3.error("Failed to start request (bun)", { error: error.message });
        controller.error(error);
        rejectExited(error);
      }
    },
    cancel() {
      log3.debug(`request ${requestId} cancelled (bun)`);
    }
  });
  const stderr = new ReadableStream({
    start(controller) {
      controller.close();
    }
  });
  return {
    stdout,
    stderr,
    exited,
    kill() {
      log3.debug(`kill() called on bun child ${requestId}`);
    }
  };
}
function createSdkNodeChild(options) {
  const child = new SdkNodeChild;
  child.spawn(options).catch((err) => {
    log3.error("Spawn error", { error: err instanceof Error ? err.message : String(err) });
  });
  return child;
}
async function listModelsViaRunner(apiKey) {
  try {
    await singleton.ensureRunning(apiKey);
    return new Promise(async (resolve2, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 15000);
      const events = [];
      let gotModels = false;
      const decoder = new TextDecoder;
      const controller = {
        enqueue: (data) => {
          try {
            const event = JSON.parse(decoder.decode(data).trim());
            events.push(event);
            if (event.type === "models")
              gotModels = true;
          } catch (err) {
            log3.warn("listModels: failed to parse event", { error: String(err) });
          }
        },
        close: () => {},
        error: (e) => reject(e)
      };
      const id = singleton.registerPending(controller, (code) => {
        clearTimeout(timeout);
        if (!gotModels)
          return reject(new Error("No models"));
        if (code !== 0)
          return reject(new Error(`Code ${code}`));
        const m = events.find((e) => e.type === "models");
        resolve2(m?.models ?? []);
      }, (e) => {
        clearTimeout(timeout);
        reject(e);
      });
      singleton.sendRawRequest({ id, op: "listModels" });
    });
  } catch (err) {
    throw new Error(`listModelsViaRunner failed: ${String(err)}`);
  }
}
var log3, textEncoder, EVENT_KEY = '"event":', singleton, SdkNodeChild;
var init_sdk_child = __esm(() => {
  init_logger();
  log3 = createLogger("sdk-child");
  textEncoder = new TextEncoder;
  singleton = new SdkRunnerSingleton;
  SdkNodeChild = class SdkNodeChild extends EventEmitter {
    stdout = new PassThrough;
    stderr = new PassThrough;
    requestId = null;
    async spawn(options) {
      try {
        log3.info("spawning (via singleton) sdk node child", {
          model: options.model,
          cwd: options.cwd
        });
        await singleton.ensureRunning(options.apiKey);
        let requestId;
        let resolveExited;
        let rejectExited;
        const exited = new Promise((resolve2, reject) => {
          resolveExited = resolve2;
          rejectExited = reject;
        });
        const dummyController = {
          enqueue: (data) => {
            this.stdout.write(data);
          },
          close: () => {
            this.stdout.end();
          },
          error: (err) => {
            this.stdout.destroy(err);
          }
        };
        requestId = singleton.registerPending(dummyController, (code) => {
          this.stderr.end();
          this.emit("close", code);
          resolveExited(code);
        }, (err) => {
          this.stderr.end();
          this.emit("error", err);
          rejectExited(err);
        });
        this.requestId = requestId;
        log3.info(`request ${requestId} registered (node)`);
        singleton.sendRequest(requestId, options.model, options.cwd, options.prompt);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log3.error("Failed to spawn sdk node child", { error: error.message });
        this.emit("error", error);
      }
    }
    kill() {
      if (this.requestId) {
        log3.debug(`kill() called on node child ${this.requestId}`);
      }
    }
  };
});

// src/client/cursor-agent-child.ts
import { spawn as spawn2 } from "node:child_process";
import { randomBytes as randomBytes2 } from "node:crypto";
import { existsSync as existsSync4 } from "node:fs";
import { EventEmitter as EventEmitter2 } from "node:events";
import { PassThrough as PassThrough2 } from "node:stream";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { dirname as dirname2, resolve as resolve2 } from "node:path";
function isAgentPoolEnabled() {
  const value = process.env.CURSOR_ACP_AGENT_POOL?.toLowerCase();
  if (value === "0" || value === "false" || value === "off" || value === "no") {
    return false;
  }
  return true;
}
function parseAgentPoolIdleMs() {
  const value = process.env.CURSOR_ACP_AGENT_POOL_IDLE_MS?.trim();
  if (value == null || value === "")
    return DEFAULT_IDLE_MS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    return DEFAULT_IDLE_MS;
  return Math.floor(parsed);
}
function buildAgentPoolKey(workspace, model) {
  return `${workspace}\x00${model}`;
}
function resolveCursorAgentRunnerPath(currentFile = fileURLToPath2(import.meta.url), checkExists = existsSync4, env = process.env) {
  const override = env.CURSOR_ACP_CURSOR_AGENT_RUNNER_PATH?.trim();
  if (override) {
    if (checkExists(override)) {
      return override;
    }
    throw new Error(`CURSOR_ACP_CURSOR_AGENT_RUNNER_PATH does not exist: ${override}`);
  }
  const currentDir = dirname2(currentFile);
  const candidates = [
    resolve2(currentDir, "../../scripts/cursor-agent-runner.mjs"),
    resolve2(currentDir, "../scripts/cursor-agent-runner.mjs")
  ];
  for (const candidate of candidates) {
    if (checkExists(candidate)) {
      return candidate;
    }
  }
  throw new Error(`cursor-agent-runner.mjs not found. Tried: ${candidates.join(", ")}`);
}
function resolveNodeBinary2() {
  return process.env.CURSOR_ACP_NODE_BIN || "node";
}
function generateRequestId2() {
  return randomBytes2(8).toString("hex");
}

class CursorAgentPoolRunner {
  runnerProcess = null;
  pendingRequests = new Map;
  lineBuffer = "";
  starting = null;
  poolKey;
  onIdle;
  binaryMissing = false;
  attemptedPath = null;
  constructor(poolKey, onIdle) {
    this.poolKey = poolKey;
    this.onIdle = onIdle;
  }
  async ensureRunning() {
    if (this.runnerProcess || this.binaryMissing)
      return;
    if (this.starting)
      return this.starting;
    this.starting = this.doSpawn();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }
  async doSpawn() {
    try {
      resolveCursorAgentBinaryStrict();
    } catch (err) {
      if (err instanceof BinaryNotFoundError) {
        this.binaryMissing = true;
        this.attemptedPath = err.attemptedPath;
        log4.warn("cursor-agent binary not found on Windows, falling back to SDK runner", {
          attemptedPath: err.attemptedPath,
          platform: process.platform,
          fallback: "sdk-runner"
        });
        return;
      }
      throw err;
    }
    const nodeBin = resolveNodeBinary2();
    const runnerPath = resolveCursorAgentRunnerPath();
    log4.info("spawning persistent cursor-agent runner", {
      poolKeyHash: this.poolKey.slice(0, 8) + "…",
      runnerPath,
      nodeBin
    });
    this.runnerProcess = spawn2(nodeBin, [runnerPath], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.runnerProcess.stdout?.on("data", (chunk) => {
      this.handleStdoutChunk(chunk);
    });
    this.runnerProcess.stderr?.on("data", (chunk) => {
      const text = chunk.toString("utf8").trimEnd();
      for (const line of text.split(`
`)) {
        if (line)
          log4.debug(`[runner stderr] ${line}`);
      }
    });
    this.runnerProcess.on("close", (code) => {
      log4.error(`cursor-agent runner exited with code ${code}`, { poolKeyHash: this.poolKey.slice(0, 8) + "…" });
      this.runnerProcess = null;
      for (const [, pending] of this.pendingRequests.entries()) {
        pending.promiseRejector(new Error(`Runner exited with code ${code}`));
        pending.controller.error(new Error(`Runner exited with code ${code}`));
      }
      this.pendingRequests.clear();
    });
    this.runnerProcess.on("error", (err) => {
      log4.error("cursor-agent runner spawn error", { error: err.message });
      this.runnerProcess = null;
      for (const [, pending] of this.pendingRequests.entries()) {
        pending.promiseRejector(err);
        pending.controller.error(err);
      }
      this.pendingRequests.clear();
    });
  }
  sendRequest(requestId, request) {
    if (!this.runnerProcess?.stdin) {
      throw new Error("Runner process not ready");
    }
    const payload = {
      id: requestId,
      model: request.model,
      cwd: request.cwd,
      prompt: request.prompt,
      resumeChatId: request.resumeChatId,
      force: request.force ?? false,
      cursorAgent: resolveCursorAgentBinary()
    };
    this.runnerProcess.stdin.write(JSON.stringify(payload) + `
`);
  }
  cancel(requestId) {
    if (!this.runnerProcess?.stdin) {
      log4.warn("cancel() called but runner stdin not ready", { requestId });
      return;
    }
    this.runnerProcess.stdin.write(JSON.stringify({ cancel: requestId }) + `
`);
  }
  handleStdoutChunk(chunk) {
    this.lineBuffer += chunk.toString("utf8");
    const lines = this.lineBuffer.split(`
`);
    this.lineBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim())
        continue;
      try {
        const wrapped = JSON.parse(line);
        const requestId = wrapped.id;
        if (!requestId) {
          log4.warn("Wrapped response missing id", { wrapped });
          continue;
        }
        const pending = this.pendingRequests.get(requestId);
        if (!pending) {
          log4.warn(`Received response for unknown request ${requestId}`);
          continue;
        }
        if (wrapped.done) {
          pending.controller.close();
          pending.controller.closeStderr();
          pending.promiseResolver(wrapped.exitCode ?? 0);
          this.pendingRequests.delete(requestId);
          this.notifyIdleIfEmpty();
        } else if (wrapped.stderr != null) {
          const text = typeof wrapped.stderr === "string" ? wrapped.stderr : String(wrapped.stderr);
          pending.controller.enqueueStderr(new TextEncoder().encode(text));
        } else if (wrapped.event) {
          const eventJson = extractEventJson(line);
          pending.controller.enqueue(new TextEncoder().encode(eventJson + `
`));
        }
      } catch (err) {
        log4.error("Failed to parse wrapped response line", {
          line,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }
  isIdle() {
    return this.pendingRequests.size === 0;
  }
  notifyIdleIfEmpty() {
    if (this.pendingRequests.size === 0) {
      this.onIdle(this.poolKey);
    }
  }
  registerPending(controller, promiseResolver, promiseRejector) {
    const id = generateRequestId2();
    this.pendingRequests.set(id, { controller, promiseResolver, promiseRejector });
    return id;
  }
  failAllPending(err) {
    for (const [, pending] of this.pendingRequests.entries()) {
      pending.promiseRejector(err);
      pending.controller.error(err);
    }
    this.pendingRequests.clear();
  }
  kill() {
    if (this.runnerProcess) {
      try {
        this.runnerProcess.kill("SIGKILL");
      } catch {}
      this.runnerProcess = null;
    }
    this.failAllPending(new Error("Runner killed"));
  }
}

class CursorAgentPoolManager {
  runners = new Map;
  idleTimers = new Map;
  getRunner(poolKey) {
    this.clearIdleTimer(poolKey);
    let runner = this.runners.get(poolKey);
    if (!runner) {
      while (this.runners.size >= DEFAULT_MAX_POOL_ENTRIES) {
        const oldest = this.runners.keys().next().value;
        if (oldest === undefined)
          break;
        this.clearIdleTimer(oldest);
        this.runners.get(oldest)?.kill();
        this.runners.delete(oldest);
      }
      runner = new CursorAgentPoolRunner(poolKey, (idlePoolKey) => {
        this.scheduleIdleEviction(idlePoolKey);
      });
      this.runners.set(poolKey, runner);
    }
    return runner;
  }
  size() {
    return this.runners.size;
  }
  clearIdleTimer(poolKey) {
    const timer = this.idleTimers.get(poolKey);
    if (!timer)
      return;
    clearTimeout(timer);
    this.idleTimers.delete(poolKey);
  }
  scheduleIdleEviction(poolKey) {
    this.clearIdleTimer(poolKey);
    const idleMs = parseAgentPoolIdleMs();
    if (idleMs <= 0)
      return;
    const timer = setTimeout(() => {
      this.idleTimers.delete(poolKey);
      const runner = this.runners.get(poolKey);
      if (!runner || !runner.isIdle())
        return;
      runner.kill();
      this.runners.delete(poolKey);
      log4.debug("evicted idle cursor-agent runner", {
        poolKeyHash: poolKey.slice(0, 8) + "…",
        idleMs
      });
    }, idleMs);
    timer.unref?.();
    this.idleTimers.set(poolKey, timer);
  }
  stopAll() {
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();
    for (const runner of this.runners.values()) {
      runner.kill();
    }
    this.runners.clear();
  }
}
function createCursorAgentPoolNodeChild(options) {
  const poolKey = buildAgentPoolKey(options.cwd, options.model);
  const child = new CursorAgentPoolNodeChild(options.sdkApiKey, options.createSdkChild);
  child.spawn({ ...options, poolKey });
  return child;
}
var log4, DEFAULT_MAX_POOL_ENTRIES = 16, DEFAULT_IDLE_MS, poolManager, CursorAgentPoolNodeChild;
var init_cursor_agent_child = __esm(() => {
  init_logger();
  init_binary();
  init_errors();
  init_sdk_child();
  log4 = createLogger("cursor-agent-child");
  DEFAULT_IDLE_MS = 15 * 60 * 1000;
  poolManager = new CursorAgentPoolManager;
  CursorAgentPoolNodeChild = class CursorAgentPoolNodeChild extends EventEmitter2 {
    stdout = new PassThrough2;
    stderr = new PassThrough2;
    requestId = null;
    runner = null;
    sdkChild = null;
    sdkApiKey;
    createSdkChildFn;
    constructor(sdkApiKey, createSdkChild) {
      super();
      this.sdkApiKey = sdkApiKey;
      this.createSdkChildFn = createSdkChild;
    }
    spawn(options) {
      this.spawnInternal(options);
    }
    async spawnInternal(options) {
      try {
        const runner = poolManager.getRunner(options.poolKey);
        this.runner = runner;
        await runner.ensureRunning();
        if (runner.binaryMissing) {
          if (!this.sdkApiKey) {
            throw new Error(`Pool binary unavailable (${runner.attemptedPath}); SDK fallback also failed: no sdkApiKey provided.`);
          }
          try {
            const sdkChildFactory = this.createSdkChildFn ?? createSdkNodeChild;
            const sdkChild = sdkChildFactory({
              apiKey: this.sdkApiKey,
              model: options.model,
              prompt: options.prompt,
              cwd: options.cwd
            });
            this.sdkChild = sdkChild;
            sdkChild.stdout.on("data", (chunk) => {
              this.stdout.write(chunk);
            });
            sdkChild.stderr.on("data", (chunk) => {
              this.stderr.write(chunk);
            });
            sdkChild.on("close", (code) => {
              this.stderr.end();
              this.emit("close", code);
            });
            sdkChild.on("error", (err) => {
              const combinedErr = new Error(`Pool binary unavailable (${runner.attemptedPath}); SDK fallback also failed: ${err.message}`);
              this.emit("error", combinedErr);
              this.stderr?.end?.();
              this.stdout?.end?.();
              this.emit("close", 1);
            });
            log4.debug("cursor-agent pool fallback to SDK runner", {
              poolKeyHash: options.poolKey.slice(0, 8) + "…"
            });
            return;
          } catch (sdkErr) {
            throw new Error(`Pool binary unavailable (${runner.attemptedPath}); SDK fallback also failed: ${sdkErr instanceof Error ? sdkErr.message : String(sdkErr)}`);
          }
        }
        const controller = {
          enqueue: (data) => {
            this.stdout.write(data);
          },
          enqueueStderr: (data) => {
            this.stderr.write(data);
          },
          close: () => {
            this.stdout.end();
          },
          closeStderr: () => {
            this.stderr.end();
          },
          error: (err) => {
            this.stdout.destroy(err);
          }
        };
        const requestId = runner.registerPending(controller, (code) => {
          this.stderr.end();
          this.emit("close", code);
        }, (err) => {
          this.stderr.end();
          this.emit("error", err);
        });
        this.requestId = requestId;
        runner.sendRequest(requestId, options);
        log4.debug("cursor-agent pool request dispatched", {
          requestId,
          poolKeyHash: options.poolKey.slice(0, 8) + "…",
          resume: !!options.resumeChatId
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log4.error("Failed to spawn cursor-agent pool child", { error: error.message });
        this.emit("error", error);
        this.stderr.end();
        this.stdout.end();
        this.emit("close", 1);
      }
    }
    kill() {
      if (this.runner && this.requestId) {
        log4.debug(`kill() cancelling pool request ${this.requestId}`);
        this.runner.cancel(this.requestId);
      } else if (this.requestId) {
        log4.debug(`kill() called before runner ready for ${this.requestId}`);
      }
      if (this.sdkChild) {
        this.sdkChild.kill();
      }
    }
  };
});

// src/models/pricing.ts
function getCursorModelCost(modelId) {
  if (modelId === "auto")
    return AUTO_COST;
  if (modelId === "composer-2-fast")
    return COMPOSER_2_FAST_COST;
  if (modelId === "composer-2")
    return COMPOSER_2_COST;
  if (modelId === "composer-1.5")
    return COMPOSER_1_5_COST;
  if (modelId.startsWith("claude-opus-4-7"))
    return CLAUDE_OPUS_COST;
  if (modelId.startsWith("claude-4.6-opus")) {
    return modelId.endsWith("-fast") ? CLAUDE_OPUS_FAST_COST : CLAUDE_OPUS_COST;
  }
  if (modelId.startsWith("claude-4.5-opus"))
    return CLAUDE_OPUS_COST;
  if (modelId.startsWith("claude-4.6-sonnet"))
    return CLAUDE_SONNET_WITH_LONG_CONTEXT_COST;
  if (modelId.startsWith("claude-4.5-sonnet"))
    return CLAUDE_SONNET_WITH_LONG_CONTEXT_COST;
  if (modelId.startsWith("claude-4-sonnet"))
    return CLAUDE_SONNET_COST;
  if (modelId === "gemini-3.1-pro")
    return GEMINI_3_PRO_COST;
  if (modelId === "gemini-3-flash")
    return GEMINI_3_FLASH_COST;
  if (modelId.startsWith("gpt-5.5"))
    return GPT_5_5_COST;
  if (modelId.startsWith("gpt-5.4-mini"))
    return GPT_5_4_MINI_COST;
  if (modelId.startsWith("gpt-5.4-nano"))
    return GPT_5_4_NANO_COST;
  if (modelId.startsWith("gpt-5.4")) {
    return modelId.endsWith("-fast") ? GPT_5_4_FAST_COST : GPT_5_4_COST;
  }
  if (modelId.startsWith("gpt-5.3-codex"))
    return GPT_5_3_CODEX_COST;
  if (modelId.startsWith("gpt-5.2-codex"))
    return GPT_5_2_COST;
  if (modelId.startsWith("gpt-5.2"))
    return GPT_5_2_COST;
  if (modelId.startsWith("gpt-5.1-codex-mini"))
    return GPT_5_MINI_COST;
  if (modelId.startsWith("gpt-5.1-codex-max"))
    return GPT_5_1_COST;
  if (modelId.startsWith("gpt-5.1"))
    return GPT_5_1_COST;
  if (modelId === "gpt-5-mini")
    return GPT_5_MINI_COST;
  if (modelId.startsWith("grok-4-20"))
    return GROK_4_20_COST;
  if (modelId === "kimi-k2.5")
    return KIMI_K2_5_COST;
  return;
}
function cost(input, output, cacheRead, cacheWrite) {
  return {
    input,
    output,
    cache_read: cacheRead,
    cache_write: cacheWrite
  };
}
function withLongContext(base, longContext) {
  return {
    ...base,
    context_over_200k: longContext
  };
}
var AUTO_COST, COMPOSER_2_COST, COMPOSER_2_FAST_COST, COMPOSER_1_5_COST, CLAUDE_SONNET_COST, CLAUDE_SONNET_LONG_CONTEXT_COST, CLAUDE_SONNET_WITH_LONG_CONTEXT_COST, CLAUDE_OPUS_COST, CLAUDE_OPUS_FAST_COST, GEMINI_3_PRO_COST, GEMINI_3_FLASH_COST, GPT_5_1_COST, GPT_5_2_COST, GPT_5_3_CODEX_COST, GPT_5_4_COST, GPT_5_4_FAST_COST, GPT_5_4_MINI_COST, GPT_5_4_NANO_COST, GPT_5_5_COST, GPT_5_MINI_COST, GROK_4_20_COST, KIMI_K2_5_COST;
var init_pricing = __esm(() => {
  AUTO_COST = cost(1.25, 6, 0.25, 1.25);
  COMPOSER_2_COST = cost(0.5, 2.5, 0.2, 0.5);
  COMPOSER_2_FAST_COST = cost(1.5, 7.5, 0.35, 1.5);
  COMPOSER_1_5_COST = cost(3.5, 17.5, 0.35, 3.5);
  CLAUDE_SONNET_COST = cost(3, 15, 0.3, 3.75);
  CLAUDE_SONNET_LONG_CONTEXT_COST = cost(6, 22.5, 0.6, 7.5);
  CLAUDE_SONNET_WITH_LONG_CONTEXT_COST = withLongContext(CLAUDE_SONNET_COST, CLAUDE_SONNET_LONG_CONTEXT_COST);
  CLAUDE_OPUS_COST = cost(5, 25, 0.5, 6.25);
  CLAUDE_OPUS_FAST_COST = cost(30, 150, 3, 37.5);
  GEMINI_3_PRO_COST = withLongContext(cost(2, 12, 0.2, 2), cost(4, 18, 0.4, 4));
  GEMINI_3_FLASH_COST = cost(0.5, 3, 0.05, 0.5);
  GPT_5_1_COST = cost(1.25, 10, 0.125, 1.25);
  GPT_5_2_COST = cost(1.75, 14, 0.175, 1.75);
  GPT_5_3_CODEX_COST = cost(1.75, 14, 0.175, 1.75);
  GPT_5_4_COST = withLongContext(cost(2.5, 15, 0.25, 2.5), cost(5, 22.5, 0.5, 5));
  GPT_5_4_FAST_COST = cost(5, 30, 0.5, 5);
  GPT_5_4_MINI_COST = cost(0.75, 4.5, 0.075, 0.75);
  GPT_5_4_NANO_COST = cost(0.2, 1.25, 0.02, 0.2);
  GPT_5_5_COST = withLongContext(cost(5, 30, 0.5, 5), cost(10, 45, 1, 10));
  GPT_5_MINI_COST = cost(0.25, 2, 0.025, 0.25);
  GROK_4_20_COST = withLongContext(cost(2, 6, 0.2, 2), cost(4, 12, 0.4, 4));
  KIMI_K2_5_COST = cost(0.6, 3, 0.1, 0.6);
});

// src/models/variants.ts
function isSafeBaseId(baseId) {
  const parts = baseId.split("-").filter(Boolean);
  if (parts.length < 2)
    return false;
  if (baseId === "gpt-5")
    return false;
  return true;
}
function generateBaseCandidates(modelId) {
  const tokens = modelId.split("-");
  const candidates = [];
  for (let i = tokens.length - 1;i >= 1; i--) {
    const prefix = tokens.slice(0, i).join("-");
    if (isSafeBaseId(prefix))
      candidates.push(prefix);
  }
  return candidates;
}
function computeStats(candidate, modelIds) {
  const prefix = `${candidate}-`;
  const firstTokens = new Set;
  let count = 0;
  for (const otherId of modelIds) {
    if (!otherId.startsWith(prefix))
      continue;
    count++;
    const firstToken = otherId.slice(prefix.length).split("-", 1)[0];
    if (firstToken)
      firstTokens.add(firstToken);
  }
  return { count, diversity: firstTokens.size };
}
function chooseBase(modelId, knownModelIds, modelIds) {
  const candidates = generateBaseCandidates(modelId);
  if (candidates.length === 0)
    return null;
  const stats = new Map;
  for (const candidate of candidates) {
    stats.set(candidate, computeStats(candidate, modelIds));
  }
  let stepA = null;
  for (const candidate of candidates) {
    if (!knownModelIds.has(candidate))
      continue;
    const stat = stats.get(candidate);
    if (!stat || stat.count < 2 || stat.diversity < 2)
      continue;
    if (stepA === null || candidate.length < stepA.length)
      stepA = candidate;
  }
  if (stepA !== null)
    return stepA;
  let stepB = null;
  for (const candidate of candidates) {
    const stat = stats.get(candidate);
    if (!stat || stat.count < 2)
      continue;
    if (stepB === null || stat.diversity > stepB.diversity || stat.diversity === stepB.diversity && candidate.length > stepB.base.length) {
      stepB = { base: candidate, diversity: stat.diversity };
    }
  }
  if (stepB !== null)
    return stepB.base;
  let stepC = null;
  for (const candidate of candidates) {
    if (!knownModelIds.has(candidate))
      continue;
    if (stepC === null || candidate.length < stepC.length)
      stepC = candidate;
  }
  return stepC;
}
function getDefaultMember(members) {
  for (const variant of DEFAULT_VARIANT_ORDER) {
    const member = members.find((candidate) => candidate.variant === variant);
    if (member)
      return member;
  }
  return members[0];
}
function formatModelName(modelId) {
  return modelId.split("-").map((part) => {
    if (part === "gpt")
      return "GPT";
    if (part === "xhigh")
      return "XHigh";
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
}
function compareVariants(a, b) {
  if (a.variant === null)
    return -1;
  if (b.variant === null)
    return 1;
  const aIndex = VARIANT_DISPLAY_ORDER.indexOf(a.variant);
  const bIndex = VARIANT_DISPLAY_ORDER.indexOf(b.variant);
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;
  if (aIndex !== -1)
    return -1;
  if (bIndex !== -1)
    return 1;
  return a.variant.localeCompare(b.variant);
}
function createGroup(baseId, members) {
  const defaultMember = getDefaultMember(members);
  const variants = {};
  for (const member of [...members].sort(compareVariants)) {
    if (member.variant) {
      variants[member.variant] = member.cursorModelId;
    }
  }
  return {
    baseId,
    name: defaultMember.variant === null ? defaultMember.name : formatModelName(baseId),
    defaultCursorModelId: defaultMember.cursorModelId,
    variants,
    members
  };
}
function groupCursorModels(models) {
  const knownModelIds = new Set(models.map((model) => model.id));
  const modelIds = models.map((model) => model.id);
  const preferredBase = new Map;
  for (const model of models) {
    const base = chooseBase(model.id, knownModelIds, modelIds);
    if (base)
      preferredBase.set(model.id, base);
  }
  const baseSet = new Set(preferredBase.values());
  const groupMembers = new Map;
  const groupOrder = [];
  const recordMember = (baseId, member) => {
    const existing = groupMembers.get(baseId);
    if (existing) {
      existing.push(member);
      return;
    }
    groupMembers.set(baseId, [member]);
    groupOrder.push(baseId);
  };
  for (const model of models) {
    if (baseSet.has(model.id) && knownModelIds.has(model.id)) {
      recordMember(model.id, {
        baseId: model.id,
        variant: null,
        cursorModelId: model.id,
        name: model.name
      });
      continue;
    }
    const base = preferredBase.get(model.id);
    if (!base)
      continue;
    recordMember(base, {
      baseId: base,
      variant: model.id.slice(base.length + 1),
      cursorModelId: model.id,
      name: model.name
    });
  }
  const groupedIds = new Set;
  const groups = [];
  for (const baseId of groupOrder) {
    const members = groupMembers.get(baseId);
    if (!members || members.length < 2)
      continue;
    groups.push(createGroup(baseId, members));
    for (const member of members)
      groupedIds.add(member.cursorModelId);
  }
  const direct = [];
  for (const model of models) {
    if (groupedIds.has(model.id))
      continue;
    direct.push(model);
  }
  return { groups, direct };
}
function createVariantModelEntries(models) {
  const { groups, direct } = groupCursorModels(models);
  const entries = {};
  const groupedModelIds = new Set;
  for (const group of groups) {
    const variants = {};
    for (const [variant, cursorModel] of Object.entries(group.variants)) {
      const variantEntry = { cursorModel };
      const variantCost = getCursorModelCost(cursorModel);
      if (variantCost)
        variantEntry.cost = variantCost;
      variants[variant] = variantEntry;
    }
    const groupEntry = {
      name: group.name,
      options: {
        cursorModel: group.defaultCursorModelId
      },
      variants
    };
    const defaultCost = getCursorModelCost(group.defaultCursorModelId);
    if (defaultCost)
      groupEntry.cost = defaultCost;
    entries[group.baseId] = groupEntry;
    for (const member of group.members) {
      groupedModelIds.add(member.cursorModelId);
    }
  }
  for (const model of direct) {
    const entry = { name: model.name };
    const directCost = getCursorModelCost(model.id);
    if (directCost)
      entry.cost = directCost;
    entries[model.id] = entry;
  }
  return { entries, groupedModelIds };
}
function mergeCursorModelEntries(existingModels, discoveredModels, options) {
  if (!options.variants) {
    return mergeDirectModelEntries(existingModels, discoveredModels);
  }
  const { entries, groupedModelIds } = createVariantModelEntries(discoveredModels);
  const models = { ...existingModels };
  let removedCount = 0;
  if (options.compact) {
    for (const modelId of groupedModelIds) {
      if (!Object.prototype.hasOwnProperty.call(models, modelId))
        continue;
      if (Object.prototype.hasOwnProperty.call(entries, modelId))
        continue;
      delete models[modelId];
      removedCount++;
    }
  }
  for (const [modelId, entry] of Object.entries(entries)) {
    models[modelId] = mergeEntryPreservingUserFields(models[modelId], entry);
  }
  return {
    models,
    syncedCount: Object.keys(entries).length,
    groupedCount: groupedModelIds.size,
    removedCount
  };
}
function mergeDirectModelEntries(existingModels, discoveredModels) {
  const models = { ...existingModels };
  for (const model of discoveredModels) {
    const generated = { name: model.name };
    const directCost = getCursorModelCost(model.id);
    if (directCost)
      generated.cost = directCost;
    models[model.id] = mergeEntryPreservingUserFields(models[model.id], generated);
  }
  return {
    models,
    syncedCount: discoveredModels.length,
    groupedCount: 0,
    removedCount: 0
  };
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function mergeEntryPreservingUserFields(existing, generated) {
  if (!isPlainObject(existing))
    return generated;
  const merged = { ...existing, ...generated };
  if (existing.cost !== undefined) {
    merged.cost = existing.cost;
  }
  if (isPlainObject(existing.variants) && isPlainObject(generated.variants)) {
    const mergedVariants = { ...generated.variants };
    for (const [variantKey, existingVariant] of Object.entries(existing.variants)) {
      const generatedVariant = generated.variants[variantKey];
      if (!isPlainObject(existingVariant))
        continue;
      if (!isPlainObject(generatedVariant)) {
        mergedVariants[variantKey] = existingVariant;
        continue;
      }
      const variantMerged = { ...generatedVariant };
      if (existingVariant.cost !== undefined) {
        variantMerged.cost = existingVariant.cost;
      }
      mergedVariants[variantKey] = variantMerged;
    }
    merged.variants = mergedVariants;
  }
  return merged;
}
var DEFAULT_VARIANT_ORDER, VARIANT_DISPLAY_ORDER;
var init_variants = __esm(() => {
  init_pricing();
  DEFAULT_VARIANT_ORDER = [
    null,
    "medium",
    "high",
    "low",
    "none",
    "xhigh",
    "max"
  ];
  VARIANT_DISPLAY_ORDER = [
    "none",
    "low",
    "low-fast",
    "fast",
    "medium",
    "medium-fast",
    "medium-thinking",
    "high",
    "high-fast",
    "high-thinking",
    "high-thinking-fast",
    "xhigh",
    "xhigh-fast",
    "max",
    "max-thinking",
    "max-thinking-fast",
    "thinking",
    "thinking-low",
    "thinking-medium",
    "thinking-high",
    "thinking-high-fast",
    "thinking-xhigh",
    "thinking-max",
    "extra-high",
    "spark-preview",
    "spark-preview-low",
    "spark-preview-medium",
    "spark-preview-high",
    "spark-preview-xhigh"
  ];
});

// src/plugin-toggle.ts
import { existsSync as existsSync5, readFileSync } from "fs";
import { homedir as homedir3 } from "os";
import { join as join4, resolve as resolve3 } from "path";
function matchesPlugin(entry) {
  if (entry === CURSOR_PROVIDER_ID)
    return true;
  if (entry === NPM_PACKAGE_NAME)
    return true;
  if (entry.startsWith(`${NPM_PACKAGE_NAME}@`))
    return true;
  return false;
}
function resolveOpenCodeConfigPath(env = process.env) {
  if (env.OPENCODE_CONFIG && env.OPENCODE_CONFIG.length > 0) {
    return resolve3(env.OPENCODE_CONFIG);
  }
  const configHome = env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.length > 0 ? env.XDG_CONFIG_HOME : join4(homedir3(), ".config");
  return join4(configHome, "opencode", "opencode.json");
}
function isCursorPluginEnabledInConfig(config) {
  if (!config || typeof config !== "object") {
    return true;
  }
  const configObject = config;
  if (configObject.provider && typeof configObject.provider === "object") {
    if (CURSOR_PROVIDER_ID in configObject.provider) {
      return true;
    }
  }
  if (Array.isArray(configObject.plugin)) {
    return configObject.plugin.some((entry) => matchesPlugin(entry));
  }
  return true;
}
function shouldEnableCursorPlugin(env = process.env) {
  const configPath = resolveOpenCodeConfigPath(env);
  if (!existsSync5(configPath)) {
    return {
      enabled: true,
      configPath,
      reason: "config_missing"
    };
  }
  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    const enabled = isCursorPluginEnabledInConfig(parsed);
    return {
      enabled,
      configPath,
      reason: enabled ? "enabled" : "disabled_in_plugin_array"
    };
  } catch {
    return {
      enabled: true,
      configPath,
      reason: "config_unreadable_or_invalid"
    };
  }
}
var CURSOR_PROVIDER_ID = "cursor-acp", NPM_PACKAGE_NAME = "@rama_nigg/open-cursor";
var init_plugin_toggle = () => {};

// src/proxy/incremental-prompt.ts
function extractTextContent(content) {
  if (typeof content === "string")
    return content;
  if (Array.isArray(content)) {
    return content.map((part) => part?.type === "text" && typeof part.text === "string" ? part.text : "").filter(Boolean).join(`
`);
  }
  return "";
}
function formatAssistantToolCalls(message) {
  if (message?.role !== "assistant" || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
    return null;
  }
  const calls = message.tool_calls.map((tc) => {
    const fn = tc.function || {};
    return `tool_call(id: ${tc.id || "?"}, name: ${fn.name || "?"}, args: ${fn.arguments || "{}"})`;
  });
  return `ASSISTANT: ${calls.join(`
`)}`;
}
function buildToolCallNameMap(message) {
  const names = new Map;
  if (!message || !Array.isArray(message.tool_calls))
    return names;
  for (const tc of message.tool_calls) {
    const id = tc.id;
    const name = tc.function?.name;
    if (id && name)
      names.set(id, name);
  }
  return names;
}
function formatToolResult(message, toolNames) {
  const callId = message.tool_call_id || "unknown";
  const body = typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? "");
  const name = typeof message.name === "string" && message.name ? message.name : toolNames.get(callId);
  return name ? `TOOL_RESULT (name: ${name}, call_id: ${callId}): ${body}` : `TOOL_RESULT (call_id: ${callId}): ${body}`;
}
function buildIncrementalPrompt(messages) {
  if (messages.length === 0)
    return null;
  const last = messages[messages.length - 1];
  if (last?.role === "tool") {
    let firstToolIndex = messages.length - 1;
    while (firstToolIndex > 0 && messages[firstToolIndex - 1]?.role === "tool") {
      firstToolIndex--;
    }
    const assistant = messages[firstToolIndex - 1];
    const toolNames = buildToolCallNameMap(assistant);
    const lines = [];
    const assistantToolCalls = formatAssistantToolCalls(assistant);
    if (assistantToolCalls) {
      lines.push(assistantToolCalls);
    }
    for (let i = firstToolIndex;i < messages.length; i++) {
      const m = messages[i];
      if (m?.role !== "tool")
        break;
      lines.push(formatToolResult(m, toolNames));
    }
    if (lines.length === 0)
      return null;
    lines.push("The above tool calls have been executed. Continue your response based on these results.");
    return lines.join(`

`);
  }
  if (last?.role === "user") {
    const text = extractTextContent(last.content);
    if (!text.trim())
      return null;
    if (Array.isArray(last.content) && last.content.some((part) => part?.type && part.type !== "text")) {
      return null;
    }
    return text.trim();
  }
  return null;
}

// src/proxy/session-resume.ts
import { createHash } from "node:crypto";
function simpleHash(input) {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}
function isMetaUserMessage(content) {
  const lower = content.toLowerCase();
  return lower.includes("title generator") || lower.includes("thread title") || lower.includes("generate a brief title");
}
function deriveConversationAnchor(messages) {
  for (const message of messages) {
    if (message?.role !== "user")
      continue;
    const text = extractTextContent(message.content).trim();
    if (!text || isMetaUserMessage(text))
      continue;
    const canonical = canonicalizeContentForAnchor(message.content);
    return { anchor: simpleHash(canonical), contentPrefix: text.slice(0, 500) };
  }
  return;
}
function deriveConversationResumePrefixes(messages) {
  const users = [];
  for (let index = 0;index < messages.length; index++) {
    const message = messages[index];
    if (message?.role !== "user")
      continue;
    const text = extractTextContent(message.content).trim();
    if (!text || isMetaUserMessage(text))
      continue;
    users.push({
      canonical: canonicalizeContentForAnchor(message.content),
      prefix: text.slice(0, 500),
      index
    });
  }
  if (users.length === 0)
    return;
  const lastUserIsLatestMessage = users[users.length - 1]?.index === messages.length - 1;
  const lookupUsers = lastUserIsLatestMessage && users.length > 1 ? users.slice(0, -1) : users;
  return {
    lookupContentPrefix: buildUserSequencePrefix(lookupUsers),
    recordContentPrefix: buildUserSequencePrefix(users)
  };
}
function buildUserSequencePrefix(users) {
  if (users.length === 1)
    return users[0].prefix;
  return `users:${users.length}:${simpleHash(users.map((user) => user.canonical).join(`
\x00
`))}`;
}
function canonicalizeContentForAnchor(content) {
  if (typeof content === "string")
    return content;
  if (!Array.isArray(content))
    return "";
  const hasNonText = content.some((part) => part?.type !== "text" || typeof part.text !== "string");
  if (!hasNonText) {
    return content.map((part) => part.text).join(`
`);
  }
  return content.map((part) => {
    if (part?.type === "text" && typeof part.text === "string") {
      return `text:${part.text}`;
    }
    if (part?.type === "image_url") {
      return `image_url:${typeof part.image_url?.url === "string" ? part.image_url.url : ""}`;
    }
    return `part:${part?.type ?? ""}`;
  }).join(`
`);
}
function buildSessionKey(workspace, model, anchor) {
  return `${workspace}\x00${model}\x00${anchor}`;
}
function isSessionResumeEnabled() {
  const value = process.env.CURSOR_ACP_SESSION_RESUME?.toLowerCase();
  if (value === "0" || value === "false" || value === "off" || value === "no") {
    return false;
  }
  return true;
}
function getResumeChatId(sessionKey, expectedPrefix, toolFingerprint) {
  const entry = cache.get(sessionKey);
  if (!entry)
    return;
  if (Date.now() - entry.updatedAt > DEFAULT_TTL_MS) {
    evictEntry(sessionKey, "ttlExpired", {
      ageMs: Date.now() - entry.updatedAt,
      ttlMs: DEFAULT_TTL_MS
    });
    return;
  }
  if (expectedPrefix != null && entry.contentPrefix !== expectedPrefix) {
    log5.warn("Skipping session resume entry due to content prefix mismatch", {
      sessionKeyHash: sanitizeSessionKey(sessionKey),
      storedPrefixLength: entry.contentPrefix.length,
      expectedPrefixLength: expectedPrefix.length
    });
    return;
  }
  if ((toolFingerprint || entry.toolFingerprint) && entry.toolFingerprint !== toolFingerprint) {
    evictEntry(sessionKey, "toolFingerprintMismatch", {}, "warn");
    return;
  }
  cache.delete(sessionKey);
  cache.set(sessionKey, entry);
  return entry.chatId;
}
function hasResumeChatId(sessionKey, expectedPrefix, toolFingerprint) {
  const entry = cache.get(sessionKey);
  if (!entry)
    return false;
  if (Date.now() - entry.updatedAt > DEFAULT_TTL_MS)
    return false;
  if (expectedPrefix != null && entry.contentPrefix !== expectedPrefix)
    return false;
  if ((toolFingerprint || entry.toolFingerprint) && entry.toolFingerprint !== toolFingerprint) {
    return false;
  }
  return !!entry.chatId;
}
function recordResumeChatId(sessionKey, chatId, contentPrefix, toolFingerprint) {
  if (!chatId)
    return;
  const trimmed = chatId.trim();
  if (!RESUME_CHAT_ID_SAFE_RE.test(trimmed)) {
    log5.warn("Refusing to cache unsafe resume chat ID", {
      sessionKeyHash: sanitizeSessionKey(sessionKey),
      chatIdHash: hashForLog(trimmed)
    });
    return;
  }
  cache.delete(sessionKey);
  cache.set(sessionKey, {
    chatId: trimmed,
    contentPrefix,
    toolFingerprint,
    updatedAt: Date.now()
  });
  while (cache.size > DEFAULT_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined)
      break;
    evictEntry(oldest, "maxEntries", { maxEntries: DEFAULT_MAX_ENTRIES });
  }
}
function sanitizeSessionKey(sessionKey) {
  return createHash("sha256").update(sessionKey).digest("hex").slice(0, 32);
}
function hashForLog(input) {
  return sanitizeSessionKey(typeof input === "string" ? input : String(input ?? ""));
}
function evictEntry(sessionKey, reason, extra = {}, logLevel = "info") {
  const payload = {
    sessionKeyHash: sanitizeSessionKey(sessionKey),
    reason,
    ...extra
  };
  if (logLevel === "warn") {
    log5.warn("Evicting session resume entry", payload);
  } else {
    log5.info("Evicting session resume entry", payload);
  }
  cache.delete(sessionKey);
}
function clearResumeChatId(sessionKey) {
  cache.delete(sessionKey);
}
var log5, RESUME_CHAT_ID_SAFE_RE, DEFAULT_TTL_MS, DEFAULT_MAX_ENTRIES = 64, cache;
var init_session_resume = __esm(() => {
  init_logger();
  log5 = createLogger("session-resume");
  RESUME_CHAT_ID_SAFE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
  DEFAULT_TTL_MS = 60 * 60 * 1000;
  cache = new Map;
});

// src/streaming/parser.ts
var log6, parseStreamJsonLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    log6.debug("Failed to parse NDJSON line", { line: trimmed.substring(0, 100) });
    return null;
  }
};
var init_parser = __esm(() => {
  init_logger();
  log6 = createLogger("streaming:parser");
});

// src/streaming/delta-tracker.ts
class DeltaTracker {
  lastText = "";
  lastThinking = "";
  nextText(value) {
    const delta = this.diff(this.lastText, value);
    this.lastText = value;
    return delta;
  }
  nextThinking(value) {
    const delta = this.diff(this.lastThinking, value);
    this.lastThinking = value;
    return delta;
  }
  reset() {
    this.lastText = "";
    this.lastThinking = "";
  }
  diff(previous, current) {
    if (!previous) {
      return current;
    }
    if (current.startsWith(previous)) {
      return current.slice(previous.length);
    }
    if (previous.startsWith(current)) {
      return "";
    }
    let i = 0;
    const minLen = Math.min(previous.length, current.length);
    while (i < minLen && previous[i] === current[i]) {
      i++;
    }
    return current.slice(i);
  }
}

class MixedDeltaTracker {
  emittedText = "";
  emittedThinking = "";
  nextText(value, isDelta = false) {
    const delta = isDelta ? value : this.diff(this.emittedText, value);
    if (delta) {
      this.emittedText += delta;
    }
    return delta;
  }
  nextThinking(value, isDelta = false) {
    const delta = isDelta ? value : this.diff(this.emittedThinking, value);
    if (delta) {
      this.emittedThinking += delta;
    }
    return delta;
  }
  reset() {
    this.emittedText = "";
    this.emittedThinking = "";
  }
  diff(emitted, current) {
    if (!emitted) {
      return current;
    }
    if (current.startsWith(emitted)) {
      return current.slice(emitted.length);
    }
    if (emitted.startsWith(current)) {
      return "";
    }
    return current;
  }
}

// src/streaming/types.ts
var hasTextContent = (event) => event.message.content.some((content) => content.type === "text"), hasThinkingContent = (event) => event.message.content.some((content) => content.type === "thinking"), isAssistantText = (event) => event.type === "assistant" && hasTextContent(event), isThinking = (event) => {
  if (event.type === "thinking") {
    return true;
  }
  return event.type === "assistant" && hasThinkingContent(event);
}, isPartialStreamDelta = (event) => {
  return typeof event.timestamp_ms === "number" && typeof event.model_call_id !== "string";
}, isToolCall = (event) => event.type === "tool_call", isToolCallStart = (event) => isToolCall(event) && (event.subtype ?? "started") === "started", isResult = (event) => event.type === "result", extractText = (event) => event.message.content.filter((content) => content.type === "text").map((content) => content.text).join(""), extractThinking = (event) => {
  if (event.type === "thinking") {
    return event.text ?? "";
  }
  return event.message.content.filter((content) => content.type === "thinking").map((content) => content.thinking).join("");
}, inferToolName = (event) => {
  const [key] = Object.keys(event.tool_call ?? {});
  if (!key) {
    return "";
  }
  if (key.endsWith("ToolCall")) {
    const base = key.slice(0, -"ToolCall".length);
    return base.charAt(0).toLowerCase() + base.slice(1);
  }
  return key;
};

// src/proxy/bridge-json.ts
import { createHash as createHash2 } from "node:crypto";

class BridgeJsonStreamDetector {
  allowedToolNames;
  writeSchema;
  state = "undecided";
  buffer = "";
  tracker = new MixedDeltaTracker;
  constructor(allowedToolNames, writeSchema) {
    this.allowedToolNames = allowedToolNames;
    this.writeSchema = writeSchema;
  }
  push(event) {
    const text = extractText(event);
    const delta = this.tracker.nextText(text, isPartialStreamDelta(event));
    if (!delta) {
      return this.state === "passthrough" ? { action: "passthrough" } : { action: "buffer" };
    }
    if (this.state === "passthrough") {
      return { action: "passthrough" };
    }
    const hadBufferedText = this.buffer.length > 0;
    this.buffer += delta;
    if (this.state === "undecided") {
      const meaningful = this.buffer.trimStart();
      if (!meaningful || meaningful === "`" || meaningful === "``") {
        return { action: "buffer" };
      }
      if (meaningful.startsWith("{") || meaningful.startsWith("```")) {
        this.state = "candidate";
      } else {
        const withheld = this.buffer;
        this.buffer = "";
        this.state = "passthrough";
        return hadBufferedText ? { action: "passthrough", text: withheld } : { action: "passthrough" };
      }
    }
    const trimmed = this.buffer.trimStart();
    if (trimmed.startsWith("```")) {
      const infoLineEnd = trimmed.indexOf(`
`, 3);
      if (infoLineEnd < 0) {
        return { action: "buffer" };
      }
      const info = trimmed.slice(3, infoLineEnd).trim();
      if (info && info.toLowerCase() !== "json") {
        return this.releaseBuffer();
      }
    }
    const toolCall = extractBridgeToolCallFromText(this.buffer, this.allowedToolNames, this.writeSchema);
    if (toolCall) {
      this.buffer = "";
      this.state = "passthrough";
      return { action: "tool_call", toolCall };
    }
    if (containsCompleteJson(this.buffer)) {
      return this.releaseBuffer();
    }
    return { action: "buffer" };
  }
  flush() {
    if (this.state === "passthrough" || !this.buffer) {
      return "";
    }
    const text = this.buffer;
    this.buffer = "";
    this.state = "passthrough";
    return text;
  }
  reset() {
    this.state = "undecided";
    this.buffer = "";
    this.tracker.reset();
  }
  releaseBuffer() {
    const text = this.buffer;
    this.buffer = "";
    this.state = "passthrough";
    return { action: "passthrough", text };
  }
}
function isBridgeJsonEnabled(env = process.env) {
  const raw = env[BRIDGE_JSON_ENV];
  if (raw === undefined) {
    return true;
  }
  return !["0", "false", "off", "no", "disabled"].includes(raw.trim().toLowerCase());
}
function applyBridgeJsonPrompt(prompt, options) {
  if (!isBridgeJsonEnabled(options.env)) {
    return prompt;
  }
  let result = prompt;
  if (resolveAllowedWriteToolName(options.allowedToolNames) && !result.includes("opencode bridge mode is active")) {
    result = result ? `${BRIDGE_JSON_CONTEXT}

${result}` : BRIDGE_JSON_CONTEXT;
  }
  if (options.allowedToolNames.has("task") && !result.includes("OpenCode Task bridge mode is active")) {
    result = result ? `${result}

${TASK_BRIDGE_JSON_CONTEXT}` : TASK_BRIDGE_JSON_CONTEXT;
  }
  return result;
}
function extractBridgeToolCallFromText(text, allowedToolNames, writeSchema) {
  const jsonText = extractStrictJsonText(text);
  if (!jsonText) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed.arguments)) {
    return null;
  }
  if (parsed.name === "task") {
    return allowedToolNames.has("task") ? buildTaskToolCall(jsonText, parsed.arguments) : null;
  }
  const writeToolName = resolveAllowedWriteToolName(allowedToolNames);
  if (parsed.name !== "write" || !writeToolName) {
    return null;
  }
  const { path: path2 } = parsed.arguments;
  const content = typeof parsed.arguments.content === "string" ? parsed.arguments.content : parsed.arguments.contents;
  if (typeof path2 !== "string" || path2.trim().length === 0 || typeof content !== "string") {
    return null;
  }
  return {
    id: `call_bridge_${shortHash(jsonText)}`,
    type: "function",
    function: {
      name: writeToolName,
      arguments: JSON.stringify(buildWriteArguments(path2, content, writeSchema))
    }
  };
}
function buildTaskToolCall(jsonText, args) {
  if (!isNonEmptyString(args.description) || !isNonEmptyString(args.prompt) || !isNonEmptyString(args.subagent_type) || args.task_id !== undefined && typeof args.task_id !== "string" || args.command !== undefined && typeof args.command !== "string") {
    return null;
  }
  return {
    id: `call_bridge_${shortHash(jsonText)}`,
    type: "function",
    function: {
      name: "task",
      arguments: JSON.stringify(args)
    }
  };
}
function extractBridgeToolCallFromStreamOutput(output, allowedToolNames, writeSchema) {
  if (!output) {
    return null;
  }
  const detector = new BridgeJsonStreamDetector(allowedToolNames, writeSchema);
  for (const line of output.split(`
`)) {
    const event = parseStreamJsonLine(line);
    if (!event) {
      continue;
    }
    if (isAssistantText(event)) {
      const decision = detector.push(event);
      if (decision.action === "tool_call") {
        return decision.toolCall;
      }
    } else if (event.type === "tool_call") {
      detector.reset();
    }
  }
  return null;
}
function buildWriteArguments(path2, content, writeSchema) {
  if (isRecord(writeSchema) && isRecord(writeSchema.properties)) {
    const properties = writeSchema.properties;
    const required = Array.isArray(writeSchema.required) ? writeSchema.required.filter((value) => typeof value === "string") : [];
    if (required.includes("filePath") || "filePath" in properties && !("path" in properties)) {
      return { filePath: path2, content };
    }
  }
  return { path: path2, content };
}
function resolveAllowedWriteToolName(allowedToolNames) {
  if (allowedToolNames.has("write")) {
    return "write";
  }
  if (allowedToolNames.has("oc_write")) {
    return "oc_write";
  }
  return null;
}
function extractStrictJsonText(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  return fenced ? fenced[1].trim() : null;
}
function containsCompleteJson(text) {
  const jsonText = extractStrictJsonText(text);
  if (!jsonText) {
    return false;
  }
  try {
    JSON.parse(jsonText);
    return true;
  } catch {
    return false;
  }
}
function shortHash(value) {
  return createHash2("sha256").update(value).digest("hex").slice(0, 12);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
var BRIDGE_JSON_ENV = "CURSOR_ACP_BRIDGE_JSON", BRIDGE_JSON_CONTEXT = `SYSTEM: opencode bridge mode is active.
For file changes through opencode-cursor, read any needed files first, then respond with exactly one JSON object and no prose:
{"name":"write","arguments":{"path":"relative/path","content":"complete file contents"}}
Use this only for a single complete-file write. Otherwise answer normally or use the available tool format.`, TASK_BRIDGE_JSON_CONTEXT = `SYSTEM: OpenCode Task bridge mode is active.
For Task only, the exact envelope below overrides the earlier generic "standard OpenAI tool_call" instruction. Do not add id, type, or function fields, and do not stringify arguments.
OpenCode owns the task tool. Do not invoke Cursor's built-in Task tool; it uses a different subagent list. To call OpenCode's task tool, respond with exactly one JSON object and no prose:
{"name":"task","arguments":{"description":"3-5 words","prompt":"task details","subagent_type":"one name listed in the OpenCode task description"}}
Use this only when delegating through OpenCode. Otherwise answer normally.`;
var init_bridge_json = __esm(() => {
  init_parser();
});

// src/cli/opencode-cursor.ts
init_model_discovery();
init_binary();
init_auth();
init_backend();
init_cursor_agent_child();
init_variants();
init_plugin_toggle();
init_session_resume();
init_bridge_json();
import { execFileSync as execFileSync2 } from "child_process";
import {
  copyFileSync,
  existsSync as existsSync6,
  lstatSync,
  mkdirSync as mkdirSync2,
  realpathSync,
  readFileSync as readFileSync2,
  rmSync,
  symlinkSync,
  writeFileSync
} from "fs";
import { homedir as homedir4 } from "os";
import { basename, dirname as dirname3, join as join5, resolve as resolve4 } from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
var BRANDING_HEADER = `
 ▄▄▄  ▄▄▄▄  ▄▄▄▄▄ ▄▄  ▄▄      ▄▄▄  ▄▄ ▄▄ ▄▄▄▄   ▄▄▄▄   ▄▄▄   ▄▄▄▄
██ ██ ██ ██ ██▄▄  ███▄██ ▄▄▄ ██ ▀▀ ██ ██ ██ ██ ██▄▄▄  ██ ██  ██ ██
▀█▄█▀ ██▀▀  ██▄▄▄ ██ ▀██     ▀█▄█▀ ▀█▄█▀ ██▀█▄ ▄▄▄█▀  ▀█▄█▀  ██▀█▄
`;
function getBrandingHeader() {
  return BRANDING_HEADER.trim();
}
function checkBun() {
  try {
    const version = execFileSync2("bun", ["--version"], { encoding: "utf8" }).trim();
    return { name: "bun", passed: true, message: `v${version}` };
  } catch {
    return {
      name: "bun",
      passed: false,
      message: "not found - install with: curl -fsSL https://bun.sh/install | bash"
    };
  }
}
function checkCursorAgent() {
  try {
    const output = execFileSync2(formatShellCommandForPlatform(resolveCursorAgentBinary()), ["--version"], {
      encoding: "utf8",
      shell: process.platform === "win32"
    }).trim();
    const version = output.split(`
`)[0] || "installed";
    return { name: "cursor-agent", passed: true, message: version };
  } catch {
    return {
      name: "cursor-agent",
      passed: false,
      message: "not found - install with: curl -fsS https://cursor.com/install | bash"
    };
  }
}
function checkCursorAgentLogin() {
  try {
    execFileSync2(formatShellCommandForPlatform(resolveCursorAgentBinary()), ["models"], {
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 3000
    });
    return { name: "cursor-agent login", passed: true, message: "logged in" };
  } catch {
    return {
      name: "cursor-agent login",
      passed: false,
      message: "not logged in - run: cursor-agent login",
      warning: true
    };
  }
}
function getProviderApiKey(config) {
  const provider = config?.provider?.[PROVIDER_ID];
  const apiKey = provider?.options?.apiKey;
  return typeof apiKey === "string" ? apiKey : undefined;
}
function resolveCliSdkAuthSource(config) {
  if (isUsableSdkApiKey(process.env.CURSOR_API_KEY)) {
    return "CURSOR_API_KEY";
  }
  if (isUsableSdkApiKey(getProviderApiKey(config))) {
    return "provider.options.apiKey";
  }
  return;
}
function getRuntimeStatus() {
  return {
    backend: {
      preference: parseCursorBackendPreference(process.env.CURSOR_ACP_BACKEND).preference
    },
    agentPool: {
      enabled: isAgentPoolEnabled(),
      idleMs: parseAgentPoolIdleMs()
    },
    sessionResume: {
      enabled: isSessionResumeEnabled()
    },
    logging: {
      level: process.env.CURSOR_ACP_LOG_LEVEL || "info",
      console: process.env.CURSOR_ACP_LOG_CONSOLE === "1",
      dir: process.env.CURSOR_ACP_LOG_DIR || join5(homedir4(), ".opencode-cursor")
    }
  };
}
function checkSdkApiKey(config) {
  const source = resolveCliSdkAuthSource(config);
  if (source) {
    return {
      name: "Cursor SDK API key",
      passed: true,
      message: `available via ${source}`
    };
  }
  const backend = parseCursorBackendPreference(process.env.CURSOR_ACP_BACKEND).preference;
  return {
    name: "Cursor SDK API key",
    passed: false,
    warning: backend !== "sdk",
    message: backend === "sdk" ? "not configured - required for CURSOR_ACP_BACKEND=sdk" : "not configured - required only for CURSOR_ACP_BACKEND=sdk or when cursor-agent is unavailable"
  };
}
function adjustCursorAgentCheckForBackend(check, config) {
  if (check.passed) {
    return check;
  }
  const backend = parseCursorBackendPreference(process.env.CURSOR_ACP_BACKEND).preference;
  const sdkSource = resolveCliSdkAuthSource(config);
  const sdkCanHandleRequest = backend === "sdk" || backend === "auto" && sdkSource;
  if (!sdkCanHandleRequest) {
    return check;
  }
  return {
    ...check,
    warning: true,
    message: sdkSource ? `${check.message}; SDK backend can be used via ${sdkSource}` : `${check.message}; SDK backend selected but no SDK API key is configured`
  };
}
function checkOpenCode() {
  try {
    const version = execFileSync2("opencode", ["--version"], { encoding: "utf8" }).trim();
    return { name: "OpenCode", passed: true, message: version };
  } catch {
    return {
      name: "OpenCode",
      passed: false,
      message: "not found - install with: curl -fsSL https://opencode.ai/install | bash"
    };
  }
}
function isNpmDirectInstalled(config) {
  if (!config || typeof config !== "object")
    return false;
  const plugins = config.plugin;
  if (!Array.isArray(plugins))
    return false;
  return plugins.some((p) => typeof p === "string" && p.startsWith(NPM_PACKAGE_PREFIX));
}
function checkPluginFile(pluginPath, config) {
  try {
    if (!existsSync6(pluginPath)) {
      if (isNpmDirectInstalled(config)) {
        return {
          name: "Plugin file",
          passed: true,
          message: "Installed via npm package (no symlink needed)"
        };
      }
      return {
        name: "Plugin file",
        passed: false,
        message: "not found - run: open-cursor install"
      };
    }
    const stat = lstatSync(pluginPath);
    if (stat.isSymbolicLink()) {
      const target = readFileSync2(pluginPath, "utf8");
      return { name: "Plugin file", passed: true, message: `symlink → ${target}` };
    }
    return { name: "Plugin file", passed: true, message: "file (copy)" };
  } catch {
    return {
      name: "Plugin file",
      passed: false,
      message: "error reading plugin file"
    };
  }
}
function checkProviderConfig(configPath) {
  try {
    if (!existsSync6(configPath)) {
      return {
        name: "Provider config",
        passed: false,
        message: "config not found - run: open-cursor install"
      };
    }
    const config = readConfig(configPath);
    const provider = config.provider?.["cursor-acp"];
    if (!provider) {
      return {
        name: "Provider config",
        passed: false,
        message: "cursor-acp provider missing - run: open-cursor install"
      };
    }
    const modelCount = Object.keys(provider.models || {}).length;
    return { name: "Provider config", passed: true, message: `${modelCount} models` };
  } catch {
    return {
      name: "Provider config",
      passed: false,
      message: "error reading config"
    };
  }
}
function checkAiSdk(opencodeDir) {
  try {
    const sdkPath = join5(opencodeDir, "node_modules", "@ai-sdk", "openai-compatible");
    if (existsSync6(sdkPath)) {
      return { name: "AI SDK", passed: true, message: "@ai-sdk/openai-compatible installed" };
    }
    return {
      name: "AI SDK",
      passed: false,
      message: "not installed - run: open-cursor install"
    };
  } catch {
    return {
      name: "AI SDK",
      passed: false,
      message: "error checking AI SDK"
    };
  }
}
function runDoctorChecks(configPath, pluginPath) {
  const opencodeDir = dirname3(configPath);
  let config;
  try {
    config = readConfig(configPath);
  } catch {
    config = undefined;
  }
  return [
    checkBun(),
    adjustCursorAgentCheckForBackend(checkCursorAgent(), config),
    checkCursorAgentLogin(),
    checkSdkApiKey(config),
    checkOpenCode(),
    checkPluginFile(pluginPath, config),
    checkProviderConfig(configPath),
    checkAiSdk(opencodeDir)
  ];
}
var PROVIDER_ID = "cursor-acp";
var NPM_PACKAGE_PREFIX = "@rama_nigg/open-cursor";
var DEFAULT_BASE_URL = "http://127.0.0.1:32124/v1";
function printHelp() {
  const binName = basename(process.argv[1] || "open-cursor");
  console.log(getBrandingHeader());
  console.log(`${binName}

Commands:
  install     Configure OpenCode for Cursor (idempotent, safe to re-run)
  sync-models Refresh model list from cursor-agent
  models      Explain discovered Cursor model groups and variants
  status      Show current configuration state
  doctor      Diagnose common issues
  uninstall   Remove cursor-acp from OpenCode config
  help        Show this help message

Options:
  --config <path>       Path to opencode.json (default: OPENCODE_CONFIG or ~/.config/opencode/opencode.json)
  --plugin-dir <path>   Path to plugin directory (default: ~/.config/opencode/plugin)
  --base-url <url>      Proxy base URL (default: http://127.0.0.1:32124/v1)
  --copy                Copy plugin instead of symlink
  --skip-models         Skip model sync during install
  --install-cursor-bridge
                       Also write the optional .cursor bridge hook and rule
  --skip-cursor-bridge  Legacy no-op; .cursor bridge files are opt-in
  --cursor-bridge-scope <scope>
                       Cursor hook scope: project, user, or both; implies --install-cursor-bridge
  --variants            Generate compact OpenCode model variants from Cursor models
  --compact             With --variants, remove raw grouped Cursor model entries
  --dry-run             Preview sync/install config changes without writing files
  --deep                Run extra doctor checks for models and variant config
  --explain             Show model grouping explanation (models command)
  --no-backup           Don't create config backup
  --json                Output in JSON format where supported
`);
}
function parseArgs(argv) {
  const [commandRaw, ...rest] = argv;
  const command = normalizeCommand(commandRaw);
  const options = {};
  for (let i = 0;i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--copy") {
      options.copy = true;
    } else if (arg === "--skip-models") {
      options.skipModels = true;
    } else if (arg === "--install-cursor-bridge") {
      options.installCursorBridge = true;
    } else if (arg === "--skip-cursor-bridge") {
      options.skipCursorBridge = true;
    } else if (arg === "--cursor-bridge-scope" && rest[i + 1]) {
      options.cursorBridgeScope = parseCursorBridgeScope(rest[i + 1]);
      i += 1;
    } else if (arg === "--variants") {
      options.variants = true;
    } else if (arg === "--compact") {
      options.compact = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--deep") {
      options.deep = true;
    } else if (arg === "--explain") {
      options.explain = true;
    } else if (arg === "--no-backup") {
      options.noBackup = true;
    } else if (arg === "--config" && rest[i + 1]) {
      options.config = rest[i + 1];
      i += 1;
    } else if (arg === "--plugin-dir" && rest[i + 1]) {
      options.pluginDir = rest[i + 1];
      i += 1;
    } else if (arg === "--base-url" && rest[i + 1]) {
      options.baseUrl = rest[i + 1];
      i += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { command, options };
}
function parseCursorBridgeScope(value) {
  if (value === "project" || value === "user" || value === "both") {
    return value;
  }
  throw new Error(`Invalid --cursor-bridge-scope: ${value}`);
}
function normalizeCommand(value) {
  switch ((value || "help").toLowerCase()) {
    case "install":
    case "sync-models":
    case "models":
    case "uninstall":
    case "status":
    case "doctor":
    case "help":
      return value ? value.toLowerCase() : "help";
    default:
      throw new Error(`Unknown command: ${value}`);
  }
}
function getConfigHome() {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.length > 0)
    return xdg;
  return join5(homedir4(), ".config");
}
function resolvePaths(options) {
  const opencodeDir = join5(getConfigHome(), "opencode");
  const configPath = options.config ? resolve4(options.config) : resolveOpenCodeConfigPath();
  const pluginDir = resolve4(options.pluginDir || join5(opencodeDir, "plugin"));
  const pluginPath = join5(pluginDir, `${PROVIDER_ID}.js`);
  return { opencodeDir, configPath, pluginDir, pluginPath };
}
function resolvePluginSource() {
  const currentFile = fileURLToPath3(import.meta.url);
  const currentDir = dirname3(currentFile);
  const candidates = [
    join5(currentDir, "plugin-entry.js"),
    join5(currentDir, "..", "plugin-entry.js")
  ];
  for (const candidate of candidates) {
    if (existsSync6(candidate)) {
      return candidate;
    }
  }
  throw new Error("Unable to locate plugin-entry.js next to CLI distribution files");
}
function isErrnoException(error) {
  return typeof error === "object" && error !== null && "code" in error;
}
function readConfig(configPath) {
  if (!existsSync6(configPath)) {
    return { plugin: [], provider: {} };
  }
  let raw;
  try {
    raw = readFileSync2(configPath, "utf8");
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return { plugin: [], provider: {} };
    }
    throw error;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in config: ${configPath} (${String(error)})`);
  }
}
function writeConfig(configPath, config, noBackup, silent = false) {
  mkdirSync2(dirname3(configPath), { recursive: true });
  if (!noBackup && existsSync6(configPath)) {
    const backupPath = `${configPath}.bak.${new Date().toISOString().replace(/[:]/g, "-")}`;
    copyFileSync(configPath, backupPath);
    if (!silent) {
      console.log(`Backup written: ${backupPath}`);
    }
  }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}
`, "utf8");
}
function ensureProvider(config, baseUrl) {
  if (Array.isArray(config.plugin)) {
    config.plugin = config.plugin.filter((entry) => entry !== PROVIDER_ID);
    if (config.plugin.length === 0) {
      delete config.plugin;
    }
  }
  config.provider = config.provider && typeof config.provider === "object" ? config.provider : {};
  const current = config.provider[PROVIDER_ID] && typeof config.provider[PROVIDER_ID] === "object" ? config.provider[PROVIDER_ID] : {};
  const options = current.options && typeof current.options === "object" ? current.options : {};
  const models = current.models && typeof current.models === "object" ? current.models : {};
  config.provider[PROVIDER_ID] = {
    ...current,
    name: "Cursor",
    npm: "@ai-sdk/openai-compatible",
    options: {
      ...options,
      baseURL: baseUrl
    },
    models
  };
}
function ensurePluginLink(pluginSource, pluginPath, copyMode) {
  mkdirSync2(dirname3(pluginPath), { recursive: true });
  rmSync(pluginPath, { force: true });
  if (copyMode) {
    copyFileSync(pluginSource, pluginPath);
    return;
  }
  symlinkSync(pluginSource, pluginPath);
}
function discoverModelsSafe() {
  try {
    return discoverModelsFromCursorAgent();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: cursor-agent models failed; using fallback models (${message})`);
    return fallbackModels();
  }
}
function syncModelsIntoProvider(config, options) {
  if (options.compact && !options.variants) {
    throw new Error("--compact requires --variants");
  }
  const discoveredModels = discoverModelsSafe();
  const provider = config.provider[PROVIDER_ID];
  const existingModels = provider.models && typeof provider.models === "object" ? provider.models : {};
  const beforeModels = snapshotModels(existingModels);
  const result = mergeCursorModelEntries(existingModels, discoveredModels, {
    variants: options.variants === true,
    compact: options.compact === true
  });
  provider.models = result.models;
  return {
    syncedCount: result.syncedCount,
    groupedCount: result.groupedCount,
    removedCount: result.removedCount,
    summary: summarizeModelSync(beforeModels, result.models)
  };
}
function explainCursorModels(models) {
  const grouped = groupCursorModels(models);
  const groupedCount = grouped.groups.reduce((total, group) => total + group.members.length, 0);
  return {
    modelCount: models.length,
    groupedCount,
    directCount: grouped.direct.length,
    groups: grouped.groups.map((group) => ({
      id: group.baseId,
      name: group.name,
      defaultCursorModel: group.defaultCursorModelId,
      memberCount: group.members.length,
      variants: group.variants
    })),
    direct: grouped.direct.map((model) => model.id)
  };
}
function createSyncJsonResult(result, options, configPath) {
  return {
    ...result,
    configPath,
    dryRun: options.dryRun === true,
    variants: options.variants === true,
    compact: options.compact === true
  };
}
function snapshotModels(models) {
  return JSON.parse(JSON.stringify(models));
}
function summarizeModelSync(beforeModels, afterModels) {
  let added = 0;
  let updated = 0;
  let removed = 0;
  let skipped = 0;
  for (const [modelId, afterEntry] of Object.entries(afterModels)) {
    if (!Object.prototype.hasOwnProperty.call(beforeModels, modelId)) {
      added++;
      continue;
    }
    if (JSON.stringify(beforeModels[modelId]) === JSON.stringify(afterEntry)) {
      skipped++;
    } else {
      updated++;
    }
  }
  for (const modelId of Object.keys(beforeModels)) {
    if (!Object.prototype.hasOwnProperty.call(afterModels, modelId)) {
      removed++;
    }
  }
  return {
    added,
    updated,
    removed,
    priced: countPricedModelEntries(afterModels),
    skipped
  };
}
function countPricedModelEntries(models) {
  let priced = 0;
  for (const entry of Object.values(models)) {
    if (!isRecord2(entry))
      continue;
    if (isRecord2(entry.cost))
      priced++;
    if (!isRecord2(entry.variants))
      continue;
    for (const variantEntry of Object.values(entry.variants)) {
      if (isRecord2(variantEntry) && isRecord2(variantEntry.cost)) {
        priced++;
      }
    }
  }
  return priced;
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function installAiSdk(opencodeDir) {
  try {
    execFileSync2("bun", ["install", "@ai-sdk/openai-compatible"], {
      cwd: opencodeDir,
      stdio: "inherit"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: failed to install @ai-sdk/openai-compatible via bun (${message})`);
  }
}
var CURSOR_BRIDGE_HOOK_COMMAND = "node .cursor/hooks/opencode-bridge-context.mjs";
var CURSOR_BRIDGE_USER_HOOK_COMMAND = "node ./hooks/opencode-bridge-context.mjs";
var CURSOR_BRIDGE_RULE_CONTENT = `---
description: opencode-cursor bridge instructions for cursor-agent.
alwaysApply: true
---

# opencode-cursor bridge

When opencode-cursor provides active bridge instructions for a complete-file write, prefer returning the requested bridge JSON if you can produce the full file content in one response. If you use a normal tool call instead, use the available tool schema exactly and do not retry invalid schemas.
`;
function ensureCursorBridgeHook(rootDir, options = {}) {
  const scope = options.scope ?? "project";
  const cursorDir = join5(rootDir, ".cursor");
  const hooksDir = join5(cursorDir, "hooks");
  const rulesDir = join5(cursorDir, "rules");
  const hooksPath = join5(cursorDir, "hooks.json");
  const scriptPath = join5(hooksDir, "opencode-bridge-context.mjs");
  const rulePath = join5(rulesDir, "opencode-bridge.mdc");
  const script = buildCursorBridgeHookScript();
  const current = readCursorHooksConfig(hooksPath);
  const next = mergeCursorBridgeHook(current, scope);
  const currentJson = JSON.stringify(current);
  const nextJson = JSON.stringify(next);
  const scriptChanged = !existsSync6(scriptPath) || readFileSync2(scriptPath, "utf8") !== script;
  const ruleChanged = !existsSync6(rulePath) || readFileSync2(rulePath, "utf8") !== CURSOR_BRIDGE_RULE_CONTENT;
  const changed = currentJson !== nextJson || scriptChanged || ruleChanged;
  if (!options.dryRun && changed) {
    mkdirSync2(hooksDir, { recursive: true });
    mkdirSync2(rulesDir, { recursive: true });
    writeFileSync(scriptPath, script, "utf8");
    writeFileSync(rulePath, CURSOR_BRIDGE_RULE_CONTENT, "utf8");
    writeFileSync(hooksPath, `${JSON.stringify(next, null, 2)}
`, "utf8");
  }
  return { changed, hooksPath, scriptPath, rulePath };
}
function removeCursorBridgeHook(rootDir, options = {}) {
  const scope = options.scope ?? "project";
  const cursorDir = join5(rootDir, ".cursor");
  const hooksPath = join5(cursorDir, "hooks.json");
  const scriptPath = join5(cursorDir, "hooks", "opencode-bridge-context.mjs");
  const rulePath = join5(cursorDir, "rules", "opencode-bridge.mdc");
  const current = readCursorHooksConfig(hooksPath);
  const next = removeCursorBridgeHookEntry(current, scope);
  const changed = JSON.stringify(current) !== JSON.stringify(next) || existsSync6(scriptPath) || existsSync6(rulePath);
  rmSync(scriptPath, { force: true });
  rmSync(rulePath, { force: true });
  if (existsSync6(hooksPath)) {
    writeFileSync(hooksPath, `${JSON.stringify(next, null, 2)}
`, "utf8");
  }
  return { changed, hooksPath, scriptPath, rulePath };
}
function buildCursorBridgeHookScript() {
  return [
    "#!/usr/bin/env node",
    `const context = ${JSON.stringify(BRIDGE_JSON_CONTEXT)};`,
    'process.stdout.write(JSON.stringify({ additional_context: context }) + "\\n");',
    ""
  ].join(`
`);
}
function readCursorHooksConfig(hooksPath) {
  if (!existsSync6(hooksPath)) {
    return { version: 1, hooks: {} };
  }
  const raw = readFileSync2(hooksPath, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { version: 1, hooks: {} };
  } catch (error) {
    throw new Error(`Invalid JSON in Cursor hooks config: ${hooksPath} (${String(error)})`);
  }
}
function mergeCursorBridgeHook(config, scope) {
  const next = {
    ...config,
    version: typeof config.version === "number" ? config.version : 1,
    hooks: config.hooks && typeof config.hooks === "object" && !Array.isArray(config.hooks) ? { ...config.hooks } : {}
  };
  const sessionStart = Array.isArray(next.hooks.sessionStart) ? [...next.hooks.sessionStart] : [];
  const command = scope === "user" ? CURSOR_BRIDGE_USER_HOOK_COMMAND : CURSOR_BRIDGE_HOOK_COMMAND;
  if (!sessionStart.some((hook) => hook?.command === command)) {
    sessionStart.push({ command });
  }
  next.hooks.sessionStart = sessionStart;
  return next;
}
function removeCursorBridgeHookEntry(config, scope) {
  const next = {
    ...config,
    hooks: config.hooks && typeof config.hooks === "object" && !Array.isArray(config.hooks) ? { ...config.hooks } : {}
  };
  const command = scope === "user" ? CURSOR_BRIDGE_USER_HOOK_COMMAND : CURSOR_BRIDGE_HOOK_COMMAND;
  if (Array.isArray(next.hooks.sessionStart)) {
    next.hooks.sessionStart = next.hooks.sessionStart.filter((hook) => hook?.command !== command);
  }
  return next;
}
function getCursorBridgeRoots(scope) {
  const requested = scope ?? "project";
  if (requested === "user") {
    return [{ label: "user", root: homedir4(), scope: "user" }];
  }
  if (requested === "both") {
    return [
      { label: "project", root: process.cwd(), scope: "project" },
      { label: "user", root: homedir4(), scope: "user" }
    ];
  }
  return [{ label: "project", root: process.cwd(), scope: "project" }];
}
function shouldInstallCursorBridge(options) {
  if (options.skipCursorBridge) {
    return false;
  }
  return options.installCursorBridge === true || options.cursorBridgeScope !== undefined;
}
function commandInstall(options) {
  const { opencodeDir, configPath, pluginPath } = resolvePaths(options);
  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  const copyMode = options.copy === true;
  const pluginSource = resolvePluginSource();
  if (!options.dryRun) {
    mkdirSync2(opencodeDir, { recursive: true });
    ensurePluginLink(pluginSource, pluginPath, copyMode);
  }
  const config = readConfig(configPath);
  ensureProvider(config, baseUrl);
  if (!options.skipModels) {
    const result = syncModelsIntoProvider(config, options);
    printSyncResult(result, options);
  }
  if (options.dryRun) {
    console.log("Dry run: no files changed.");
  } else {
    writeConfig(configPath, config, options.noBackup === true);
    installAiSdk(opencodeDir);
  }
  if (shouldInstallCursorBridge(options)) {
    for (const target of getCursorBridgeRoots(options.cursorBridgeScope)) {
      const bridge = ensureCursorBridgeHook(target.root, {
        dryRun: options.dryRun,
        scope: target.scope
      });
      console.log(`${options.dryRun ? "Would write" : "Cursor bridge hook"} (${target.label}): ${bridge.hooksPath}`);
      console.log(`${options.dryRun ? "Would write" : "Cursor bridge rule"} (${target.label}): ${bridge.rulePath}`);
    }
  } else {
    console.log("Cursor bridge hook and rule: not installed (.cursor files are opt-in)");
  }
  console.log(`${options.dryRun ? "Would install" : "Installed"} ${PROVIDER_ID}`);
  console.log(`Plugin path: ${pluginPath}${copyMode ? " (copy)" : " (symlink)"}`);
  console.log(`Config path: ${configPath}`);
}
function commandSyncModels(options) {
  const { configPath } = resolvePaths(options);
  const config = readConfig(configPath);
  ensureProvider(config, options.baseUrl || DEFAULT_BASE_URL);
  const result = syncModelsIntoProvider(config, options);
  if (!options.dryRun) {
    writeConfig(configPath, config, options.noBackup === true, options.json === true);
  }
  if (options.json) {
    console.log(JSON.stringify(createSyncJsonResult(result, options, configPath), null, 2));
    return;
  }
  printSyncResult(result, options);
  if (options.dryRun) {
    console.log("Dry run: no changes written.");
  }
  console.log(`Config path: ${configPath}`);
}
function commandModels(options) {
  const models = discoverModelsSafe();
  const explanation = explainCursorModels(models);
  if (options.json) {
    console.log(JSON.stringify(explanation, null, 2));
    return;
  }
  console.log(`Cursor models discovered: ${explanation.modelCount}`);
  console.log(`Grouped Cursor models: ${explanation.groupedCount}`);
  console.log(`Direct models: ${explanation.directCount}`);
  if (!options.explain) {
    return;
  }
  console.log("");
  console.log("Model groups:");
  for (const group of explanation.groups) {
    console.log(`  ${group.id}`);
    console.log(`    Default: ${group.defaultCursorModel}`);
    const variants = Object.entries(group.variants);
    if (variants.length === 0) {
      console.log("    Variants: none");
      continue;
    }
    console.log("    Variants:");
    for (const [variant, cursorModel] of variants) {
      console.log(`      ${variant}: ${cursorModel}`);
    }
  }
  console.log("");
  console.log("Direct models:");
  for (const modelId of explanation.direct) {
    console.log(`  ${modelId}`);
  }
}
function printSyncResult(result, options) {
  console.log(`Models synced: ${result.syncedCount}`);
  if (options.variants) {
    console.log(`Grouped Cursor models: ${result.groupedCount}`);
  }
  if (result.removedCount > 0) {
    console.log(`Raw grouped models removed: ${result.removedCount}`);
  }
  console.log("Sync summary:");
  console.log(`  Added: ${result.summary.added}`);
  console.log(`  Updated: ${result.summary.updated}`);
  console.log(`  Removed: ${result.summary.removed}`);
  console.log(`  Priced: ${result.summary.priced}`);
  console.log(`  Skipped: ${result.summary.skipped}`);
}
var NPM_PACKAGE = "@rama_nigg/open-cursor";
function commandUninstall(options) {
  const { configPath, pluginPath } = resolvePaths(options);
  rmSync(pluginPath, { force: true });
  if (existsSync6(configPath)) {
    const config = readConfig(configPath);
    if (Array.isArray(config.plugin)) {
      config.plugin = config.plugin.filter((name) => {
        if (name === PROVIDER_ID)
          return false;
        if (typeof name === "string" && name.startsWith(NPM_PACKAGE))
          return false;
        return true;
      });
    }
    if (config.provider && typeof config.provider === "object") {
      delete config.provider[PROVIDER_ID];
    }
    writeConfig(configPath, config, options.noBackup === true);
  }
  console.log(`Removed plugin link: ${pluginPath}`);
  console.log(`Removed provider "${PROVIDER_ID}" from ${configPath}`);
  for (const target of getCursorBridgeRoots(options.cursorBridgeScope)) {
    const bridge = removeCursorBridgeHook(target.root, { scope: target.scope });
    if (bridge.changed) {
      console.log(`Removed Cursor bridge hook (${target.label}): ${bridge.hooksPath}`);
      console.log(`Removed Cursor bridge rule (${target.label}): ${bridge.rulePath}`);
    }
  }
}
function getStatusResult(configPath, pluginPath) {
  let pluginType = "missing";
  let pluginTarget;
  if (existsSync6(pluginPath)) {
    try {
      const stat = lstatSync(pluginPath);
      pluginType = stat.isSymbolicLink() ? "symlink" : "file";
      if (pluginType === "symlink") {
        try {
          pluginTarget = readFileSync2(pluginPath, "utf8");
        } catch {
          pluginTarget = undefined;
        }
      }
    } catch (error) {
      if (!isErrnoException(error) || error.code !== "ENOENT") {
        throw error;
      }
      pluginType = "missing";
      pluginTarget = undefined;
    }
  }
  let config;
  let providerEnabled = false;
  let baseUrl = "http://127.0.0.1:32124/v1";
  let modelCount = 0;
  if (existsSync6(configPath)) {
    config = readConfig(configPath);
    const provider = config.provider?.["cursor-acp"];
    providerEnabled = !!provider;
    if (provider?.options?.baseURL) {
      baseUrl = provider.options.baseURL;
    }
    modelCount = Object.keys(provider?.models || {}).length;
  } else {
    config = undefined;
  }
  const opencodeDir = dirname3(configPath);
  const sdkPath = join5(opencodeDir, "node_modules", "@ai-sdk", "openai-compatible");
  const aiSdkInstalled = existsSync6(sdkPath);
  const sdkApiKeySource = resolveCliSdkAuthSource(config);
  const legacyCursorAuthFile = getPossibleAuthPaths().some((authPath) => existsSync6(authPath));
  let installMethod = "none";
  if (pluginType !== "missing") {
    installMethod = "symlink";
  } else if (isNpmDirectInstalled(config)) {
    installMethod = "npm-direct";
  }
  return {
    installMethod,
    plugin: {
      path: pluginPath,
      type: pluginType,
      target: pluginTarget
    },
    provider: {
      configPath,
      name: "cursor-acp",
      enabled: providerEnabled,
      baseUrl,
      modelCount
    },
    aiSdk: {
      installed: aiSdkInstalled
    },
    auth: {
      legacyCursorAuthFile,
      sdkApiKey: sdkApiKeySource !== undefined,
      sdkApiKeySource
    },
    runtime: getRuntimeStatus()
  };
}
function runDeepDoctorChecks(configPath) {
  const checks = [];
  let config;
  try {
    config = readConfig(configPath);
  } catch (error) {
    return [{
      name: "Deep config read",
      passed: false,
      message: error instanceof Error ? error.message : String(error)
    }];
  }
  const provider = config.provider?.[PROVIDER_ID];
  const models = isRecord2(provider?.models) ? provider.models : {};
  const baseUrl = typeof provider?.options?.baseURL === "string" ? provider.options.baseURL : "";
  checks.push({
    name: "Provider base URL",
    passed: baseUrl.startsWith("http://") || baseUrl.startsWith("https://"),
    message: baseUrl || "missing - run: open-cursor install"
  });
  checks.push({
    name: "Provider models",
    passed: Object.keys(models).length > 0,
    message: `${Object.keys(models).length} configured model(s)`
  });
  const variantEntryCount = countVariantModelEntries(models);
  checks.push({
    name: "Compact variants",
    passed: variantEntryCount > 0,
    warning: variantEntryCount === 0,
    message: variantEntryCount > 0 ? `${variantEntryCount} model entr${variantEntryCount === 1 ? "y" : "ies"} with variants` : "no compact variants found - run: open-cursor sync-models --variants --compact"
  });
  let discoveredModels;
  try {
    discoveredModels = discoverModelsFromCursorAgent();
    checks.push({
      name: "Cursor model discovery",
      passed: true,
      message: `${discoveredModels.length} model(s) from cursor-agent`
    });
  } catch (error) {
    checks.push({
      name: "Cursor model discovery",
      passed: false,
      message: error instanceof Error ? error.message : String(error),
      warning: true
    });
    return checks;
  }
  const knownModelIds = new Set(discoveredModels.map((model) => model.id));
  const unknownTargets = collectConfiguredCursorModels(models).filter((modelId) => !knownModelIds.has(modelId));
  checks.push({
    name: "Configured Cursor model targets",
    passed: unknownTargets.length === 0,
    warning: unknownTargets.length > 0,
    message: unknownTargets.length === 0 ? "all configured targets exist in cursor-agent models" : `${unknownTargets.length} target(s) not found: ${unknownTargets.slice(0, 5).join(", ")}`
  });
  return checks;
}
function countVariantModelEntries(models) {
  return Object.values(models).filter((entry) => {
    return isRecord2(entry) && isRecord2(entry.variants) && Object.keys(entry.variants).length > 0;
  }).length;
}
function collectConfiguredCursorModels(models) {
  const targets = [];
  for (const [modelId, entry] of Object.entries(models)) {
    if (!isRecord2(entry)) {
      targets.push(modelId);
      continue;
    }
    const optionTarget = readCursorModel(entry.options);
    targets.push(optionTarget || modelId);
    if (!isRecord2(entry.variants))
      continue;
    for (const variantEntry of Object.values(entry.variants)) {
      const variantTarget = readCursorModel(variantEntry);
      if (variantTarget)
        targets.push(variantTarget);
    }
  }
  return [...new Set(targets)];
}
function readCursorModel(value) {
  if (!isRecord2(value))
    return;
  const cursorModel = value.cursorModel;
  return typeof cursorModel === "string" && cursorModel.trim().length > 0 ? cursorModel.trim() : undefined;
}
function commandStatus(options) {
  const { configPath, pluginPath } = resolvePaths(options);
  const result = getStatusResult(configPath, pluginPath);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log("");
  console.log("Plugin");
  console.log(`  Path: ${result.plugin.path}`);
  if (result.plugin.type === "symlink" && result.plugin.target) {
    console.log(`  Type: symlink → ${result.plugin.target}`);
  } else if (result.plugin.type === "file") {
    console.log(`  Type: file (copy)`);
  } else {
    console.log(`  Type: missing`);
  }
  console.log(`  Install method: ${result.installMethod}`);
  console.log("");
  console.log("Provider");
  console.log(`  Config: ${result.provider.configPath}`);
  console.log(`  Name: ${result.provider.name}`);
  console.log(`  Enabled: ${result.provider.enabled ? "yes" : "no"}`);
  console.log(`  Base URL: ${result.provider.baseUrl}`);
  console.log(`  Models: ${result.provider.modelCount}`);
  console.log("");
  console.log("AI SDK");
  console.log(`  @ai-sdk/openai-compatible: ${result.aiSdk.installed ? "installed" : "not installed"}`);
  console.log("");
  console.log("Authentication");
  console.log(`  Legacy cursor-agent auth file: ${result.auth.legacyCursorAuthFile ? "found" : "not found"}`);
  console.log(`  Cursor SDK API key: ${result.auth.sdkApiKey ? `found via ${result.auth.sdkApiKeySource}` : "not configured"}`);
  console.log("");
  console.log("Runtime");
  console.log(`  Backend preference: ${result.runtime.backend.preference}`);
  console.log(`  Agent pool: ${result.runtime.agentPool.enabled ? "enabled" : "disabled"}`);
  console.log(`  Agent pool idle: ${result.runtime.agentPool.idleMs}ms`);
  console.log(`  Session resume: ${result.runtime.sessionResume.enabled ? "enabled" : "disabled"}`);
  console.log(`  Log level: ${result.runtime.logging.level}`);
  console.log(`  Console logging: ${result.runtime.logging.console ? "enabled" : "disabled"}`);
  console.log(`  Log dir: ${result.runtime.logging.dir}`);
}
function commandDoctor(options) {
  const { configPath, pluginPath } = resolvePaths(options);
  const checks = [
    ...runDoctorChecks(configPath, pluginPath),
    ...options.deep ? runDeepDoctorChecks(configPath) : []
  ];
  if (options.json) {
    const failed2 = checks.filter((c) => !c.passed && !c.warning);
    console.log(JSON.stringify({ deep: options.deep === true, checks, failed: failed2.length }, null, 2));
    return;
  }
  console.log("");
  for (const check of checks) {
    const symbol = check.passed ? "✓" : check.warning ? "⚠" : "✗";
    const color = check.passed ? "\x1B[32m" : check.warning ? "\x1B[33m" : "\x1B[31m";
    console.log(` ${color}${symbol}\x1B[0m ${check.name}: ${check.message}`);
  }
  const failed = checks.filter((c) => !c.passed && !c.warning);
  console.log("");
  if (failed.length === 0) {
    console.log("All checks passed!");
  } else {
    console.log(`${failed.length} check(s) failed. See messages above.`);
  }
}
function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    printHelp();
    process.exit(1);
    return;
  }
  try {
    switch (parsed.command) {
      case "install":
        commandInstall(parsed.options);
        return;
      case "sync-models":
        commandSyncModels(parsed.options);
        return;
      case "models":
        commandModels(parsed.options);
        return;
      case "uninstall":
        commandUninstall(parsed.options);
        return;
      case "status":
        commandStatus(parsed.options);
        return;
      case "doctor":
        commandDoctor(parsed.options);
        return;
      case "help":
        printHelp();
        return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
function resolveEntrypointArg(argvPath) {
  if (!argvPath)
    return "";
  return resolve4(argvPath);
}
function toRealPath(path2) {
  try {
    return realpathSync(path2);
  } catch {
    return path2;
  }
}
function isCliEntrypoint(metaUrl, argvPath) {
  const currentPath = fileURLToPath3(metaUrl);
  const argvResolved = resolveEntrypointArg(argvPath);
  if (!argvResolved)
    return false;
  return currentPath === argvResolved || toRealPath(currentPath) === toRealPath(argvResolved);
}
if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  main();
}
export {
  summarizeModelSync,
  shouldInstallCursorBridge,
  runDoctorChecks,
  runDeepDoctorChecks,
  resolvePaths,
  isCliEntrypoint,
  getStatusResult,
  getBrandingHeader,
  explainCursorModels,
  ensureCursorBridgeHook,
  checkCursorAgentLogin,
  checkCursorAgent,
  checkBun,
  CURSOR_BRIDGE_USER_HOOK_COMMAND,
  CURSOR_BRIDGE_HOOK_COMMAND
};
