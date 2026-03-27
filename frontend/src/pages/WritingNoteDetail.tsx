import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Calendar, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Layout } from '../components/layout/Layout'

// Mock writing notes with markdown content
const WRITING_NOTES_CONTENT: Record<string, {
  name: string
  path: string
  updatedAt: string
  content: string
}> = {
  w1: {
    name: '雅思写作Task 2模板.md',
    path: '/notes/writing/task2-template.md',
    updatedAt: '2天前',
    content: `# 雅思写作 Task 2 模板

## 文章结构

雅思 Task 2 大作文需要在 40 分钟内写出不少于 **250 字**的文章，满分为 9 分。

---

## 开头段（Introduction）

> 改写题目观点 + 表明立场

**模板：**
> It is widely argued that [话题改写]. While [反方观点], I firmly believe that [己方立场].

**示例：**
> It is widely argued that technology has fundamentally transformed the way people communicate. While some critics contend that this has led to a decline in face-to-face interaction, I firmly believe that digital communication has, on balance, enriched human relationships.

---

## 主体段一（Body 1）— 支持论点

> 主题句 + 说明 + 例子 + 结论

**结构：**
1. **Topic sentence** — 核心观点
2. **Explanation** — 展开说明
3. **Example** — 举例支撑
4. **Concluding link** — 与主题呼应

\`\`\`
Firstly, [论点].
This is because [解释].
For instance, [例子].
Therefore, [小结].
\`\`\`

---

## 主体段二（Body 2）— 对立观点 + 反驳

> 承认对立观点 + 提出反驳

**模板：**
> Admittedly, [对立观点]. However, [反驳 / 更有力的论证].

---

## 结尾段（Conclusion）

**模板：**
> In conclusion, while [承认对立面], I would argue that [重申立场]. [未来展望或建议].

---

## 高分词组表

| 功能 | 表达 |
|------|------|
| 引入观点 | It is argued that / It is widely held that |
| 转折 | However / Nevertheless / On the other hand |
| 举例 | For instance / For example / To illustrate |
| 递进 | Furthermore / Moreover / In addition |
| 结论 | In conclusion / To sum up / Overall |

---

## 注意事项

- ✅ 字数不少于 **250** 字
- ✅ 段落清晰，每段有主题句
- ✅ 使用连接词保持逻辑流畅
- ✅ 避免重复使用同一词汇（同义替换）
- ❌ 不要使用缩写（don't → do not）
- ❌ 不要使用过于口语化的表达
`,
  },
  w2: {
    name: '大作文高分句型整理.md',
    path: '/notes/writing/high-score-phrases.md',
    updatedAt: '5天前',
    content: `# 大作文高分句型整理

> 本文档收录了雅思 Task 2 常用的高分句型和表达，按功能分类整理。

---

## 一、引入主题

\`\`\`
In recent years, there has been a growing debate over whether...
The question of whether [话题] has sparked considerable controversy.
[话题] is a topic that has garnered significant attention in contemporary society.
\`\`\`

---

## 二、表达立场

### 强烈支持
> I am firmly convinced that...
> There is no doubt in my mind that...
> It is my strong belief that...

### 部分认同
> While I acknowledge that [X], I nevertheless believe that [Y].
> Although there is some merit in [观点], I would argue that...

---

## 三、让步与转折

| 让步 | 转折 |
|------|------|
| Admittedly, ... | However, this does not mean that... |
| It is true that ... | Nevertheless, ... |
| One might argue that ... | Yet, in reality, ... |

---

## 四、举例说明

\`\`\`
To illustrate this point, consider the case of [例子].
A striking example of this can be seen in...
Research conducted by [机构] has demonstrated that...
\`\`\`

---

## 五、因果关系

**原因表达：**
- owing to / due to / as a result of
- This can be attributed to...
- The primary reason for this is that...

**结果表达：**
- consequently / as a result / therefore
- This inevitably leads to...
- The impact of this is far-reaching...

---

## 六、对比与比较

\`\`\`
In contrast to [A], [B] tends to...
Compared with traditional approaches, modern methods...
Unlike [A], [B] offers the advantage of...
\`\`\`

---

## 七、结尾总结

\`\`\`
In conclusion, the evidence strongly suggests that [立场].
Having examined both sides of the argument, I am of the view that [重申立场].
It is therefore imperative that [建议/行动].
\`\`\`

---

## 同义替换速查

| 基础词 | 高级替换 |
|--------|----------|
| important | crucial / vital / paramount / significant |
| increase | rise / surge / escalate / soar |
| decrease | decline / plummet / diminish / dwindle |
| think | argue / contend / maintain / assert |
| show | demonstrate / reveal / indicate / suggest |
| problem | challenge / issue / concern / dilemma |
`,
  },
}

export default function WritingNoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const note = id ? WRITING_NOTES_CONTENT[`w${id}`] : null

  if (!note) {
    return (
      <Layout title="写作笔记">
        <div className="p-8 flex flex-col items-center gap-4 text-text-dim">
          <FileText size={40} className="opacity-30" />
          <p>写作笔记未找到</p>
          <button onClick={() => navigate('/kb')} className="text-primary text-sm hover:underline">
            返回知识库
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="写作笔记">
      <div className="max-w-3xl mx-auto px-8 py-8">
        {/* Back */}
        <button
          onClick={() => navigate('/kb')}
          className="flex items-center gap-1.5 text-text-dim hover:text-text-muted text-sm transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          返回知识库
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-card border border-border rounded-xl p-5 mb-6 flex items-start gap-4"
        >
          <div className="w-10 h-10 rounded-lg bg-[#1e293b] border border-[#334155] flex items-center justify-center shrink-0">
            <FileText size={18} className="text-[#94a3b8]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-text-primary truncate">{note.name}</h1>
            <p className="text-xs text-text-subtle mt-1 truncate">{note.path}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-subtle shrink-0">
            <Calendar size={12} />
            {note.updatedAt}
          </div>
        </motion.div>

        {/* Markdown content */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-card border border-border rounded-xl p-8"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold text-text-primary mb-4 pb-3 border-b border-border">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-lg font-semibold text-text-primary mt-8 mb-3">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-semibold text-text-secondary mt-5 mb-2">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="text-[15px] text-text-secondary leading-relaxed mb-3">{children}</p>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary/40 pl-4 py-1 my-3 bg-[#1e1e2e] rounded-r-md">
                  <div className="text-[14px] text-text-muted italic">{children}</div>
                </blockquote>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-')
                if (isBlock) {
                  return (
                    <div className="my-4 bg-[#0d0d10] border border-border rounded-lg overflow-hidden">
                      <div className="px-4 py-2 border-b border-border bg-[#141418] flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#28ca41]" />
                      </div>
                      <pre className="p-4 overflow-x-auto text-[13px] text-[#e2e8f0] font-mono leading-relaxed">
                        <code>{children}</code>
                      </pre>
                    </div>
                  )
                }
                return (
                  <code className="px-1.5 py-0.5 text-[13px] font-mono bg-[#1a1a28] text-primary rounded">
                    {children}
                  </code>
                )
              },
              table: ({ children }) => (
                <div className="my-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-[#1a1a28]">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wide border-b border-border">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-2.5 text-[14px] text-text-secondary border-b border-border/50">{children}</td>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-[#1e1e2e] transition-colors">{children}</tr>
              ),
              ul: ({ children }) => (
                <ul className="my-3 space-y-1.5 list-none pl-0">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 space-y-1.5 list-decimal list-inside">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="flex items-start gap-2 text-[15px] text-text-secondary">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span>{children}</span>
                </li>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-text-primary">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic text-text-muted">{children}</em>
              ),
              hr: () => (
                <hr className="my-6 border-border" />
              ),
              a: ({ href, children }) => (
                <a href={href} className="text-primary underline decoration-primary/40 hover:decoration-primary" target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {note.content}
          </ReactMarkdown>
        </motion.div>

        {/* Footer nav */}
        <div className="flex items-center justify-between mt-6 text-sm text-text-dim">
          <button onClick={() => navigate('/kb')} className="flex items-center gap-1.5 hover:text-text-muted transition-colors">
            <ArrowLeft size={13} />
            返回知识库
          </button>
          <button className="flex items-center gap-1.5 hover:text-text-muted transition-colors">
            <RefreshCw size={13} />
            重新导入
          </button>
        </div>
      </div>
    </Layout>
  )
}
