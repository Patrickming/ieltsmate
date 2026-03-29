# Frontend UI & Motion Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有业务能力与路由结构前提下，完成前端 UI 设计系统化升级、Uiverse 组件融合和中动效体系落地，并覆盖核心页面。

**Architecture:** 先建设 `tokens + motion` 基座，再升级 `primitives`（按钮/输入/状态组件），然后重构布局与页面并统一弹窗交互。所有改动保持在展示层与交互层，`zustand` 业务数据模型不变。测试层采用 `Vitest + Testing Library`，覆盖核心组件状态、可访问性与 reduced-motion 降级路径。

**Tech Stack:** React 19, TypeScript, Vite 8, TailwindCSS 3, Framer Motion, Vitest, @testing-library/react, @testing-library/jest-dom, jsdom

---

## Scope Check

本 spec 属于单一子系统（前端 UI/交互层）内的分层改造，不需要拆分为多个独立计划。任务按“基座 -> 组件 -> 页面 -> 回归”顺序可独立提交与验证。

## File Structure Map

### New Files
- `frontend/src/styles/tokens.css`：设计 token（颜色、阴影、圆角、z-index、时长、缓动）
- `frontend/src/styles/motion.css`：统一动效 class 与 reduced-motion 降级
- `frontend/src/components/ui/Input.tsx`：统一输入组件
- `frontend/src/components/ui/Skeleton.tsx`：统一骨架屏组件
- `frontend/src/components/ui/Spinner.tsx`：统一加载组件
- `frontend/src/components/ui/Tooltip.tsx`：轻量 tooltip 容器
- `frontend/src/components/ui/ModalShell.tsx`：弹窗统一容器（遮罩、位移、缩放、关闭）
- `frontend/src/components/ui/EmptyState.tsx`：空状态组件
- `frontend/src/components/ui/LoadingState.tsx`：页面级加载状态组件
- `frontend/src/test/setup.ts`：测试环境初始化
- `frontend/src/test/render.tsx`：统一 render helper
- `frontend/src/components/ui/__tests__/Button.test.tsx`
- `frontend/src/components/ui/__tests__/Input.test.tsx`
- `frontend/src/components/ui/__tests__/ModalShell.test.tsx`
- `frontend/src/components/layout/__tests__/Sidebar.test.tsx`
- `frontend/src/pages/__tests__/Dashboard.test.tsx`

### Modified Files
- `frontend/package.json`：测试脚本和依赖
- `frontend/vite.config.ts`：Vitest 配置
- `frontend/src/main.tsx`：引入 token/motion 样式
- `frontend/src/styles/globals.css`：移除重复变量，改为引用 token
- `frontend/src/components/ui/Button.tsx`：variant/size/state 统一 + 动效节奏
- `frontend/src/components/layout/Sidebar.tsx`：导航激活态、hover、分组动画统一
- `frontend/src/components/layout/Topbar.tsx`：搜索与 action 按钮统一状态
- `frontend/src/components/modals/SearchModal.tsx`：接入 `ModalShell`
- `frontend/src/pages/Dashboard.tsx`：筛选、卡片、空状态统一组件化
- `frontend/src/pages/KnowledgeBase.tsx`：输入、分组 pills、空状态与 loading 统一
- `frontend/src/pages/KnowledgeDetail.tsx`：操作区、统计区、编辑区状态统一

### Optional but Recommended (if present in project usage)
- `frontend/src/components/modals/QuickNoteModal.tsx`
- `frontend/src/components/modals/AIPanel.tsx`
- `frontend/src/components/modals/AIModelConfigModal.tsx`
- `frontend/src/components/modals/ImportModal.tsx`

---

### Task 1: 建立测试基础与执行入口

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/tsconfig.app.json`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/render.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/ui/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react'
import { Button } from '../Button'

describe('Button', () => {
  it('renders button label', () => {
    render(<Button>保存</Button>)
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- --run src/components/ui/__tests__/Button.test.tsx`  
Expected: FAIL，报错 `test script missing` 或 `vitest not found`

- [ ] **Step 3: Write minimal implementation**

```json
// frontend/package.json (scripts + devDependencies excerpt)
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "jsdom": "latest",
    "vitest": "latest"
  }
}
```

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
  },
})
```

```ts
// frontend/src/test/setup.ts
import '@testing-library/jest-dom'
```

```ts
// frontend/src/test/render.tsx
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

export function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm i && pnpm test:run src/components/ui/__tests__/Button.test.tsx`  
Expected: PASS（至少 1 个用例通过）

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/vite.config.ts frontend/src/test/setup.ts frontend/src/test/render.tsx
git commit -m "test: add vitest and testing-library baseline"
```

---

### Task 2: 落地设计 Token 与动效基线

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/motion.css`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/styles/globals.css`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/styles/__tests__/tokens.test.ts
import { readFileSync } from 'node:fs'

describe('tokens', () => {
  it('contains motion duration tokens', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8')
    expect(css).toContain('--motion-duration-fast')
    expect(css).toContain('--motion-duration-base')
    expect(css).toContain('--motion-duration-slow')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test:run src/styles/__tests__/tokens.test.ts`  
Expected: FAIL，提示 `ENOENT: no such file or directory, open 'src/styles/tokens.css'`

- [ ] **Step 3: Write minimal implementation**

```css
/* frontend/src/styles/tokens.css */
:root {
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --motion-duration-fast: 120ms;
  --motion-duration-base: 180ms;
  --motion-duration-slow: 240ms;
  --motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

```css
/* frontend/src/styles/motion.css */
.motion-press {
  transition: transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.motion-press:active {
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
```

```tsx
// frontend/src/main.tsx
import './styles/tokens.css'
import './styles/motion.css'
import './styles/globals.css'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test:run src/styles/__tests__/tokens.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/src/styles/motion.css frontend/src/main.tsx frontend/src/styles/globals.css
git commit -m "feat(ui): add design tokens and motion baseline"
```

---

### Task 3: 升级 Primitives（Button/Input/Skeleton/Spinner）

**Files:**
- Modify: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Input.tsx`
- Create: `frontend/src/components/ui/Skeleton.tsx`
- Create: `frontend/src/components/ui/Spinner.tsx`
- Test: `frontend/src/components/ui/__tests__/Button.test.tsx`
- Test: `frontend/src/components/ui/__tests__/Input.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/ui/__tests__/Input.test.tsx
import { render, screen } from '@testing-library/react'
import { Input } from '../Input'

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="搜索笔记" />)
    expect(screen.getByPlaceholderText('搜索笔记')).toBeInTheDocument()
  })

  it('shows aria-invalid when invalid', () => {
    render(<Input aria-invalid />)
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test:run src/components/ui/__tests__/Input.test.tsx`  
Expected: FAIL，提示 `Cannot find module '../Input'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/components/ui/Input.tsx
import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-10 px-3 text-sm',
  lg: 'h-11 px-3.5 text-sm',
}

export function Input({ size = 'md', className = '', ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-md border border-border bg-[#0d0d10] text-text-primary placeholder-text-subtle
      outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20
      aria-[invalid=true]:border-[#fb7185]/70 ${sizeMap[size]} ${className}`}
      {...props}
    />
  )
}
```

```tsx
// frontend/src/components/ui/Button.tsx (核心片段)
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const variantMap: Record<ButtonVariant, string> = {
  primary: 'bg-primary-btn text-white hover:bg-primary-btn-hover',
  secondary: 'border border-border text-text-secondary hover:bg-[#27272a]',
  ghost: 'text-text-muted hover:bg-[#27272a]/70 hover:text-text-secondary',
  danger: 'bg-[#3a0f1f] border border-[#fb7185]/30 text-[#fb7185] hover:bg-[#4a1327]',
}
```

```tsx
// frontend/src/components/ui/Skeleton.tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[#232329] ${className}`} />
}
```

```tsx
// frontend/src/components/ui/Spinner.tsx
export function Spinner() {
  return (
    <span
      aria-label="loading"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test:run src/components/ui/__tests__/Button.test.tsx src/components/ui/__tests__/Input.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/Button.tsx frontend/src/components/ui/Input.tsx frontend/src/components/ui/Skeleton.tsx frontend/src/components/ui/Spinner.tsx frontend/src/components/ui/__tests__/Button.test.tsx frontend/src/components/ui/__tests__/Input.test.tsx
git commit -m "feat(ui): standardize primitive controls and states"
```

---

### Task 4: 统一弹窗交互壳与搜索弹窗改造

**Files:**
- Create: `frontend/src/components/ui/ModalShell.tsx`
- Modify: `frontend/src/components/modals/SearchModal.tsx`
- Test: `frontend/src/components/ui/__tests__/ModalShell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/ui/__tests__/ModalShell.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModalShell } from '../ModalShell'

describe('ModalShell', () => {
  it('calls onClose when overlay clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ModalShell open onClose={onClose}>内容</ModalShell>)
    await user.click(screen.getByTestId('modal-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test:run src/components/ui/__tests__/ModalShell.test.tsx`  
Expected: FAIL，`Cannot find module '../ModalShell'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/components/ui/ModalShell.tsx
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function ModalShell({ open, onClose, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            data-testid="modal-overlay"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-1/2 top-[18%] -translate-x-1/2 z-50"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

```tsx
// frontend/src/components/modals/SearchModal.tsx (核心替换)
return (
  <ModalShell open={showSearch} onClose={closeSearch}>
    <div className="w-[560px] bg-surface-overlay border border-border rounded-xl shadow-modal overflow-hidden">
      {/* 保持原搜索输入和结果区域结构 */}
    </div>
  </ModalShell>
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test:run src/components/ui/__tests__/ModalShell.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/ModalShell.tsx frontend/src/components/modals/SearchModal.tsx frontend/src/components/ui/__tests__/ModalShell.test.tsx
git commit -m "feat(ui): introduce modal shell and migrate search modal"
```

---

### Task 5: 布局层统一（Sidebar + Topbar）

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/components/layout/Topbar.tsx`
- Create: `frontend/src/components/layout/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/layout/__tests__/Sidebar.test.tsx
import { screen } from '@testing-library/react'
import { renderWithRouter } from '@/test/render'
import { Sidebar } from '../Sidebar'

describe('Sidebar', () => {
  it('renders primary nav items', () => {
    renderWithRouter(<Sidebar />)
    expect(screen.getByText('首页')).toBeInTheDocument()
    expect(screen.getByText('知识库')).toBeInTheDocument()
    expect(screen.getByText('复习')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test:run src/components/layout/__tests__/Sidebar.test.tsx`  
Expected: FAIL，可能是 alias 未识别或测试 helper 缺失

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/vite.config.ts (test alias ensure)
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  globals: true,
  css: true,
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
},
```

```tsx
// Sidebar.tsx（动作规范片段）
<motion.div
  layoutId="nav-active-bg"
  className="absolute inset-0 rounded-md bg-[#1a1a30] ring-1 ring-primary/25"
  transition={{ duration: 0.2 }}
/>
```

```tsx
// Topbar.tsx（搜索与按钮统一）
<button className="h-9 rounded-md border border-border bg-[#121216] px-3 transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-primary/30">
  ...
</button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test:run src/components/layout/__tests__/Sidebar.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx frontend/src/components/layout/Topbar.tsx frontend/src/components/layout/__tests__/Sidebar.test.tsx frontend/vite.config.ts
git commit -m "feat(layout): unify sidebar and topbar interaction patterns"
```

---

### Task 6: 页面层升级（Dashboard + KnowledgeBase + KnowledgeDetail）

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/pages/KnowledgeBase.tsx`
- Modify: `frontend/src/pages/KnowledgeDetail.tsx`
- Create: `frontend/src/components/ui/EmptyState.tsx`
- Create: `frontend/src/components/ui/LoadingState.tsx`
- Test: `frontend/src/pages/__tests__/Dashboard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/pages/__tests__/Dashboard.test.tsx
import { screen } from '@testing-library/react'
import { renderWithRouter } from '@/test/render'
import Dashboard from '../Dashboard'

describe('Dashboard', () => {
  it('shows dashboard heading', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.getByRole('heading', { name: '仪表盘' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test:run src/pages/__tests__/Dashboard.test.tsx`  
Expected: FAIL（若 Layout 依赖 store 未 mock，先失败再补最小 mock）

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/components/ui/EmptyState.tsx
import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-sm font-medium text-text-muted">{title}</p>
      {description && <p className="text-xs text-text-subtle">{description}</p>}
      {action}
    </div>
  )
}
```

```tsx
// frontend/src/components/ui/LoadingState.tsx
import { Skeleton } from './Skeleton'

export function LoadingState() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  )
}
```

```tsx
// Dashboard.tsx / KnowledgeBase.tsx / KnowledgeDetail.tsx 替换方向（核心片段）
// 1) 原生 input -> <Input />
// 2) 空态块 -> <EmptyState />
// 3) 加载骨架 -> <LoadingState />
// 4) CTA / 次按钮 -> <Button variant="primary|secondary|ghost" />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test:run src/pages/__tests__/Dashboard.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/pages/KnowledgeBase.tsx frontend/src/pages/KnowledgeDetail.tsx frontend/src/components/ui/EmptyState.tsx frontend/src/components/ui/LoadingState.tsx frontend/src/pages/__tests__/Dashboard.test.tsx
git commit -m "feat(pages): migrate core pages to unified design primitives"
```

---

### Task 7: Uiverse 融合落地与最终回归

**Files:**
- Modify: `frontend/src/components/ui/Button.tsx`
- Modify: `frontend/src/components/ui/Spinner.tsx`
- Modify: `frontend/src/components/ui/Tooltip.tsx` (new if absent)
- Modify: `frontend/src/components/modals/*.tsx`（按使用量逐个接入 ModalShell）
- Test: `frontend/src/components/ui/__tests__/Button.test.tsx`
- Test: `frontend/src/components/ui/__tests__/ModalShell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/ui/__tests__/Button.test.tsx (新增断言)
it('applies primary variant class', () => {
  render(<Button variant="primary">开始复习</Button>)
  expect(screen.getByRole('button', { name: '开始复习' })).toHaveClass('bg-primary-btn')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test:run src/components/ui/__tests__/Button.test.tsx`  
Expected: FAIL（若 class 不匹配）

- [ ] **Step 3: Write minimal implementation**

```tsx
// Button.tsx（融合 Uiverse 的边框高光与轻微光晕，不引入高频持续动画）
<button
  className="
    relative overflow-hidden rounded-md
    before:absolute before:inset-0 before:opacity-0 before:transition-opacity
    before:duration-200 before:content-['']
    hover:before:opacity-100 before:bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.25),transparent_60%)]
  "
>
  ...
</button>
```

```tsx
// Tooltip.tsx（轻量实现）
import type { ReactNode } from 'react'

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-[#18181b] px-2 py-1 text-[11px] text-text-secondary opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test:run`  
Expected: PASS（所有用例通过）

Run: `cd frontend && pnpm lint`  
Expected: PASS（无新增 lint error）

Run: `cd frontend && pnpm build`  
Expected: PASS（构建成功）

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/Button.tsx frontend/src/components/ui/Spinner.tsx frontend/src/components/ui/Tooltip.tsx frontend/src/components/modals
git commit -m "feat(ui): integrate uiverse-inspired effects with unified motion rules"
```

---

## Self-Review

### 1) Spec coverage
- 视觉主线（70% 极简 + 30% 科技感）：Task 2、3、5、7 覆盖。
- 中动效（160-260ms + reduced-motion）：Task 2、4、5、7 覆盖。
- 混合 Uiverse 策略：Task 3、7 覆盖。
- 页面全覆盖（导航/首页/知识库/弹窗）：Task 4、5、6、7 覆盖。
- 状态体系（loading/empty/error/success）：Task 3、6 覆盖（error/success 在页面动作组件内联实现）。

### 2) Placeholder scan
- 无 `TODO/TBD/implement later`。
- 每个任务含可执行命令、预期结果、最小代码片段。

### 3) Type consistency
- `Button` 统一 `variant/size`。
- `ModalShell` 统一 `open/onClose`。
- `Input` 使用标准 `InputHTMLAttributes`，与现有页面替换兼容。

---

Plan complete and saved to `docs/superpowers/plans/2026-03-29-frontend-ui-motion-implementation.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
