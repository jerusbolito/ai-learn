import { describe, expect, it } from "vitest";
import { WORKER_SOURCE } from "./sandbox";

// Executes the real WORKER_SOURCE in a fresh function scope the way the
// browser's blob worker does — catches free variables that scopedEvaluate
// closes over but which are never serialized into the worker (e.g. the
// "REACT_STUB is not defined" bug).

interface WorkerResult {
  output: string;
  results: { name: string; passed: boolean; error?: string }[];
  error: string | null;
}

function runWorker(
  code: string,
  tests: { name: string; expression: string }[]
): WorkerResult {
  let posted: WorkerResult | undefined;
  const selfObj = {
    postMessage: (msg: WorkerResult) => {
      posted = msg;
    },
  };
  new Function(
    "self",
    WORKER_SOURCE +
      "\n;self.__fire = function (m) { self.onmessage({ data: m }); };"
  )(selfObj);
  (selfObj as Record<string, (m: unknown) => void>).__fire({ code, tests });
  return posted as WorkerResult;
}

describe("WORKER_SOURCE", () => {
  it("runs React.createElement challenges in the serialized worker", () => {
    const res = runWorker(
      `function makeHeading() { return React.createElement("h1", null, "Hello World"); }`,
      [
        {
          name: "Function returns a React element for h1",
          expression: `var el = makeHeading(); el && el.type === "h1"`,
        },
        {
          name: "Element has correct text content",
          expression: `makeHeading().props.children === "Hello World"`,
        },
      ]
    );
    expect(res.error).toBeNull();
    expect(res.results).toEqual([
      { name: "Function returns a React element for h1", passed: true },
      { name: "Element has correct text content", passed: true },
    ]);
  });
});
