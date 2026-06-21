import { buildRunSummary, compareOutput, hasObviousInfiniteLoop } from "./runner-utils.js";

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";

let runtimePromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      if (globalThis.loadPyodide) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Pyodide 加载失败，请检查网络后重试。"));
    document.head.append(script);
  });
}

export async function loadPythonRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      await loadScript(PYODIDE_URL);
      return globalThis.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
      });
    })();
  }
  return runtimePromise;
}

function buildWrappedCode(code) {
  return `
import builtins, contextlib, io, traceback

def __codex_run(user_code, stdin_text):
    stdin_lines = stdin_text.splitlines()
    stdin_index = 0

    def fake_input(prompt=""):
        nonlocal stdin_index
        if stdin_index >= len(stdin_lines):
            raise EOFError("No more input")
        value = stdin_lines[stdin_index]
        stdin_index += 1
        return value

    old_input = builtins.input
    builtins.input = fake_input
    stdout = io.StringIO()
    namespace = {"__name__": "__main__"}
    try:
        with contextlib.redirect_stdout(stdout):
            exec(user_code, namespace, namespace)
        return {"ok": True, "stdout": stdout.getvalue(), "error": ""}
    except Exception:
        return {"ok": False, "stdout": stdout.getvalue(), "error": traceback.format_exc()}
    finally:
        builtins.input = old_input
`;
}

export async function runPythonWithInput(pyodide, code, stdin) {
  if (hasObviousInfiniteLoop(code)) {
    return {
      ok: false,
      stdout: "",
      error: "检测到 while True:，为避免浏览器卡住，请改成带退出条件的循环后再运行。",
    };
  }
  pyodide.runPython(buildWrappedCode(code));
  const result = pyodide.globals.get("__codex_run")(code, stdin ?? "");
  const converted = result.toJs ? result.toJs({ dict_converter: Object.fromEntries }) : result;
  if (result.destroy) result.destroy();
  return converted;
}

async function runOne(pyodide, code, item, group, index) {
  const execution = await runPythonWithInput(pyodide, code, item.stdin);
  const passed = execution.ok && compareOutput(execution.stdout, item.expectedStdout);
  return {
    group,
    index,
    passed,
    stdin: item.stdin,
    expectedStdout: group === "sample" ? item.expectedStdout : "",
    actualStdout: group === "sample" ? execution.stdout : "",
    error: execution.error,
  };
}

export async function runPythonQuestion(question, code) {
  const pyodide = await loadPythonRuntime();
  const results = [];
  for (const [index, item] of question.sampleTests.entries()) {
    results.push(await runOne(pyodide, code, item, "sample", index));
  }
  for (const [index, item] of question.hiddenTests.entries()) {
    results.push(await runOne(pyodide, code, item, "hidden", index));
  }
  return { results, summary: buildRunSummary(results) };
}

export async function runCustomPython(code, stdin) {
  const pyodide = await loadPythonRuntime();
  return runPythonWithInput(pyodide, code, stdin);
}
