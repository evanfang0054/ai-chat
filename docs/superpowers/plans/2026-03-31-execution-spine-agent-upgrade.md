# Execution Spine & Agent Runtime Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不推翻现有模块边界的前提下，同时完成方案 A（执行主链路收口）和方案 B（tool / agent 能力升级），让 `ai-chat` 的 session、input intent、run、message、tool execution、diagnostics、retry / repair 与浏览器验收收成一条统一执行主线。

**Architecture:** 先沿现有 `packages/shared -> apps/api -> apps/web` 边界统一 session/run/message/tool 的共享契约、历史投影和流式事件，再在 API 内补轻量 `intent routing + agent loop + retry/fallback/repair + diagnostics` 运行时能力。前端继续沿 `services + stores + pages + components` 分层推进，把 chat domain state 与副作用出口收口到 store，不引入独立 orchestration framework。

**Tech Stack:** TypeScript, NestJS, Prisma, React, Vite, Zustand, LangChainJS, pnpm workspace, Jest, Vitest

---

## Current implementation status

- 已落地：shared run / tool / chat 契约已收口到统一 execution spine 语义；API 已接入 `intent routing`、`AgentRunContext`、渐进式有限多步 agent loop、OpenAI-compatible tool call 兼容、基础 repair 事件；schedule run / manual retry 已复用统一 `agentService.execute(...)` 主线，并显式绑定 `scheduleId` / `runId` / `sessionId` / `messageId` / `requestId`。
- 已验证：`apps/api/src/modules/agent/agent.service.spec.ts` 已覆盖多步 loop 与 legacy tool call shape；浏览器已验证过 tool protocol 修复后 Chat 链路可完成运行，不再触发 `INVALID_TOOL_RESULTS`。
- 未完成：前端 chat 状态与副作用出口尚未完全收口，`apps/web/src/pages/chat/ChatPage.tsx` 仍保留部分流式 orchestration；runs / schedules 的串联 diagnostics 视图与最终全链路浏览器验收仍需补齐。
- 结论：本计划需要继续作为真实待办清单使用，尤其聚焦 Web 收口、diagnostics projection 补强与最终 `agent-browser` 全链路验收；在这些项全部真实完成前，不应视为整体完成。

---

## File Structure Map

### Shared contracts
- Modify: `packages/shared/src/schedule.ts` — 定义统一 `RunStatus` / `RunStage` / `RunTriggerSource` / `FailureCategory` / `RunSummary` / `RunDiagnostics`
- Modify: `packages/shared/src/tool.ts` — 把 `ToolExecutionSummary` 升级为执行治理契约，补 `runId` / `messageId` / progress / retryability / cancelability
- Modify: `packages/shared/src/chat.ts` — 统一 chat 历史 timeline 与 SSE/stream event contract，显式表达 session/run/message/tool 关联
- Modify: `packages/shared/src/index.ts` — 导出新增共享契约

### API execution spine (方案 A)
- Modify: `apps/api/src/modules/chat/chat.types.ts` — chat timeline projection 与 stream payload 对齐 shared contract
- Modify: `apps/api/src/modules/chat/chat.service.ts` — 聚合 session/run/message/tool projection，明确 schedule 触发与 session 关系
- Modify: `apps/api/src/modules/chat/chat.controller.ts` — `/chat/stream` 切换为统一事件模型
- Modify: `apps/api/src/modules/schedule/schedule.types.ts` — 复用 shared run 语义
- Modify: `apps/api/src/modules/schedule/schedule.service.ts` — 对外返回统一 diagnostics projection
- Modify: `apps/api/src/modules/schedule/schedule-runner.service.ts` — 用统一 execution request 驱动 schedule run，并显式绑定 chat session / run / message

### API runtime upgrade (方案 B)
- Modify: `apps/api/src/modules/agent/agent.types.ts` — 定义 `ExecutionRequest`、`IntentRouteResult`、`AgentRunContext`、多步 `AgentLoopEvent`
- Create: `apps/api/src/modules/agent/agent-runtime.utils.ts` — 最小失败映射、retry/fallback/repair helper
- Create: `apps/api/src/modules/agent/agent-intent-router.ts` — 轻量输入意图路由，区分 chat / schedule / retry / diagnostics
- Modify: `apps/api/src/modules/agent/agent.service.ts` — 从单轮 tool loop 升级为渐进式有限多步 agent loop
- Modify: `apps/api/src/modules/tool/tool.types.ts` — 定义 tool runtime contract、progress、cancel、partial result、governance flags
- Modify: `apps/api/src/modules/tool/tool.service.ts` — tool execution 状态机、失败分类、progress、retry / cancel / repair 入口

### API tests
- Modify: `apps/api/src/modules/chat/chat.controller.spec.ts`
- Modify: `apps/api/src/modules/agent/agent.service.spec.ts`
- Modify: `apps/api/src/modules/tool/tool.service.spec.ts`
- Modify: `apps/api/src/modules/schedule/schedule-runner.service.spec.ts`
- Modify: `apps/api/src/modules/schedule/schedule.service.spec.ts`
- Modify: `apps/api/src/modules/schedule/schedule-tick.processor.spec.ts`

### Web state & projection
- Modify: `apps/web/src/services/chat.ts` — 统一 timeline / SSE DTO 解析
- Modify: `apps/web/src/services/schedule.ts` — 统一 runs / schedules diagnostics DTO 解析
- Modify: `apps/web/src/stores/chat-store.ts` — 收口 session/run/message/tool state 与副作用出口
- Modify: `apps/web/src/pages/chat/ChatPage.tsx` — 页面仅负责交互，流式副作用交给 store action
- Modify: `apps/web/src/pages/runs/RunsPage.tsx` — 展示可串联诊断视图
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx` — 展示 schedule 与 session/run 绑定摘要
- Modify: `apps/web/src/lib/api.ts` — 统一错误类别到 UI 文案映射
- Modify: `apps/web/src/components/chat/MessageList.tsx` — 展示统一 message/run timeline
- Modify: `apps/web/src/components/chat/ToolExecutionList.tsx` — 展示 tool governance 字段

### Web tests
- Modify: `apps/web/src/__tests__/chat-store.test.ts`
- Modify: `apps/web/src/__tests__/chat-page.test.tsx`
- Modify: `apps/web/src/__tests__/runs-page.test.tsx`
- Modify: `apps/web/src/__tests__/schedules-page.test.tsx`
- Modify: `apps/web/src/__tests__/schedule-service.test.ts`

### Browser acceptance
- Reuse existing dev stack — `pnpm db:up`, `pnpm --filter @ai-chat/api dev`, `pnpm --filter @ai-chat/web dev`
- Final verification must use **`agent-browser` skill** for Chat、tool、schedule、runs 全链路验收

---

### Task 1: 收口 shared 主线契约，显式表达 session / run / message / tool 关系

**Files:**
- Modify: `packages/shared/src/schedule.ts`
- Modify: `packages/shared/src/tool.ts`
- Modify: `packages/shared/src/chat.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `pnpm --filter @ai-chat/shared exec tsc --noEmit`

- [ ] **Step 1: 在 `schedule.ts` 定义统一 run 契约**

```ts
export type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type RunStage =
  | 'PREPARING'
  | 'ROUTING'
  | 'MODEL_CALLING'
  | 'TOOL_RUNNING'
  | 'REPAIRING'
  | 'PERSISTING'
  | 'FINALIZING';

export type RunTriggerSource = 'USER' | 'SCHEDULE' | 'MANUAL_RETRY' | 'DIAGNOSTICS_REPLAY';

export type FailureCategory =
  | 'INPUT_ERROR'
  | 'TOOL_ERROR'
  | 'MODEL_ERROR'
  | 'DEPENDENCY_ERROR'
  | 'TIMEOUT_ERROR'
  | 'SYSTEM_ERROR'
  | 'CANCELLED';

export interface RunSummary {
  id: string;
  sessionId: string | null;
  messageId: string | null;
  scheduleId: string | null;
  status: RunStatus;
  stage: RunStage;
  triggerSource: RunTriggerSource;
  failureCategory: FailureCategory | null;
  failureCode: string | null;
  failureMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}
```

- [ ] **Step 2: 在 `schedule.ts` 让 schedule run 复用统一 run 语义**

```ts
export interface RunDiagnosticsSummary extends RunSummary {
  requestId: string | null;
  durationMs: number | null;
  toolExecutionCount: number;
  retryCount: number;
  lastRepairAction: string | null;
}

export interface ScheduleRunSummary extends RunDiagnosticsSummary {
  scheduleTitle: string;
  taskPromptSnapshot: string;
  resultSummary: string | null;
}
```

- [ ] **Step 3: 在 `tool.ts` 定义 tool governance contract**

```ts
export type ToolExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface ToolExecutionSummary {
  id: string;
  sessionId: string;
  runId: string | null;
  messageId: string | null;
  toolName: ToolName;
  status: ToolExecutionStatus;
  progressMessage: string | null;
  input: string | null;
  output: string | null;
  partialOutput: string | null;
  errorCategory: FailureCategory | null;
  errorMessage: string | null;
  canRetry: boolean;
  canCancel: boolean;
  startedAt: string | null;
  finishedAt: string | null;
}
```

- [ ] **Step 4: 在 `chat.ts` 统一历史 timeline 与实时事件 contract**

```ts
export interface ChatTimelineEntry {
  kind: 'message' | 'tool_execution' | 'run_status';
  id: string;
  sessionId: string;
  runId: string | null;
  messageId: string | null;
  createdAt: string;
}

export type ChatRunEvent =
  | { type: 'run_started'; run: RunSummary; session: ChatSessionSummary; message: ChatMessage }
  | { type: 'run_stage_changed'; run: RunSummary }
  | { type: 'text_delta'; runId: string; messageId: string; textDelta: string }
  | { type: 'tool_started'; toolExecution: ToolExecutionSummary }
  | { type: 'tool_progressed'; toolExecution: ToolExecutionSummary }
  | { type: 'tool_completed'; toolExecution: ToolExecutionSummary }
  | { type: 'tool_failed'; toolExecution: ToolExecutionSummary }
  | { type: 'run_repaired'; run: RunSummary; repairAction: string }
  | { type: 'run_completed'; run: RunSummary; message: ChatMessage }
  | { type: 'run_failed'; run: RunSummary };

export interface GetChatTimelineResponse {
  session: ChatSessionSummary;
  run: RunSummary | null;
  messages: ChatMessage[];
  toolExecutions: ToolExecutionSummary[];
  timeline: ChatTimelineEntry[];
}
```

- [ ] **Step 5: 导出新增共享契约并跑类型检查**

```ts
export * from './auth';
export * from './user';
export * from './chat';
export * from './tool';
export * from './schedule';
```

Run: `pnpm --filter @ai-chat/shared exec tsc --noEmit`
Expected: 退出码为 0，无类型错误

- [ ] **Step 6: 提交 shared 契约收口**

```bash
git add packages/shared/src/schedule.ts packages/shared/src/tool.ts packages/shared/src/chat.ts packages/shared/src/index.ts
git commit -m "feat: unify execution spine shared contracts"
```

---

### Task 2: 增加输入意图路由，先分类再进入执行主线

**Files:**
- Modify: `apps/api/src/modules/agent/agent.types.ts`
- Create: `apps/api/src/modules/agent/agent-intent-router.ts`
- Modify: `apps/api/src/modules/agent/agent.service.spec.ts`
- Test: `pnpm --filter @ai-chat/api test -- agent.service.spec.ts`

- [ ] **Step 1: 先写 intent routing 测试**

```ts
it('routes retry requests into manual retry intent', () => {
  expect(routeExecutionIntent({ triggerSource: 'MANUAL_RETRY', prompt: 'retry run-1' })).toEqual(
    expect.objectContaining({
      intent: 'manual_retry',
      triggerSource: 'MANUAL_RETRY'
    })
  );
});
```

- [ ] **Step 2: 在 `agent.types.ts` 定义 execution request 与 intent route 结果**

```ts
export interface ExecutionRequest {
  requestId: string;
  userId: string;
  sessionId: string;
  prompt: string;
  history: AgentHistoryMessage[];
  triggerSource: RunTriggerSource;
  scheduleId?: string;
  runId?: string;
  retryOfRunId?: string;
}

export type ExecutionIntent = 'chat' | 'schedule' | 'manual_retry' | 'diagnostics_replay';

export interface IntentRouteResult {
  intent: ExecutionIntent;
  triggerSource: RunTriggerSource;
  allowTools: boolean;
  maxIterations: number;
}
```

- [ ] **Step 3: 在 `agent-intent-router.ts` 实现轻量分类函数**

```ts
export function routeExecutionIntent(input: ExecutionRequest): IntentRouteResult {
  if (input.triggerSource === 'SCHEDULE') {
    return { intent: 'schedule', triggerSource: 'SCHEDULE', allowTools: true, maxIterations: 2 };
  }

  if (input.triggerSource === 'MANUAL_RETRY') {
    return { intent: 'manual_retry', triggerSource: 'MANUAL_RETRY', allowTools: true, maxIterations: 2 };
  }

  return { intent: 'chat', triggerSource: 'USER', allowTools: true, maxIterations: 2 };
}
```

- [ ] **Step 4: 运行 agent 类型与 routing 测试**

Run: `pnpm --filter @ai-chat/api test -- agent.service.spec.ts`
Expected: routing 断言通过，现有 agent spec 仍全绿

- [ ] **Step 5: 提交 intent routing**

```bash
git add apps/api/src/modules/agent/agent.types.ts apps/api/src/modules/agent/agent-intent-router.ts apps/api/src/modules/agent/agent.service.spec.ts
git commit -m "refactor: add execution intent routing"
```

---

### Task 3: 定义 AgentRunContext 与可串联 diagnostics 视角

**Files:**
- Modify: `apps/api/src/modules/agent/agent.types.ts`
- Create: `apps/api/src/modules/agent/agent-runtime.utils.ts`
- Modify: `apps/api/src/modules/agent/agent.service.spec.ts`
- Test: `pnpm --filter @ai-chat/api test -- agent.service.spec.ts`

- [ ] **Step 1: 先写 diagnostics context 测试**

```ts
it('builds run context with request, session, run and schedule identifiers', () => {
  expect(buildRunContext(input)).toEqual(
    expect.objectContaining({
      requestId: 'req-1',
      sessionId: 'session-1',
      runId: 'run-1',
      scheduleId: 'schedule-1'
    })
  );
});
```

- [ ] **Step 2: 在 `agent.types.ts` 定义 `AgentRunContext` 与 loop 事件**

```ts
export interface AgentRunContext {
  requestId: string;
  runId: string | null;
  sessionId: string;
  userId: string;
  scheduleId: string | null;
  triggerSource: RunTriggerSource;
  iteration: number;
  maxIterations: number;
  abortSignal?: AbortSignal;
}

export type AgentLoopEvent =
  | { type: 'run-started'; runId: string | null }
  | { type: 'run-stage-changed'; stage: RunStage }
  | { type: 'iteration-started'; iteration: number }
  | { type: 'text-delta'; messageId: string; textDelta: string }
  | { type: 'tool-started'; toolExecution: ToolExecutionSummary }
  | { type: 'tool-progressed'; toolExecution: ToolExecutionSummary }
  | { type: 'tool-completed'; toolExecution: ToolExecutionSummary }
  | { type: 'tool-failed'; toolExecution: ToolExecutionSummary }
  | { type: 'run-repaired'; repairAction: string }
  | { type: 'run-completed' }
  | { type: 'run-failed'; error: AgentFailureDetails };
```

- [ ] **Step 3: 在 `agent-runtime.utils.ts` 增加 context builder 与失败映射**

```ts
export function buildRunContext(input: ExecutionRequest, maxIterations = 2): AgentRunContext {
  return {
    requestId: input.requestId,
    runId: input.runId ?? null,
    sessionId: input.sessionId,
    userId: input.userId,
    scheduleId: input.scheduleId ?? null,
    triggerSource: input.triggerSource,
    iteration: 0,
    maxIterations
  };
}

export function toModelFailure(error: unknown): AgentFailureDetails {
  return {
    status: 'FAILED',
    stage: 'MODEL_CALLING',
    failureCategory: 'MODEL_ERROR',
    failureCode: 'MODEL_CALL_FAILED',
    errorMessage: error instanceof Error ? error.message : 'Model call failed'
  };
}
```

- [ ] **Step 4: 运行受影响测试**

Run: `pnpm --filter @ai-chat/api test -- agent.service.spec.ts`
Expected: context 与 failure mapping 断言通过

- [ ] **Step 5: 提交 run context 与 diagnostics 视角**

```bash
git add apps/api/src/modules/agent/agent.types.ts apps/api/src/modules/agent/agent-runtime.utils.ts apps/api/src/modules/agent/agent.service.spec.ts
git commit -m "refactor: add unified run diagnostics context"
```

---

### Task 4: 把 agent 从单轮 tool loop 升级为有限多步 agent loop

**Files:**
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Modify: `apps/api/src/modules/agent/agent.service.spec.ts`
- Test: `pnpm --filter @ai-chat/api test -- agent.service.spec.ts`

- [ ] **Step 1: 先写多步 agent loop 测试**

```ts
it('supports a bounded two-step loop with tool result fed back into the model', async () => {
  const events = await collectEvents(service.streamChatReply(input));

  expect(events.map((event) => event.type)).toEqual([
    'run-started',
    'run-stage-changed',
    'iteration-started',
    'run-stage-changed',
    'tool-started',
    'tool-completed',
    'iteration-started',
    'run-stage-changed',
    'run-completed'
  ]);
});
```

- [ ] **Step 2: 在 `agent.service.ts` 实现有限循环骨架**

```ts
async *streamChatReply(input: ExecutionRequest): AsyncGenerator<AgentLoopEvent> {
  const route = routeExecutionIntent(input);
  const context = buildRunContext(input, route.maxIterations);

  yield { type: 'run-started', runId: context.runId };
  yield { type: 'run-stage-changed', stage: 'ROUTING' };

  for (let iteration = 1; iteration <= context.maxIterations; iteration += 1) {
    yield { type: 'iteration-started', iteration };
    yield { type: 'run-stage-changed', stage: 'MODEL_CALLING' };

    const result = await this.invokeModelOnce(input, { ...context, iteration });
    if (!result.toolCall) {
      yield { type: 'run-completed' };
      return;
    }

    yield { type: 'run-stage-changed', stage: 'TOOL_RUNNING' };
    yield* this.runToolCall(result.toolCall, { ...context, iteration });
  }

  yield { type: 'run-failed', error: toModelFailure(new Error('Agent loop exhausted')) };
}
```

- [ ] **Step 3: 为超过最大迭代次数补失败测试**

```ts
it('fails when the agent loop exceeds max iterations', async () => {
  const events = await collectEvents(service.streamChatReply(input));
  expect(events.at(-1)).toEqual({
    type: 'run-failed',
    error: expect.objectContaining({ failureCode: 'MODEL_CALL_FAILED' })
  });
});
```

- [ ] **Step 4: 运行 agent loop 测试**

Run: `pnpm --filter @ai-chat/api test -- agent.service.spec.ts`
Expected: 单轮与多步路径都通过，最大迭代边界断言通过

- [ ] **Step 5: 提交有限多步 agent loop**

```bash
git add apps/api/src/modules/agent/agent.service.ts apps/api/src/modules/agent/agent.service.spec.ts
git commit -m "feat: add bounded agent loop runtime"
```

---

### Task 5: 把 tool execution 从“功能记录”升级成执行治理层

**Files:**
- Modify: `apps/api/src/modules/tool/tool.types.ts`
- Modify: `apps/api/src/modules/tool/tool.service.ts`
- Modify: `apps/api/src/modules/tool/tool.service.spec.ts`
- Test: `pnpm --filter @ai-chat/api test -- tool.service.spec.ts`

- [ ] **Step 1: 先写 tool governance 测试**

```ts
it('marks failed tool executions as retryable but not cancelable after completion', async () => {
  const failed = await service.failToolExecution('tool-1', {
    failureCategory: 'TOOL_ERROR',
    errorMessage: 'boom'
  });

  expect(failed.canRetry).toBe(true);
  expect(failed.canCancel).toBe(false);
});
```

- [ ] **Step 2: 在 `tool.types.ts` 定义 progress / cancel / partial result 输入**

```ts
export interface ToolProgressInput {
  stage: RunStage;
  message: string;
}

export interface ToolFailureInput {
  failureCategory: FailureCategory;
  errorMessage: string;
  partialOutput?: string;
}

export interface ToolCancelInput {
  reason: string;
}
```

- [ ] **Step 3: 在 `tool.service.ts` 增加 progress / fail / cancel / repair 入口**

```ts
async cancelToolExecution(id: string, input: ToolCancelInput) {
  return this.prisma.toolExecution.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      errorMessage: input.reason,
      finishedAt: new Date(),
      canRetry: true,
      canCancel: false
    }
  });
}

async failToolExecution(id: string, input: ToolFailureInput) {
  return this.prisma.toolExecution.update({
    where: { id },
    data: {
      status: 'FAILED',
      errorCategory: input.failureCategory,
      errorMessage: input.errorMessage,
      partialOutput: input.partialOutput ?? null,
      finishedAt: new Date(),
      canRetry: true,
      canCancel: false
    }
  });
}
```

- [ ] **Step 4: 运行 tool service 测试**

Run: `pnpm --filter @ai-chat/api test -- tool.service.spec.ts`
Expected: progress、cancel、failed、retryability 断言通过

- [ ] **Step 5: 提交 tool governance contract**

```bash
git add apps/api/src/modules/tool/tool.types.ts apps/api/src/modules/tool/tool.service.ts apps/api/src/modules/tool/tool.service.spec.ts
git commit -m "feat: promote tool execution to governance layer"
```

---

### Task 6: 统一 retry / fallback / repair 语义，而不是零散异常分支

**Files:**
- Modify: `apps/api/src/modules/agent/agent-runtime.utils.ts`
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Modify: `apps/api/src/modules/agent/agent.service.spec.ts`
- Modify: `apps/api/src/modules/chat/chat.controller.spec.ts`
- Test: `pnpm --filter @ai-chat/api test -- agent.service.spec.ts chat.controller.spec.ts`

- [ ] **Step 1: 先写 fallback / repair 测试**

```ts
it('emits run-repaired after fallback clears partial assistant output', async () => {
  const events = await collectEvents(service.streamChatReply(input));
  expect(events).toContainEqual({
    type: 'run-repaired',
    repairAction: 'clear_partial_assistant_output'
  });
});
```

- [ ] **Step 2: 在 `agent-runtime.utils.ts` 增加 retryable / repair helper**

```ts
export function isRetryableFailure(category: FailureCategory) {
  return category === 'MODEL_ERROR' || category === 'TIMEOUT_ERROR' || category === 'DEPENDENCY_ERROR';
}

export function createRepairAction(action: 'clear_partial_assistant_output' | 'reset_tool_results') {
  return { type: 'run-repaired' as const, repairAction: action };
}
```

- [ ] **Step 3: 在 `agent.service.ts` 把 fallback 与 repair 显式发成事件**

```ts
catch (error) {
  const failure = toModelFailure(error);
  if (isRetryableFailure(failure.failureCategory)) {
    yield { type: 'run-stage-changed', stage: 'REPAIRING' };
    yield createRepairAction('clear_partial_assistant_output');
  }

  yield { type: 'run-failed', error: failure };
}
```

- [ ] **Step 4: 在 `chat.service.ts` 对 repair 后的历史投影做结构收口**

```ts
async clearPartialAssistantMessage(messageId: string) {
  return this.prisma.chatMessage.update({
    where: { id: messageId },
    data: { content: '', status: 'FAILED' }
  });
}
```

- [ ] **Step 5: 运行 retry / repair 相关测试**

Run: `pnpm --filter @ai-chat/api test -- agent.service.spec.ts chat.controller.spec.ts`
Expected: fallback、repair、run_failed 事件链路断言通过

- [ ] **Step 6: 提交失败恢复模型统一化**

```bash
git add apps/api/src/modules/agent/agent-runtime.utils.ts apps/api/src/modules/agent/agent.service.ts apps/api/src/modules/chat/chat.service.ts apps/api/src/modules/agent/agent.service.spec.ts apps/api/src/modules/chat/chat.controller.spec.ts
git commit -m "refactor: unify retry fallback and repair semantics"
```

---

### Task 7: 明确 schedule run 与 chat session 的绑定关系

**Files:**
- Modify: `apps/api/src/modules/chat/chat.types.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-runner.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-runner.service.spec.ts`
- Modify: `apps/api/src/modules/schedule/schedule.service.spec.ts`
- Test: `pnpm --filter @ai-chat/api test -- schedule-runner.service.spec.ts schedule.service.spec.ts`

- [ ] **Step 1: 先写 schedule run / session 绑定测试**

```ts
it('creates or reuses a chat session and stores the binding on the run projection', async () => {
  await runner.processDueSchedules(now);

  expect(scheduleService.listRuns).toHaveReturnedWith(
    expect.objectContaining({
      runs: expect.arrayContaining([
        expect.objectContaining({ sessionId: expect.any(String) })
      ])
    })
  );
});
```

- [ ] **Step 2: 在 `chat.types.ts` 定义 schedule 触发时的 session 绑定类型**

```ts
export interface SessionBindingSummary {
  sessionId: string;
  source: 'created' | 'reused';
  firstMessageId: string | null;
}
```

- [ ] **Step 3: 在 `chat.service.ts` 提供显式 session 绑定入口**

```ts
async ensureSessionForSchedule(userId: string, scheduleId: string): Promise<SessionBindingSummary> {
  const existing = await this.findSessionForSchedule(userId, scheduleId);
  if (existing) {
    return { sessionId: existing.id, source: 'reused', firstMessageId: null };
  }

  const session = await this.createScheduleSession(userId, scheduleId);
  return { sessionId: session.id, source: 'created', firstMessageId: null };
}
```

- [ ] **Step 4: 在 `schedule-runner.service.ts` 使用显式绑定结果构造 execution request**

```ts
const binding = await this.chatService.ensureSessionForSchedule(schedule.userId, schedule.id);

const executionRequest: ExecutionRequest = {
  requestId: crypto.randomUUID(),
  userId: schedule.userId,
  sessionId: binding.sessionId,
  prompt: schedule.taskPrompt,
  history: [],
  triggerSource: 'SCHEDULE',
  scheduleId: schedule.id,
  runId: run.id
};
```

- [ ] **Step 5: 在 `schedule.service.ts` 返回 run / session / message / tool 汇总视角**

```ts
return {
  ...run,
  sessionId: run.chatSessionId,
  messageId: run.assistantMessageId,
  toolExecutionCount: run.toolExecutions.length
};
```

- [ ] **Step 6: 运行 schedule 绑定测试**

Run: `pnpm --filter @ai-chat/api test -- schedule-runner.service.spec.ts schedule.service.spec.ts`
Expected: schedule run 能清楚映射到 session / run / message / toolExecution

- [ ] **Step 7: 提交 session 与 schedule run 绑定强化**

```bash
git add apps/api/src/modules/chat/chat.types.ts apps/api/src/modules/chat/chat.service.ts apps/api/src/modules/schedule/schedule-runner.service.ts apps/api/src/modules/schedule/schedule.service.ts apps/api/src/modules/schedule/schedule-runner.service.spec.ts apps/api/src/modules/schedule/schedule.service.spec.ts
git commit -m "refactor: make schedule runs explicitly bind to chat sessions"
```

---

### Task 8: 统一 chat 历史记录模型与流式事件模型

**Files:**
- Modify: `apps/api/src/modules/chat/chat.controller.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Modify: `apps/api/src/modules/chat/chat.controller.spec.ts`
- Test: `pnpm --filter @ai-chat/api test -- chat.controller.spec.ts`

- [ ] **Step 1: 先写统一 contract 的 `/chat/stream` 测试**

```ts
it('streams the same identifiers used by the historical timeline projection', async () => {
  const chunks = await request(app.getHttpServer())
    .post('/chat/stream')
    .set('Authorization', `Bearer ${token}`)
    .send({ content: 'hi' })
    .buffer(true)
    .parse(textStreamParser);

  expect(chunks).toEqual(
    expect.arrayContaining([
      expect.stringContaining('run_started'),
      expect.stringContaining('messageId'),
      expect.stringContaining('run_completed')
    ])
  );
});
```

- [ ] **Step 2: 在 `chat.service.ts` 返回统一 timeline projection**

```ts
async getSessionTimeline(userId: string, sessionId: string): Promise<GetChatTimelineResponse> {
  const { session, messages } = await this.getSessionMessages(userId, sessionId);
  const toolExecutions = await this.listToolExecutionsForSession(sessionId);
  const run = await this.listLatestRunForSession(sessionId);

  return {
    session,
    run,
    messages,
    toolExecutions,
    timeline: buildTimelineEntries({ session, run, messages, toolExecutions })
  };
}
```

- [ ] **Step 3: 在 `chat.controller.ts` 用相同标识写流式事件**

```ts
writer.writeData({
  type: 'run_started',
  run: runSummary,
  session: sessionSummary,
  message: userMessageSummary
});

writer.writeData({
  type: 'text_delta',
  runId: runSummary.id,
  messageId: assistantMessageId,
  textDelta: event.textDelta
});
```

- [ ] **Step 4: 运行 chat controller 测试**

Run: `pnpm --filter @ai-chat/api test -- chat.controller.spec.ts`
Expected: 历史 timeline 与实时事件共享同一套 `sessionId/runId/messageId/toolExecutionId` 语义

- [ ] **Step 5: 提交历史 / 实时 contract 统一化**

```bash
git add apps/api/src/modules/chat/chat.controller.ts apps/api/src/modules/chat/chat.service.ts apps/api/src/modules/chat/chat.controller.spec.ts
git commit -m "refactor: unify chat history and streaming contracts"
```

---

### Task 9: 收口前端 chat 状态与副作用出口

**Files:**
- Modify: `apps/web/src/stores/chat-store.ts`
- Modify: `apps/web/src/services/chat.ts`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Modify: `apps/web/src/__tests__/chat-store.test.ts`
- Modify: `apps/web/src/__tests__/chat-page.test.tsx`
- Test: `pnpm --filter @ai-chat/web test -- chat-store.test.ts chat-page.test.tsx`

- [ ] **Step 1: 先写 store 副作用出口测试**

```ts
it('updates stream failure state from a single applyStreamEvent entrypoint', () => {
  useChatStore.getState().applyStreamEvent({ type: 'run_failed', run: failedRun });
  expect(useChatStore.getState().streamErrorMessage).toBe('quota exceeded');
});
```

- [ ] **Step 2: 在 `chat-store.ts` 收口 domain state 与唯一事件入口**

```ts
type ChatState = {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  currentRun: RunSummary | null;
  messages: ChatMessage[];
  toolExecutions: ToolExecutionSummary[];
  streamUiState: 'IDLE' | 'STREAMING' | 'FAILED';
  streamErrorMessage: string | null;
  applyStreamEvent: (event: ChatRunEvent) => void;
  hydrateTimeline: (timeline: GetChatTimelineResponse) => void;
};
```

- [ ] **Step 3: 在 `chat-store.ts` 把副作用挂到统一出口**

```ts
const onExecutionChanged = (state: ChatState) => {
  if (state.currentRun?.status === 'FAILED') {
    console.warn('run failed', { runId: state.currentRun.id, sessionId: state.currentSessionId });
  }
};
```

- [ ] **Step 4: 在 `ChatPage.tsx` 只消费 store projection，不再直接拼业务语义**

```tsx
const {
  currentRun,
  messages,
  toolExecutions,
  streamUiState,
  streamErrorMessage,
  applyStreamEvent,
  hydrateTimeline
} = useChatStore();
```

- [ ] **Step 5: 运行前端 chat 状态测试**

Run: `pnpm --filter @ai-chat/web test -- chat-store.test.ts chat-page.test.tsx`
Expected: 页面只绑定 UI，streaming / failed / completed 三态全部由 store 投影驱动

- [ ] **Step 6: 提交前端 chat 状态收口**

```bash
git add apps/web/src/stores/chat-store.ts apps/web/src/services/chat.ts apps/web/src/pages/chat/ChatPage.tsx apps/web/src/__tests__/chat-store.test.ts apps/web/src/__tests__/chat-page.test.tsx
git commit -m "refactor: centralize chat state and side effects"
```

---

### Task 10: 更新 RunsPage / SchedulesPage，提供可串联诊断视角

**Files:**
- Modify: `apps/web/src/services/schedule.ts`
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/__tests__/runs-page.test.tsx`
- Modify: `apps/web/src/__tests__/schedules-page.test.tsx`
- Modify: `apps/web/src/__tests__/schedule-service.test.ts`
- Test: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx schedules-page.test.tsx schedule-service.test.ts`

- [ ] **Step 1: 先写 runs diagnostics 测试**

```tsx
it('renders requestId, sessionId, runId and tool count together', async () => {
  mockedListRuns.mockResolvedValue({
    runs: [
      {
        id: 'run-1',
        requestId: 'req-1',
        sessionId: 'session-1',
        messageId: 'message-1',
        status: 'FAILED',
        stage: 'TOOL_RUNNING',
        failureCategory: 'TOOL_ERROR',
        failureCode: 'TOOL_EXECUTION_FAILED',
        toolExecutionCount: 1
      }
    ]
  });

  render(<RunsPage />);
  expect(await screen.findByText(/req-1/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 在 `services/schedule.ts` 统一解析 diagnostics DTO**

```ts
export function normalizeRunDiagnostics(run: ScheduleRunSummary): ScheduleRunSummary {
  return {
    ...run,
    status: run.status === 'SUCCEEDED' ? 'COMPLETED' : run.status
  };
}
```

- [ ] **Step 3: 在 `RunsPage.tsx` 展示串联视角**

```tsx
<div>Request ID: {selectedRun.requestId ?? '—'}</div>
<div>Session ID: {selectedRun.sessionId ?? '—'}</div>
<div>Run ID: {selectedRun.id}</div>
<div>Message ID: {selectedRun.messageId ?? '—'}</div>
<div>Failure Code: {selectedRun.failureCode ?? '—'}</div>
```

- [ ] **Step 4: 在 `SchedulesPage.tsx` 展示最近执行与 session 绑定摘要**

```tsx
<div className="text-sm text-[rgb(var(--foreground-secondary))]">
  Latest run: {schedule.latestRunStatus ?? '—'} · Session: {schedule.latestSessionId ?? '—'}
</div>
```

- [ ] **Step 5: 在 `api.ts` 统一错误分类到 UI 文案**

```ts
export function toUserFacingErrorMessage(category?: string | null, fallback?: string) {
  if (category === 'MODEL_ERROR') return '模型调用失败，请稍后重试。';
  if (category === 'TOOL_ERROR') return '工具执行失败，请检查运行详情。';
  if (category === 'TIMEOUT_ERROR') return '执行超时，请稍后重试。';
  return fallback ?? '请求失败，请稍后重试。';
}
```

- [ ] **Step 6: 运行 runs / schedules 诊断测试**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx schedules-page.test.tsx schedule-service.test.ts`
Expected: 页面可以直接回答 request/session/run/toolExecution 的关联，以及失败发生在哪个阶段

- [ ] **Step 7: 提交诊断视角统一化**

```bash
git add apps/web/src/services/schedule.ts apps/web/src/pages/runs/RunsPage.tsx apps/web/src/pages/schedules/SchedulesPage.tsx apps/web/src/lib/api.ts apps/web/src/__tests__/runs-page.test.tsx apps/web/src/__tests__/schedules-page.test.tsx apps/web/src/__tests__/schedule-service.test.ts
git commit -m "feat: surface linked execution diagnostics in web"
```

---

### Task 11: 跑阶段验收与最终浏览器验收

**Files:**
- Modify: `docs/superpowers/plans/2026-03-31-execution-spine-agent-upgrade.md`
- Test:
  - `pnpm --filter @ai-chat/shared exec tsc --noEmit`
  - `pnpm --filter @ai-chat/api test -- chat.controller.spec.ts agent.service.spec.ts tool.service.spec.ts schedule-runner.service.spec.ts schedule.service.spec.ts schedule-tick.processor.spec.ts`
  - `pnpm --filter @ai-chat/web test -- chat-store.test.ts chat-page.test.tsx runs-page.test.tsx schedules-page.test.tsx schedule-service.test.ts`
  - `pnpm --filter @ai-chat/api build`
  - `pnpm --filter @ai-chat/web build`

- [ ] **Step 1: 跑 shared / API / Web 自动化验收**

Run: `pnpm --filter @ai-chat/shared exec tsc --noEmit && pnpm --filter @ai-chat/api test -- chat.controller.spec.ts agent.service.spec.ts tool.service.spec.ts schedule-runner.service.spec.ts schedule.service.spec.ts schedule-tick.processor.spec.ts && pnpm --filter @ai-chat/web test -- chat-store.test.ts chat-page.test.tsx runs-page.test.tsx schedules-page.test.tsx schedule-service.test.ts`
Expected: shared、API、Web 受影响测试全绿

- [ ] **Step 2: 跑受影响 workspace build**

Run: `pnpm --filter @ai-chat/api build && pnpm --filter @ai-chat/web build`
Expected: 两个 workspace 构建通过

- [ ] **Step 3: 使用 `agent-browser` skill 做真实浏览器验收**

```md
浏览器验收清单：
1. 调用 `agent-browser` skill 启动真实浏览器验证
2. 登录后进入 `/chat`
3. 发送普通消息，确认出现 `run_started -> text_delta -> run_completed` 对应展示
4. 发送会触发 tool 的消息，确认 tool 卡片展示 progress、成功/失败、retry / cancel 能力
5. 进入 `/schedules`，创建一个短周期或近未来 one-time schedule
6. 等待自动触发后进入 `/runs`，确认看到 requestId / sessionId / runId / messageId / tool count
7. 触发一个失败场景，确认 Chat 页与 Runs 页显示一致 failure category / failure code / repair 结果
```

Expected: 页面状态连贯，流式展示与历史记录一致，runs / schedules 诊断信息足够回答“谁触发、卡在哪、为什么失败、是否被 repair 过”

- [ ] **Step 4: 记录最终验收结果并提交**

```bash
git add docs/superpowers/plans/2026-03-31-execution-spine-agent-upgrade.md
git commit -m "docs: record execution spine and runtime verification"
```

---

## Self-Review Checklist

- Spec coverage: 已覆盖方案 A（执行主链路收口）与方案 B（tool / agent 能力升级），并补上 session/run/message/tool 关联、intent routing、agent loop、retry / fallback / repair、diagnostics、browser 验收
- Placeholder scan: 无 `TODO` / `TBD` / “后续实现” 类占位表述
- Type consistency: 统一使用 `RunStatus` / `RunStage` / `RunTriggerSource` / `FailureCategory` / `ExecutionRequest` / `AgentRunContext` / `ChatRunEvent`

## Notes for Implementers

- 方案 A 与方案 B 都要做，但顺序必须是：先统一主线语义，再补 runtime 能力
- agent loop 只做**有限多步**，不要把本轮扩成 autonomous framework
- `agent-browser` 是最终浏览器验收的必选 skill，不要只停留在自动化测试
- 如果实现时发现 Prisma schema 缺少 `requestId` / `messageId` / `runId` / `partialOutput` / `canRetry` / `canCancel` 字段，就在对应 task 前插一个很小的数据层任务，不要顺手重写整套数据模型
- 前端副作用只允许从 store 的统一出口发出，不要继续把 run/tool 归并逻辑散落回页面
