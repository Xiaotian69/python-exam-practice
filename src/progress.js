const VALID_STATUSES = new Set(["mastered", "redo", "uncertain"]);

function cloneState(state) {
  return JSON.parse(JSON.stringify(state || {}));
}

function ensureEntry(state, questionId) {
  if (!state[questionId]) {
    state[questionId] = { hintsOpened: [], answerOpened: false };
  }
  if (!Array.isArray(state[questionId].hintsOpened)) {
    state[questionId].hintsOpened = [];
  }
  if (typeof state[questionId].answerOpened !== "boolean") {
    state[questionId].answerOpened = false;
  }
  return state[questionId];
}

export function recordHintOpen(state, questionId, hintIndex) {
  const next = cloneState(state);
  const entry = ensureEntry(next, questionId);
  if (!entry.hintsOpened.includes(hintIndex)) {
    entry.hintsOpened.push(hintIndex);
    entry.hintsOpened.sort((a, b) => a - b);
  }
  return next;
}

export function recordAnswerOpen(state, questionId) {
  const next = cloneState(state);
  const entry = ensureEntry(next, questionId);
  entry.answerOpened = true;
  return next;
}

export function markQuestion(state, questionId, status) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Unsupported question status: ${status}`);
  }
  const next = cloneState(state);
  const entry = ensureEntry(next, questionId);
  entry.status = status;
  return next;
}

export function recordChoice(state, questionId, optionId) {
  const next = cloneState(state);
  const entry = ensureEntry(next, questionId);
  entry.selectedOption = optionId;
  return next;
}

export function createProgressStore(storage, key = "python-practice-progress") {
  let state = {};

  try {
    const raw = storage?.getItem(key);
    state = raw ? JSON.parse(raw) : {};
  } catch {
    state = {};
  }

  function persist(next) {
    state = next;
    storage?.setItem(key, JSON.stringify(state));
    return state;
  }

  return {
    getState() {
      return cloneState(state);
    },
    markQuestion(questionId, status) {
      return persist(markQuestion(state, questionId, status));
    },
    recordHintOpen(questionId, hintIndex) {
      return persist(recordHintOpen(state, questionId, hintIndex));
    },
    recordAnswerOpen(questionId) {
      return persist(recordAnswerOpen(state, questionId));
    },
    recordChoice(questionId, optionId) {
      return persist(recordChoice(state, questionId, optionId));
    },
  };
}
