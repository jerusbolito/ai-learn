import { describe, expect, it } from "vitest";
import { scopedEvaluate } from "./sandbox";

const fakeConsole = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

describe("scopedEvaluate", () => {
  it("evaluates test expressions against declared functions", () => {
    const evaluate = scopedEvaluate(
      "function add(a, b) { return a + b; }",
      fakeConsole
    );
    expect(evaluate("add(2, 3) === 5")).toBe(true);
    expect(evaluate("add(2, 3) === 6")).toBe(false);
  });

  it("sees const/let/var declarations too", () => {
    const evaluate = scopedEvaluate(
      "const x = 10; let y = 20; var z = x + y;",
      fakeConsole
    );
    expect(evaluate("z === 30")).toBe(true);
  });

  it("throws on expressions referencing missing identifiers", () => {
    const evaluate = scopedEvaluate("const a = 1;", fakeConsole);
    expect(() => evaluate("missing()")).toThrow();
    // guarded typeof checks short-circuit cleanly to false
    expect(evaluate("typeof missing === 'function' && missing()")).toBe(false);
  });

  it("propagates console to user code", () => {
    const logged: string[] = [];
    scopedEvaluate("console.log('hello', 42)", {
      ...fakeConsole,
      log: (...a: unknown[]) => logged.push(a.join(" ")),
    });
    expect(logged).toEqual(["hello 42"]);
  });

  it("throws when user code is invalid", () => {
    expect(() => scopedEvaluate("function {", fakeConsole)).toThrow();
  });
});
