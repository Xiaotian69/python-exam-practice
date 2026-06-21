export function getQuestionById(questions, questionId) {
  return questions.find((question) => question.id === questionId) ?? null;
}

export function filterQuestions(questions, filters = {}, progress = {}) {
  return questions.filter((question) => {
    if (filters.course && filters.course !== "all" && question.course !== filters.course) {
      return false;
    }
    if (filters.concept && filters.concept !== "all" && !question.concepts.includes(filters.concept)) {
      return false;
    }
    if (filters.difficulty && filters.difficulty !== "all" && question.difficulty !== filters.difficulty) {
      return false;
    }
    if (filters.mode && filters.mode !== "all" && question.mode !== filters.mode) {
      return false;
    }
    if (filters.sourceId && filters.sourceId !== "all" && question.sourceId !== filters.sourceId) {
      return false;
    }
    if (filters.status && filters.status !== "all") {
      const status = progress[question.id]?.status ?? "new";
      if (status !== filters.status) {
        return false;
      }
    }
    if (filters.query) {
      const haystack = `${question.title} ${question.stem} ${question.concepts.join(" ")}`.toLowerCase();
      if (!haystack.includes(filters.query.toLowerCase())) {
        return false;
      }
    }
    return true;
  });
}

export function summarizeProgress(questions, progress = {}) {
  const summary = {
    total: questions.length,
    mastered: 0,
    redo: 0,
    uncertain: 0,
    hinted: 0,
    answered: 0,
  };

  for (const question of questions) {
    const entry = progress[question.id] ?? {};
    if (entry.status === "mastered") summary.mastered += 1;
    if (entry.status === "redo") summary.redo += 1;
    if (entry.status === "uncertain") summary.uncertain += 1;
    if (Array.isArray(entry.hintsOpened) && entry.hintsOpened.length > 0) summary.hinted += 1;
    if (entry.answerOpened) summary.answered += 1;
  }

  return summary;
}

export function collectConcepts(questions) {
  return [...new Set(questions.flatMap((question) => question.concepts))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function normalizeBlankAnswer(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function checkBlankAnswers(inputs, expectedAnswers) {
  const details = expectedAnswers.map(
    (answer, index) => normalizeBlankAnswer(inputs[index]) === normalizeBlankAnswer(answer),
  );
  return {
    correct: details.filter(Boolean).length,
    total: expectedAnswers.length,
    details,
  };
}

const CONCEPT_GUIDES = {
  accumulator: ["累加器", "看到求和、计数、平均值时，先准备一个变量，再在循环里逐步更新。"],
  builtin: ["内置函数", "优先想 Python 已经给你的工具，比如 max、min、len、sum、sorted。"],
  choice: ["选择题", "先排除语法明显不成立的选项，再比较剩下选项的细节。"],
  condition: ["条件判断", "把题干里的条件翻译成 if / elif / else，注意 and、or 的优先级。"],
  dictionary: ["字典", "字典适合保存“名字到数值”这类对应关系，核心是 key 和 value。"],
  exception: ["异常处理", "try 里放可能出错的代码，except 里写出错后的处理办法。"],
  "exam-objective": ["真题客观题", "这类题先抓关键词，不急着看答案，做完再用解析复盘。"],
  "fill-blank": ["填空题", "填空先判断空里要填的是函数名、关键字、表达式，还是运行结果。"],
  function: ["函数", "函数题重点看参数、返回值和调用位置；没有 return 时默认返回 None。"],
  index: ["下标", "Python 下标从 0 开始，负下标从末尾往前数。"],
  input: ["输入", "input() 读到的是字符串；需要数字时要用 int、float 或 map 转换。"],
  integer: ["整数", "整数运算注意除法、取余和格式化输出，输入后通常要先转成 int。"],
  list: ["列表", "列表用来保存一组有顺序的数据，常见操作是遍历、下标访问和追加。"],
  loop: ["循环", "循环适合重复处理一批数据；先想清楚循环变量每次代表什么。"],
  operator: ["运算符", "遇到表达式题，按优先级一步步算，尤其注意幂运算、取余和比较链。"],
  print: ["输出", "print 可以一次输出多个值，默认用空格隔开，结尾默认换行。"],
  range: ["range", "range(a, b) 包含 a，不包含 b；写循环边界时特别容易差 1。"],
  return: ["返回值", "return 把结果交回调用处；print 只是显示，二者不要混用。"],
  sequence: ["序列", "字符串、列表、元组都属于序列，常见考点是索引、切片和长度。"],
  set: ["集合", "集合会自动去重，适合交集、并集、差集这类关系运算。"],
  sort: ["排序", "排序题先确定升序还是降序，再看并列时用哪个字段决定先后。"],
  string: ["字符串", "字符串是字符序列，常考大小写转换、查找、切片和统计。"],
  syntax: ["语法", "语法题先看括号、引号、冒号、缩进，这些是最容易丢分的地方。"],
  type: ["类型", "不同类型能做的操作不同；做题时先判断变量到底是什么类型。"],
};

function guideForConcept(concept) {
  const guide = CONCEPT_GUIDES[concept];
  if (guide) {
    return { title: guide[0], body: guide[1] };
  }
  return { title: concept, body: "先把这个知识点和题干里的关键词对应起来，再开始作答。" };
}

export function buildStudyGuide(question) {
  const modeGuide = {
    code: {
      heading: "先拆步骤，再写代码",
      cue: "建议顺序：读输入 -> 处理数据 -> 格式化输出 -> 跑样例。",
    },
    theory: {
      heading: "考点先过一遍",
      cue: "先自己选，再用提示确认方向；不要一上来展开答案。",
    },
    fill_blank: {
      heading: "先判断空里要什么",
      cue: "每个空先想词性：关键字、函数名、表达式、路径，还是运行结果。",
    },
  }[question.mode] ?? {
    heading: "考点先过一遍",
    cue: "先圈出题干关键词，再决定用哪个知识点解题。",
  };

  const points = [...new Set(question.concepts ?? [])].slice(0, 4).map(guideForConcept);

  return {
    heading: modeGuide.heading,
    cue: modeGuide.cue,
    points: points.length ? points : [guideForConcept("syntax")],
  };
}
