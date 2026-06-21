export function normalizeOutput(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trimEnd();
}

export function compareOutput(actual, expected) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

export function buildRunSummary(results) {
  const summary = {
    sample: { total: 0, passed: 0 },
    hidden: { total: 0, passed: 0 },
    allPassed: true,
  };

  for (const result of results) {
    const group = result.group === "hidden" ? "hidden" : "sample";
    summary[group].total += 1;
    if (result.passed) {
      summary[group].passed += 1;
    } else {
      summary.allPassed = false;
    }
  }

  return summary;
}

export function hasObviousInfiniteLoop(code) {
  return /while\s+True\s*:/u.test(String(code ?? ""));
}
