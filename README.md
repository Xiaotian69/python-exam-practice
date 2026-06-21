# Python 真题冲刺练习台

这是一个纯静态 Python 刷题网站，可以放到 GitHub Pages 直接打开。当前题库共 151 道：

- 125 道从原卷抽取的客观题：87 道单选、5 道多选、21 道判断、12 道填空。
- 18 道代码练习，其中包含更适合小白入门的基础题。
- 8 道补充理论题，用来复习输入、输出、类型、列表、字典、集合、异常、函数等基础概念。

## 本地预览

在项目根目录运行：

```powershell
python -m http.server 8000 -d site
```

然后打开：

```text
http://localhost:8000
```

不要直接双击 `index.html`，因为浏览器会阻止本地 `fetch()` 读取题库 JSON。

## 发布到 GitHub Pages

把 `site/` 目录作为 GitHub Pages 的发布内容即可。常见做法：

1. 新建一个 GitHub 仓库。
2. 上传 `site/` 目录里的全部文件。
3. 在仓库 `Settings -> Pages` 里选择发布分支和目录。
4. 打开 GitHub Pages 给出的链接。

首次运行代码题时，网页会从 Pyodide CDN 加载 Python 运行环境。第一次会慢一点，后续浏览器通常会缓存。

## 题库维护

正式题库在：

```text
site/data/questions.json
```

原卷客观题抽取结果在：

```text
site/data/exam_objective_questions.json
```

重新生成正式题库：

```powershell
python scripts/build_question_data.py
```

修改题库或前端后建议运行：

```powershell
python -m unittest tests.test_question_data -v
node --test tests/js/*.test.mjs
```
