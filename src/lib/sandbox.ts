"use client";

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface RunResult {
  output: string;
  results: TestResult[];
  error?: string;
  timedOut?: boolean;
}

export interface FakeConsole {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

/**
 * Runs user code in a fresh function scope and returns an evaluator that can
 * eval test expressions against the declarations the code made. Self-contained
 * so it can be serialized into the Web Worker blob AND unit-tested in node.
 */
/**
 * Minimal React stub injected into the sandbox scope so challenges can use
 * React.createElement without a bundler or real React. Elements are plain
 * objects: { type, props: { ...props, children } }.
 */
const REACT_STUB = `
var React = {
  createElement: function (type, props) {
    var kids = Array.prototype.slice.call(arguments, 2);
    var children =
      kids.length === 0 ? undefined : kids.length === 1 ? kids[0] : kids;
    return { type: type, props: Object.assign({}, props, { children: children }) };
  },
};
`;

export function scopedEvaluate(
  code: string,
  fakeConsole: FakeConsole
): (expr: string) => unknown {
  const factory = new Function(
    "console",
    REACT_STUB +
      "\n" +
      code +
      "\n;return function __eval(expr){ return eval(expr); };"
  );
  return factory(fakeConsole) as (expr: string) => unknown;
}

export const WORKER_SOURCE = `
var REACT_STUB = ${JSON.stringify(REACT_STUB)};
var scopedEvaluate = ${scopedEvaluate.toString()};

self.onmessage = function (e) {
  var code = e.data.code;
  var tests = e.data.tests;
  var output = [];
  var fmt = function (a) {
    if (typeof a === "string") return a;
    try { return JSON.stringify(a); } catch (_) { return String(a); }
  };
  var push = function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) parts.push(fmt(arguments[i]));
    output.push(parts.join(" "));
  };
  var fakeConsole = { log: push, info: push, warn: push, error: push, debug: push };

  var evaluate = null;
  var error = null;
  try {
    evaluate = scopedEvaluate(code, fakeConsole);
  } catch (err) {
    error = String((err && err.message) || err);
  }

  var results = tests.map(function (t) {
    if (!evaluate) return { name: t.name, passed: false, error: "Code failed to run" };
    try {
      return { name: t.name, passed: !!evaluate(t.expression) };
    } catch (err) {
      return { name: t.name, passed: false, error: String((err && err.message) || err) };
    }
  });

  self.postMessage({ output: output.join("\\n"), results: results, error: error });
};
`;

/**
 * Runs JavaScript/TypeScript-ish code in a throwaway Web Worker with a
 * captured console, then evaluates each test expression in the same scope.
 * Terminates the worker on timeout.
 */
export function runInSandbox(
  code: string,
  tests: { name: string; expression: string }[],
  timeoutMs = 5000
): Promise<RunResult> {
  return new Promise((resolve) => {
    let url: string;
    let worker: Worker;
    try {
      url = URL.createObjectURL(
        new Blob([WORKER_SOURCE], { type: "application/javascript" })
      );
      worker = new Worker(url);
    } catch (err) {
      resolve({ output: "", results: [], error: `Sandbox unavailable: ${err}` });
      return;
    }

    const timer = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({
        output: "",
        results: tests.map((t) => ({
          name: t.name,
          passed: false,
          error: "Timed out",
        })),
        timedOut: true,
        error: `Execution timed out after ${timeoutMs / 1000}s`,
      });
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent<RunResult>) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(e.data);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ output: "", results: [], error: e.message || "Worker error" });
    };
    worker.postMessage({ code, tests });
  });
}
