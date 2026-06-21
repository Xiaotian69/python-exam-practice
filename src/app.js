import { createProgressStore } from "./progress.js";
import {
  buildStudyGuide,
  checkBlankAnswers,
  collectConcepts,
  filterQuestions,
  getExpandableSections,
  getQuestionById,
  summarizeProgress,
} from "./questions.js";
import { runCustomPython, runPythonQuestion } from "./runner.js";
import { normalizeOutput } from "./runner-utils.js";

const state = {
  questions: [],
  sources: [],
  activeId: null,
  filters: {
    course: "all",
    concept: "all",
    difficulty: "all",
    mode: "all",
    status: "all",
    query: "",
  },
};

const progressStore = createProgressStore(globalThis.localStorage);

const els = {
  runtimeStatus: document.querySelector("#runtimeStatus"),
  progressSummary: document.querySelector("#progressSummary"),
  questionCount: document.querySelector("#questionCount"),
  questionList: document.querySelector("#questionList"),
  courseFilter: document.querySelector("#courseFilter"),
  conceptFilter: document.querySelector("#conceptFilter"),
  difficultyFilter: document.querySelector("#difficultyFilter"),
  modeFilter: document.querySelector("#modeFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  searchInput: document.querySelector("#searchInput"),
  resetFilters: document.querySelector("#resetFilters"),
  questionMeta: document.querySelector("#questionMeta"),
  questionTitle: document.querySelector("#questionTitle"),
  questionStem: document.querySelector("#questionStem"),
  conceptTags: document.querySelector("#conceptTags"),
  studyPanel: document.querySelector("#studyPanel"),
  studyLabel: document.querySelector("#studyLabel"),
  studyHeading: document.querySelector("#studyHeading"),
  studyCue: document.querySelector("#studyCue"),
  studyPoints: document.querySelector("#studyPoints"),
  theorySection: document.querySelector("#theorySection"),
  theoryOptions: document.querySelector("#theoryOptions"),
  theoryFeedback: document.querySelector("#theoryFeedback"),
  fillBlankSection: document.querySelector("#fillBlankSection"),
  blankInputs: document.querySelector("#blankInputs"),
  checkBlanks: document.querySelector("#checkBlanks"),
  blankFeedback: document.querySelector("#blankFeedback"),
  hintPanel: document.querySelector("#hintPanel"),
  hintLabel: document.querySelector("#hintLabel"),
  hintHeading: document.querySelector("#hintHeading"),
  hintSummary: document.querySelector("#hintSummary"),
  hintList: document.querySelector("#hintList"),
  answerPanel: document.querySelector("#answerPanel"),
  answerLabel: document.querySelector("#answerLabel"),
  answerHeading: document.querySelector("#answerHeading"),
  answerSummary: document.querySelector("#answerSummary"),
  revealAnswer: document.querySelector("#revealAnswer"),
  answerBlock: document.querySelector("#answerBlock"),
  sourcePanel: document.querySelector("#sourcePanel"),
  sourceLabel: document.querySelector("#sourceLabel"),
  sourceHeading: document.querySelector("#sourceHeading"),
  sourceSummary: document.querySelector("#sourceSummary"),
  sourceInfo: document.querySelector("#sourceInfo"),
  codeEditor: document.querySelector("#codeEditor"),
  codePanel: document.querySelector("#codePanel"),
  workspaceMain: document.querySelector(".workspace__main"),
  customInput: document.querySelector("#customInput"),
  resetCode: document.querySelector("#resetCode"),
  runCode: document.querySelector("#runCode"),
  runCustom: document.querySelector("#runCustom"),
  runSummary: document.querySelector("#runSummary"),
  resultsList: document.querySelector("#resultsList"),
  confirmDialog: document.querySelector("#confirmDialog"),
  cancelReveal: document.querySelector("#cancelReveal"),
  confirmReveal: document.querySelector("#confirmReveal"),
};

function courseName(course) {
  return course === "python2" ? "Python II" : "Python I";
}

function sourceLabel(source) {
  if (!source) return "未知来源";
  const typeMap = {
    paper: "试卷",
    scoring_reference: "评分参照",
    score_distribution: "题型分布",
  };
  return `${source.year} · ${courseName(source.course)} · ${typeMap[source.sourceType] ?? source.sourceType}`;
}

function difficultyName(difficulty) {
  return {
    beginner: "零基础",
    foundation: "基础巩固",
    exam: "真题冲刺",
  }[difficulty] ?? difficulty;
}

function modeName(mode) {
  return {
    code: "代码练习",
    theory: "理论题",
    fill_blank: "填空题",
  }[mode] ?? mode;
}

function getActiveQuestion() {
  return getQuestionById(state.questions, state.activeId) ?? state.questions[0] ?? null;
}

function getSource(sourceId) {
  return state.sources.find((source) => source.id === sourceId) ?? null;
}

function updateProgressSummary() {
  const summary = summarizeProgress(state.questions, progressStore.getState());
  els.progressSummary.textContent = `${summary.mastered}/${summary.total} 已掌握 · ${summary.redo} 待重做`;
}

function renderConceptOptions() {
  const concepts = collectConcepts(state.questions);
  for (const concept of concepts) {
    const option = document.createElement("option");
    option.value = concept;
    option.textContent = concept;
    els.conceptFilter.append(option);
  }
}

function renderQuestionList() {
  const progress = progressStore.getState();
  const filtered = filterQuestions(state.questions, state.filters, progress);
  els.questionCount.textContent = String(filtered.length);
  els.questionList.replaceChildren();

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "没有符合筛选条件的题目。";
    els.questionList.append(empty);
    return;
  }

  if (!filtered.some((question) => question.id === state.activeId)) {
    state.activeId = filtered[0].id;
  }

  for (const question of filtered) {
    const entry = progress[question.id] ?? {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = `question-item${question.id === state.activeId ? " active" : ""}`;
    button.innerHTML = `
      <strong>${question.title}</strong>
      <span>${courseName(question.course)} · ${question.year} · ${entry.status ?? "未做"}</span>
    `;
    button.addEventListener("click", () => {
      state.activeId = question.id;
      render();
    });
    els.questionList.append(button);
  }
}

function syncDisclosure(element, questionId, defaultOpen) {
  if (element.dataset.questionId !== questionId) {
    element.open = defaultOpen;
    element.dataset.questionId = questionId;
  }
}

function renderExpandableSections(question, answerOpened) {
  const sections = Object.fromEntries(getExpandableSections(question).map((section) => [section.id, section]));
  const bindings = {
    study: {
      panel: els.studyPanel,
      label: els.studyLabel,
      heading: els.studyHeading,
      summary: els.studyCue,
    },
    hints: {
      panel: els.hintPanel,
      label: els.hintLabel,
      heading: els.hintHeading,
      summary: els.hintSummary,
    },
    answer: {
      panel: els.answerPanel,
      label: els.answerLabel,
      heading: els.answerHeading,
      summary: els.answerSummary,
    },
    source: {
      panel: els.sourcePanel,
      label: els.sourceLabel,
      heading: els.sourceHeading,
      summary: els.sourceSummary,
    },
  };

  for (const [id, binding] of Object.entries(bindings)) {
    const section = sections[id];
    if (!section) continue;
    binding.label.textContent = section.label;
    binding.heading.textContent = section.title;
    binding.summary.textContent = id === "answer" && answerOpened ? "答案已显示" : section.summary;
    syncDisclosure(binding.panel, question.id, section.defaultOpen);
  }

  if (answerOpened) {
    els.answerPanel.open = true;
  }
}

function renderHints(question, entry) {
  els.hintList.replaceChildren();
  question.hints.forEach((hint, index) => {
    const opened = entry.hintsOpened?.includes(index);
    const card = document.createElement("details");
    card.className = "hint-disclosure";
    card.open = Boolean(opened);
    const summary = document.createElement("summary");
    summary.innerHTML = `<strong>提示 ${index + 1}</strong><span>${opened ? "已展开" : "点击展开"}</span>`;
    const body = document.createElement("p");
    body.textContent = hint;
    card.addEventListener("toggle", () => {
      if (card.open) {
        progressStore.recordHintOpen(question.id, index);
        render();
      }
    });
    card.append(summary, body);
    els.hintList.append(card);
  });
}

function renderStudyGuide(question) {
  const guide = buildStudyGuide(question);
  els.studyHeading.textContent = guide.heading;
  els.studyCue.textContent = guide.cue;
  els.studyPoints.replaceChildren(
    ...guide.points.map((point) => {
      const item = document.createElement("article");
      item.className = "study-point";
      const title = document.createElement("strong");
      title.textContent = point.title;
      const body = document.createElement("p");
      body.textContent = point.body;
      item.append(title, body);
      return item;
    }),
  );
}

function renderTheory(question, entry) {
  const isTheory = question.mode === "theory";
  els.theorySection.hidden = !isTheory;
  els.theoryOptions.replaceChildren();
  els.theoryFeedback.textContent = "";
  if (!isTheory) return;

  for (const option of question.options ?? []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `theory-option${entry.selectedOption === option.id ? " selected" : ""}`;
    button.innerHTML = `<strong>${option.id}</strong>${option.text}`;
    button.addEventListener("click", () => {
      progressStore.recordChoice(question.id, option.id);
      render();
    });
    els.theoryOptions.append(button);
  }

  if (entry.selectedOption) {
    const correct = entry.selectedOption === question.correctAnswer;
    els.theoryFeedback.textContent = correct
      ? "你选择了正确答案。解析仍然需要点击参考答案才会显示。"
      : "已记录你的选择。先想想哪里不对，再点击参考答案看解析。";
  } else {
    els.theoryFeedback.textContent = "先自己选一个，再决定要不要看解析。";
  }
}

function renderFillBlank(question) {
  const isFillBlank = question.mode === "fill_blank";
  els.fillBlankSection.hidden = !isFillBlank;
  els.blankInputs.replaceChildren();
  els.blankFeedback.textContent = "";
  els.checkBlanks.onclick = null;
  if (!isFillBlank) return;

  const answers = question.blankAnswers?.length ? question.blankAnswers : [question.correctAnswer ?? ""];
  answers.forEach((_, index) => {
    const label = document.createElement("label");
    label.className = "blank-field";
    label.innerHTML = `<span>第 ${index + 1} 空</span><input type="text" autocomplete="off" spellcheck="false">`;
    els.blankInputs.append(label);
  });

  els.blankFeedback.textContent = "先自己填，再点击核对；参考答案仍然需要手动确认后才显示。";
  els.checkBlanks.onclick = () => {
    const inputs = [...els.blankInputs.querySelectorAll("input")];
    const result = checkBlankAnswers(
      inputs.map((input) => input.value),
      answers,
    );
    result.details.forEach((passed, index) => {
      inputs[index].classList.toggle("blank-correct", passed);
      inputs[index].classList.toggle("blank-wrong", !passed && inputs[index].value.trim().length > 0);
    });
    els.blankFeedback.textContent =
      result.correct === result.total
        ? `全部正确，${result.total}/${result.total}。`
        : `已核对：${result.correct}/${result.total} 个空匹配参考答案。先改一改，再决定要不要看答案。`;
  };
}

function renderStatusButtons(question, entry) {
  document.querySelectorAll("[data-mark]").forEach((button) => {
    const status = button.dataset.mark;
    button.classList.toggle("active", entry.status === status);
    button.onclick = () => {
      progressStore.markQuestion(question.id, status);
      render();
    };
  });
}

function renderQuestion() {
  const question = getActiveQuestion();
  if (!question) return;
  const source = getSource(question.sourceId);
  const entry = progressStore.getState()[question.id] ?? {};

  els.questionMeta.replaceChildren();
  for (const text of [
    sourceLabel(source),
    modeName(question.mode),
    difficultyName(question.difficulty),
    entry.status ?? "未做",
  ]) {
    const pill = document.createElement("span");
    pill.className = "meta-pill";
    pill.textContent = text;
    els.questionMeta.append(pill);
  }

  els.questionTitle.textContent = question.title;
  els.questionStem.textContent = question.stem;
  els.conceptTags.replaceChildren(
    ...question.concepts.map((concept) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = concept;
      return tag;
    }),
  );

  if (els.codeEditor.dataset.questionId !== question.id) {
    els.codeEditor.value = question.starterCode;
    els.codeEditor.dataset.questionId = question.id;
    els.resultsList.innerHTML = '<p class="empty-state">写好代码后点击运行。隐藏测试只显示通过数量，不直接泄题。</p>';
    els.runSummary.textContent = "未运行";
  }

  const answerOpened = Boolean(entry.answerOpened);

  renderStatusButtons(question, entry);
  renderExpandableSections(question, answerOpened);
  renderStudyGuide(question);
  renderTheory(question, entry);
  renderFillBlank(question);
  renderHints(question, entry);

  els.answerBlock.hidden = !answerOpened;
  els.answerBlock.textContent = answerOpened ? question.answer : "";
  els.revealAnswer.textContent = answerOpened ? "答案已显示" : "确认后查看";
  els.revealAnswer.disabled = answerOpened;

  els.sourceInfo.innerHTML = source
    ? `
      <p><strong>${source.displayName}</strong></p>
      <p>${sourceLabel(source)}</p>
      <p><code>${source.path}</code></p>
      <p>SHA-256: <code>${source.sha256}</code></p>
    `
    : "<p>暂无来源信息。</p>";

  const usesCode = question.mode === "code";
  els.codePanel.hidden = !usesCode;
  els.workspaceMain.classList.toggle("theory-mode", !usesCode);
  if (!usesCode) {
    els.resultsList.innerHTML =
      question.mode === "fill_blank"
        ? '<p class="empty-state">填空题无需运行代码。先输入答案并核对，再按需查看提示或参考答案。</p>'
        : '<p class="empty-state">理论题无需运行代码。先选择答案，再按需查看提示或解析。</p>';
    els.runSummary.textContent = modeName(question.mode);
  }
}

function render() {
  updateProgressSummary();
  renderQuestionList();
  renderQuestion();
}

function renderResults(payload) {
  els.resultsList.replaceChildren();

  if ("stdout" in payload || "error" in payload) {
    const card = document.createElement("div");
    card.className = `result-card ${payload.ok ? "pass" : "fail"}`;
    card.innerHTML = `
      <h3><span>自定义输入</span><span class="${payload.ok ? "pass-text" : "fail-text"}">${payload.ok ? "运行完成" : "运行出错"}</span></h3>
      <pre class="result-output">${payload.error || normalizeOutput(payload.stdout) || "(无输出)"}</pre>
    `;
    els.resultsList.append(card);
    els.runSummary.textContent = payload.ok ? "自定义运行完成" : "运行出错";
    return;
  }

  const { results, summary } = payload;
  els.runSummary.textContent = `样例 ${summary.sample.passed}/${summary.sample.total} · 隐藏 ${summary.hidden.passed}/${summary.hidden.total}`;

  for (const result of results) {
    const isSample = result.group === "sample";
    const card = document.createElement("div");
    card.className = `result-card ${result.passed ? "pass" : "fail"}`;
    const statusText = result.passed ? "通过" : "未通过";
    const detail = result.error
      ? result.error
      : isSample
        ? `输入:\n${result.stdin}\n期望输出:\n${result.expectedStdout}\n你的输出:\n${normalizeOutput(result.actualStdout) || "(无输出)"}`
        : "隐藏测试不展示输入和答案，只显示是否通过。";
    card.innerHTML = `
      <h3>
        <span>${isSample ? "样例" : "隐藏"}测试 ${result.index + 1}</span>
        <span class="${result.passed ? "pass-text" : "fail-text"}">${statusText}</span>
      </h3>
      <pre class="result-output">${detail}</pre>
    `;
    els.resultsList.append(card);
  }
}

function setRuntimeStatus(text, className = "") {
  els.runtimeStatus.textContent = text;
  els.runtimeStatus.className = `runtime-pill ${className}`.trim();
}

async function runCurrentQuestion() {
  const question = getActiveQuestion();
  if (!question) return;
  try {
    els.runCode.disabled = true;
    setRuntimeStatus("Python 加载/运行中", "loading");
    const payload = await runPythonQuestion(question, els.codeEditor.value);
    renderResults(payload);
    setRuntimeStatus("Python 已就绪", "ready");
  } catch (error) {
    els.runSummary.textContent = "运行失败";
    els.resultsList.innerHTML = `<div class="result-card fail"><h3><span>运行失败</span><span class="fail-text">错误</span></h3><pre class="result-output">${error.message}</pre></div>`;
    setRuntimeStatus("Python 运行失败", "");
  } finally {
    els.runCode.disabled = false;
  }
}

async function runCustomInput() {
  try {
    els.runCustom.disabled = true;
    setRuntimeStatus("Python 加载/运行中", "loading");
    const payload = await runCustomPython(els.codeEditor.value, els.customInput.value);
    renderResults(payload);
    setRuntimeStatus("Python 已就绪", "ready");
  } catch (error) {
    renderResults({ ok: false, stdout: "", error: error.message });
    setRuntimeStatus("Python 运行失败", "");
  } finally {
    els.runCustom.disabled = false;
  }
}

function bindEvents() {
  els.courseFilter.addEventListener("change", () => {
    state.filters.course = els.courseFilter.value;
    render();
  });
  els.conceptFilter.addEventListener("change", () => {
    state.filters.concept = els.conceptFilter.value;
    render();
  });
  els.difficultyFilter.addEventListener("change", () => {
    state.filters.difficulty = els.difficultyFilter.value;
    render();
  });
  els.modeFilter.addEventListener("change", () => {
    state.filters.mode = els.modeFilter.value;
    render();
  });
  els.statusFilter.addEventListener("change", () => {
    state.filters.status = els.statusFilter.value;
    render();
  });
  els.searchInput.addEventListener("input", () => {
    state.filters.query = els.searchInput.value.trim();
    render();
  });
  els.resetFilters.addEventListener("click", () => {
    Object.assign(state.filters, {
      course: "all",
      concept: "all",
      difficulty: "all",
      mode: "all",
      status: "all",
      query: "",
    });
    els.courseFilter.value = "all";
    els.conceptFilter.value = "all";
    els.difficultyFilter.value = "all";
    els.modeFilter.value = "all";
    els.statusFilter.value = "all";
    els.searchInput.value = "";
    render();
  });
  els.resetCode.addEventListener("click", () => {
    const question = getActiveQuestion();
    if (question) els.codeEditor.value = question.starterCode;
  });
  els.runCode.addEventListener("click", runCurrentQuestion);
  els.runCustom.addEventListener("click", runCustomInput);
  els.revealAnswer.addEventListener("click", () => {
    els.confirmDialog.hidden = false;
  });
  els.cancelReveal.addEventListener("click", () => {
    els.confirmDialog.hidden = true;
  });
  els.confirmReveal.addEventListener("click", () => {
    const question = getActiveQuestion();
    if (question) progressStore.recordAnswerOpen(question.id);
    els.confirmDialog.hidden = true;
    render();
  });
}

async function init() {
  const [questionsResponse, sourcesResponse] = await Promise.all([
    fetch("./data/questions.json"),
    fetch("./data/sources.json"),
  ]);
  const questionsPayload = await questionsResponse.json();
  const sourcesPayload = await sourcesResponse.json();
  state.questions = questionsPayload.questions;
  state.sources = sourcesPayload.sources;
  state.activeId = state.questions[0]?.id ?? null;
  renderConceptOptions();
  bindEvents();
  render();
}

init().catch((error) => {
  els.questionTitle.textContent = "加载题库失败";
  els.questionStem.textContent = error.message;
});
