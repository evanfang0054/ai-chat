# Chat Text Streaming Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/chat/stream` 在保持现有 tool loop 与 AI SDK data stream 协议不变的前提下，真正按增量文本块把 assistant 回复流式推到前端。

**Architecture:** 改动只收敛在 API 的 `AgentService` 流式模型调用主链路：把当前一次性 `invoke()` 改为 `stream()` 迭代消费，边读 chunk 边发 `text_delta`，同时把 chunk 聚合回最终 `AIMessage` 供现有 tool call 解析与后续 loop 继续复用。`ChatController` 的 `pipeDataStreamToResponse` 映射、`ChatPage` 的 `useChat({ streamProtocol: 'data' })`、以及 `LlmService` 的模型构造保持不变，验证重点放在 `AgentService` 单测与 `/chat/stream` e2e 的流式文本分片断言。

**Tech Stack:** NestJS, LangChainJS, @langchain/openai, AI SDK (`ai`, `@ai-sdk/react`), Jest, Supertest, TypeScript

---

## File Structure

### Files to modify
- `apps/api/src/modules/agent/agent.service.ts`
  - 把 `executeAgentLoop()` 的模型执行从 `invoke()` 改成 `stream()`。
  - 新增最小流式聚合辅助逻辑：消费 `AsyncIterable<AIMessageChunk>`、按 chunk 发 `text_delta`、最终聚合成可继续走 `readToolCalls()` 的消息对象。
  - 保持现有 `executeToolCall()`、repair loop、`readToolCalls()`、`readToolCallInput()` 语义不变。
- `apps/api/src/modules/agent/agent.service.spec.ts`
  - 现有单测从 mock `invoke()` 改为 mock `stream()`。
  - 新增增量文本块断言，确保事件顺序从“单个整段 `text_delta`”变成“多个分片 `text_delta` + 最终 `result.text` 聚合正确”。
  - 保留 tool failure / repair 相关测试，但同步改成基于 `stream()` 的 mock 形态。
- `apps/api/test/chat.e2e-spec.ts`
  - 这份文件当前还停留在旧的 `streamChatReply` mock 入口与旧事件名，需要先收敛到当前 `agentService.execute()` 主链路。
  - 最小目标是新增或改写一个 `/chat/stream` 用例，断言返回的 AI SDK data stream 中出现多个 `text` part，并最终持久化为完整 assistant message。

### Files expected to stay unchanged
- `apps/api/src/modules/chat/chat.controller.ts`
  - 继续把 `text_delta` 写成 `formatDataStreamPart('text', ...)`，不改协议。
- `apps/api/src/modules/llm/llm.service.ts`
  - 继续返回 `ChatOpenAI`；只有在实现时发现 provider 必须显式配置 streaming 才再调整，但本计划默认不改。
- `apps/web/src/pages/chat/ChatPage.tsx`
  - 继续使用 `useChat({ streamProtocol: 'data' })`，不引入手写 SSE 消费。

---

### Task 1: 把 AgentService 单轮模型调用改成真正的流式文本消费

**Files:**
- Modify: `apps/api/src/modules/agent/agent.service.ts:130-239`
- Test: `apps/api/src/modules/agent/agent.service.spec.ts`

- [x] **Step 1: 写一个失败中的单测，明确要求按 chunk 发出多个 `text_delta`**

在 `apps/api/src/modules/agent/agent.service.spec.ts` 中，把当前 `createService()` 改成基于 `stream` mock，并新增一个最小 chunk helper。先让测试表达“模型分两段返回 `Hello` 和 ` world` 时，事件里也必须是两段”。

```ts
async function createChunkStream(...chunks: Array<{ content: string; tool_calls?: unknown[] }>) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function createService(options?: {
  stream?: jest.Mock;
  listDefinitions?: Array<{ name: string; description: string }>;
  getDefinition?: jest.Mock;
  startToolExecution?: jest.Mock;
}) {
  const stream =
    options?.stream ??
    jest.fn().mockReturnValue(
      createChunkStream(
        { content: 'Hello' },
        { content: ' world', tool_calls: [] }
      )
    );
  const bindTools = jest.fn().mockReturnValue({ stream });
  const llmService = {
    createChatModel: jest.fn().mockReturnValue({ bindTools })
  };
  const toolService = {
    listDefinitions: jest.fn().mockReturnValue(options?.listDefinitions ?? []),
    getDefinition: options?.getDefinition ?? jest.fn(),
    startToolExecution: options?.startToolExecution ?? jest.fn()
  };

  const { AgentService } = await import('./agent.service');
  const service = new AgentService(llmService as never, toolService as never);

  return { service, llmService, toolService, bindTools, stream };
}

it('streams text deltas chunk by chunk and returns the aggregated assistant text', async () => {
  const { service, stream } = await createService();
  const events: AgentLoopEvent[] = [];

  const result = await service.execute(
    {
      userId: 'user-1',
      sessionId: 'session-1',
      triggerSource: 'USER',
      history: [],
      prompt: 'Say hello'
    },
    (event) => events.push(event)
  );

  expect(stream).toHaveBeenCalled();
  expect(result.text).toBe('Hello world');
  expect(events).toEqual([
    expect.objectContaining({ type: 'run_stage_changed', run: expect.objectContaining({ stage: 'PREPARING' }) }),
    expect.objectContaining({ type: 'run_stage_changed', run: expect.objectContaining({ stage: 'MODEL_CALLING' }) }),
    expect.objectContaining({ type: 'text_delta', textDelta: 'Hello' }),
    expect.objectContaining({ type: 'text_delta', textDelta: ' world' }),
    expect.objectContaining({ type: 'run_stage_changed', run: expect.objectContaining({ status: 'COMPLETED', stage: 'FINALIZING' }) })
  ]);
});
```

- [x] **Step 2: 只跑这条单测，确认它先失败在 `stream` 尚未实现**

Run:
```bash
pnpm --filter @ai-chat/api test -- agent.service.spec.ts -t "streams text deltas chunk by chunk"
```

Expected: FAIL，且报错会落在 `toolAwareModel.stream is not a function`、`stream` 未被调用，或事件仍只产出单个整段 `text_delta`。

- [x] **Step 3: 在 `AgentService` 里新增最小流式聚合 helper**

在 `apps/api/src/modules/agent/agent.service.ts` 中，先加一个只服务当前场景的小 helper，不额外抽平台层。它的职责只有三件事：遍历 stream、按 chunk 回调文本、把最后的 chunk 聚成一个 `AIMessage` 兼容对象。

```ts
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';

private async collectStreamingResponse(
  stream: AsyncIterable<AIMessageChunk>,
  onText: (textDelta: string) => void
) {
  let aggregatedChunk: AIMessageChunk | null = null;

  for await (const chunk of stream) {
    const textDelta = this.readChunkText(chunk.content);
    if (textDelta) {
      onText(textDelta);
    }
    aggregatedChunk = aggregatedChunk ? aggregatedChunk.concat(chunk) : chunk;
  }

  if (!aggregatedChunk) {
    return new AIMessage({ content: '' });
  }

  return new AIMessage({
    content: aggregatedChunk.content,
    tool_calls: this.readToolCalls(aggregatedChunk),
    additional_kwargs: aggregatedChunk.additional_kwargs
  });
}
```

- [x] **Step 4: 把 `executeAgentLoop()` 里的 `invoke()` 改成 `stream()` + `collectStreamingResponse()`**

把 `apps/api/src/modules/agent/agent.service.ts:150-177` 这一段替换成真正的流式消费。核心约束：
1. `MODEL_CALLING` 阶段照旧；
2. 每个 chunk 到达就 append `text_delta`；
3. stream 完成后再统一读 tool calls；
4. `collectedText` 继续作为最终 assistant 持久化文本。

```ts
let response: AIMessage;
try {
  const responseStream = await this.withTimeout(
    toolAwareModel.stream(conversation),
    env.CHAT_STREAM_TIMEOUT_MS,
    'Agent LLM response stream setup'
  );

  response = await this.collectStreamingResponse(responseStream, (textDelta) => {
    collectedText += textDelta;
    appendEvent({
      type: 'text_delta',
      runId: context.runId ?? randomUUID(),
      messageId: context.messageId ?? `assistant-${context.sessionId}`,
      textDelta
    });
  });
} catch (error) {
  throw this.wrapModelError(error, 'MODEL_CALLING');
}

const toolCalls = this.readToolCalls(response);
if (toolCalls.length === 0) {
  return collectedText;
}
```

- [x] **Step 5: 让超时覆盖整个流式消费，而不只是 stream 建立阶段**

上一步的 `withTimeout(toolAwareModel.stream(...))` 只覆盖“拿到 iterable”，还没有覆盖 `for await` 的完整生命周期。把超时包裹移动到整个聚合 promise 上，避免长时间挂住的流永远不超时。

```ts
response = await this.withTimeout(
  this.collectStreamingResponse(toolAwareModel.stream(conversation), (textDelta) => {
    collectedText += textDelta;
    appendEvent({
      type: 'text_delta',
      runId: context.runId ?? randomUUID(),
      messageId: context.messageId ?? `assistant-${context.sessionId}`,
      textDelta
    });
  }),
  env.CHAT_STREAM_TIMEOUT_MS,
  'Agent LLM response'
);
```

这样保留现有 `wrapModelError()` 与 timeout 测试语义，不需要为本次修复额外引入 abort controller。

- [x] **Step 6: 重新跑新增单测，确认 chunk 级文本流已通过**

已完成：`apps/api/src/modules/agent/agent.service.ts` 现改为通过 `toolAwareModel.stream(...)` 读取模型流，并在 `withTimeout()` 内包裹“建立 stream + 消费 stream”的整个流程；`apps/api/src/modules/agent/agent.service.spec.ts` 已整体切换为 `stream` mock 语义，当前 `pnpm --filter @ai-chat/api exec jest --config ./test/jest-unit.json src/modules/agent/agent.service.spec.ts --runInBand --verbose` 通过（11 passed）。

Run:
```bash
pnpm --filter @ai-chat/api test -- agent.service.spec.ts -t "streams text deltas chunk by chunk"
```

Expected: PASS，且 `result.text === 'Hello world'`，事件里是两个 `text_delta`，不是单个整段。

- [ ] **Step 7: 提交这一小步**

```bash
git add apps/api/src/modules/agent/agent.service.ts apps/api/src/modules/agent/agent.service.spec.ts
git commit -m "fix(api): stream assistant text chunks from agent loop"
```

---

### Task 2: 收敛并补齐 AgentService 现有测试到 `stream()` 语义

**Files:**
- Modify: `apps/api/src/modules/agent/agent.service.spec.ts`

- [x] **Step 1: 把现有 happy-path 测试从 `invoke` 断言改成 `stream` 断言**

把现有 `converts chat history into LangChain messages and emits text deltas` 用例改成下面这种形式：保留“history 被正确转换”的断言，但执行入口与结果都基于 `stream()`。

```ts
it('converts chat history into LangChain messages and emits text deltas', async () => {
  const stream = jest.fn().mockReturnValue(
    createChunkStream({ content: 'Hello' }, { content: ' world', tool_calls: [] })
  );
  const { service, llmService, toolService, bindTools } = await createService({ stream });
  const events: AgentLoopEvent[] = [];

  const result = await service.execute(
    {
      userId: 'user-1',
      sessionId: 'session-1',
      triggerSource: 'USER',
      history: [
        { role: 'SYSTEM', content: 'You are helpful.' },
        { role: 'USER', content: 'Hi' },
        { role: 'ASSISTANT', content: 'Hello!' }
      ],
      prompt: 'Tell me something nice'
    },
    (event) => events.push(event)
  );

  expect(llmService.createChatModel).toHaveBeenCalled();
  expect(bindTools).toHaveBeenCalled();
  expect(toolService.startToolExecution).not.toHaveBeenCalled();
  expect(stream).toHaveBeenCalledWith([
    expect.objectContaining({ content: expect.stringContaining('If the user asks you to perform an action') }),
    expect.objectContaining({ content: 'You are helpful.' }),
    expect.objectContaining({ content: 'Hi' }),
    expect.objectContaining({ content: 'Hello!' }),
    expect.objectContaining({ content: 'Tell me something nice' })
  ]);
  expect(result.text).toBe('Hello world');
  expect(events).toEqual([
    expect.objectContaining({ type: 'run_stage_changed', run: expect.objectContaining({ status: 'RUNNING', stage: 'PREPARING' }) }),
    expect.objectContaining({ type: 'run_stage_changed', run: expect.objectContaining({ status: 'RUNNING', stage: 'MODEL_CALLING' }) }),
    expect.objectContaining({ type: 'text_delta', textDelta: 'Hello', runId: expect.any(String), messageId: 'assistant-session-1' }),
    expect.objectContaining({ type: 'text_delta', textDelta: ' world', runId: expect.any(String), messageId: 'assistant-session-1' }),
    expect.objectContaining({ type: 'run_stage_changed', run: expect.objectContaining({ status: 'COMPLETED', stage: 'FINALIZING' }) })
  ]);
});
```

- [x] **Step 2: 把 schedule prompt 类测试的 mock 全部换成 `stream()` 返回单 chunk**

这些测试本质上只关心 system prompt，不关心流式分片数量，所以统一改成返回单 chunk 即可，避免保留 `invoke`/`stream` 双轨。

```ts
const stream = jest.fn().mockReturnValue(createChunkStream({ content: 'ok', tool_calls: [] }));

const { service, bindTools } = await createService({
  stream,
  listDefinitions: [{ name: 'manage_schedule', description: 'Create, list, update, enable, or disable schedules.' }],
  getDefinition: jest.fn().mockReturnValue({ schema: { parse: jest.fn() } })
});

expect(bindTools).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ tool_choice: 'auto' }));
expect(stream).toHaveBeenCalledWith(
  expect.arrayContaining([
    expect.objectContaining({ content: expect.stringContaining('translate phrases like "every 10 seconds"') }),
    expect.objectContaining({ content: expect.stringContaining('create a short title instead of asking for one') })
  ])
);
```

- [x] **Step 3: 保持 timeout 测试仍能覆盖整条流式调用**

把 timeout 用例从“`invoke` 返回永不 resolve 的 Promise”改成“`stream` 返回一个永不结束的 async iterable”，这样才能证明超时仍覆盖整个流。最简单的 helper 如下：

```ts
async function* neverEndingStream() {
  yield { content: 'Hello' };
  await new Promise(() => undefined);
}

it('fails the run when LLM invocation times out', async () => {
  jest.useFakeTimers();
  const { service } = await createService({
    stream: jest.fn().mockReturnValue(neverEndingStream())
  });
  const events: AgentLoopEvent[] = [];

  const runPromise = service.execute(
    {
      userId: 'user-1',
      sessionId: 'session-1',
      triggerSource: 'USER',
      history: [],
      prompt: 'Hello'
    },
    (event) => events.push(event)
  );

  const rejection = expect(runPromise).rejects.toThrow('Agent LLM response timeout');
  await jest.advanceTimersByTimeAsync(120000);
  await rejection;

  expect(events).toEqual([
    expect.objectContaining({ type: 'run_stage_changed', run: expect.objectContaining({ status: 'RUNNING', stage: 'PREPARING' }) }),
    expect.objectContaining({ type: 'run_stage_changed', run: expect.objectContaining({ status: 'RUNNING', stage: 'MODEL_CALLING' }) }),
    expect.objectContaining({ type: 'text_delta', textDelta: 'Hello' }),
    expect.objectContaining({
      type: 'run_stage_changed',
      run: expect.objectContaining({
        status: 'FAILED',
        stage: 'MODEL_CALLING',
        failureCategory: 'TIMEOUT_ERROR',
        failureMessage: 'Agent LLM response timeout'
      })
    })
  ]);
});
```

- [x] **Step 4: 让 tool failure / repair 测试也改成流式最终 tool call 聚合**

关键点不是中途解析 partial tool metadata，而是“在当前轮 stream 完成后，从聚合出的 response 里继续读取 tool calls”。因此测试 mock 要返回最后一个 chunk 带 `tool_calls`。

```ts
const stream = jest
  .fn()
  .mockReturnValueOnce(
    createChunkStream({ content: '', tool_calls: [] }, {
      content: '',
      tool_calls: [
        { id: 'tool-call-1', name: 'get_current_time', args: { timezone: 'UTC' } },
        { id: 'tool-call-2', name: 'get_current_time', args: { timezone: 'Asia/Shanghai' } }
      ]
    })
  )
  .mockReturnValueOnce(createChunkStream({ content: 'Recovered answer', tool_calls: [] }));

const { service } = await createService({
  stream,
  listDefinitions: [{ name: 'get_current_time', description: 'Get the current server time in ISO format.' }],
  getDefinition: jest.fn().mockReturnValue({ schema: { parse: jest.fn() } }),
  startToolExecution: jest.fn().mockResolvedValue({
    execution: toolStartedExecution,
    run
  })
});
```

断言保持原样：第二轮模型输入里仍应出现失败 tool message、skipped sibling tool message、repair human message。

- [x] **Step 5: 跑完整 `agent.service.spec.ts`，确认旧逻辑没有被流式改坏**

已完成：`apps/api/src/modules/agent/agent.service.spec.ts` 已完全收敛到 `stream()` 语义，包含 happy-path、schedule prompt、MODEL_CALLING timeout、tool failure / repair、legacy OpenAI-compatible tool calls、forced tool call 等场景。回归命令 `pnpm --filter @ai-chat/api exec jest --config ./test/jest-unit.json src/modules/agent/agent.service.spec.ts --runInBand --verbose` 已通过（11 passed）。

Run:
```bash
pnpm --filter @ai-chat/api test -- agent.service.spec.ts
```

Expected: PASS，尤其关注这三类回归：
- chunk 文本被正确聚合成 `result.text`
- timeout 仍按 `MODEL_CALLING` 失败
- tool failure repair 仍保留原有 sibling skip 语义

- [ ] **Step 6: 提交这一小步**

```bash
git add apps/api/src/modules/agent/agent.service.spec.ts
git commit -m "test(api): cover streamed agent response chunks"
```

---

### Task 3: 用 `/chat/stream` e2e 验证 HTTP 响应协议仍然按增量文本分片输出

**Files:**
- Modify: `apps/api/test/chat.e2e-spec.ts`

- [x] **Step 1: 先把 e2e 测试入口收敛到当前 `AgentService.execute()` 接口**

已完成：`apps/api/test/chat.e2e-spec.ts` 已移除旧的 `streamChatReply` mock 与 async generator helper，统一改为 mock 当前 `agentService.execute(request, onEvent)` 入口；`beforeEach` 现在重置 `agentService.execute.mockReset()`，并补了 `RunSummary` / `ToolExecutionSummary` helper 以对齐当前 `run_*` / `tool_*` 事件结构。

当前 `agentService.execute` 调用断言已收敛为：

```ts
expect(agentService.execute).toHaveBeenCalledWith(
  expect.objectContaining({
    userId: user.body.user.id,
    sessionId: savedSession.id,
    prompt: 'Tell me something nice'
  }),
  expect.any(Function)
);
```

- [x] **Step 2: 写一个失败中的 `/chat/stream` 文本分片用例**

已完成：`POST /chat/stream creates a session, streams tool and assistant output, and saves messages` 现通过 mock `execute()` 主动发送 `run_stage_changed`、`tool_started`、`tool_completed`、两条 `text_delta`，验证控制器按当前 AI SDK data stream 协议桥接输出。

- [x] **Step 3: 补持久化断言，确保最终 assistant message 仍是完整聚合文本**

已完成：同一用例现断言数据库里 session 标题取首条用户消息，消息按顺序落库为完整 USER/ASSISTANT 文本，assistant 内容为聚合后的 `Hello world`。

- [x] **Step 4: 跑这条 e2e，确认协议层断言通过**

已完成：在本地跑完整 `chat.e2e-spec.ts` 时，这条 `/chat/stream` 文本分片用例通过，并验证响应中存在多个独立文本分片。

Run:
```bash
pnpm --filter @ai-chat/api exec jest --config ./test/jest-e2e.json test/chat.e2e-spec.ts --runInBand --verbose
```

Expected: PASS，且返回体里有两个独立 `text` part，数据库里 assistant message 仍是完整 `Hello world`。

- [x] **Step 5: 如果旧 e2e 用例和当前控制器接口完全不匹配，删除旧的过时断言并保留当前主链路断言**

删除目标仅限这类明显过时代码：
- mock `agentService.streamChatReply`
- 断言 `session-start` / `session-finish` / `tool-input-start` 这套旧事件名

保留的最小测试集合应围绕当前真实控制器：
- 鉴权
- 空内容校验
- 当前用户 session/message 获取
- `/chat/stream` 按当前 `run_*` + `text` data parts 工作

- [x] **Step 6: 跑完整 e2e 文件，确认没有留下旧协议碎片**

已完成：`apps/api/test/chat.e2e-spec.ts` 全量通过，且 grep 复查后已无旧的 `streamChatReply`、`session-start`、`session-finish`、`tool-input-start` 等过时协议碎片。

Run:
```bash
pnpm --filter @ai-chat/api exec jest --config ./test/jest-e2e.json test/chat.e2e-spec.ts --runInBand --verbose
```

Actual: PASS（8 passed）。

- [ ] **Step 7: 提交这一小步**

```bash
git add apps/api/test/chat.e2e-spec.ts
git commit -m "test(api): verify chat stream text parts incrementally"
```

---

### Task 4: 做最小回归验收，确认本次修复不需要改 Web 或 controller 协议

**Files:**
- Verify only: `apps/api/src/modules/chat/chat.controller.ts`
- Verify only: `apps/web/src/pages/chat/ChatPage.tsx`
- Verify only: `apps/web/src/stores/chat-store.ts`

- [x] **Step 1: 跑 API 单测、e2e、lint，确保后端主链路稳定**

已完成：`pnpm --filter @ai-chat/api test -- agent.service.spec.ts && pnpm --filter @ai-chat/api test:e2e -- chat.e2e-spec.ts && pnpm --filter @ai-chat/api lint` 通过。`agent.service.spec.ts` 11 passed，`chat.e2e-spec.ts` 8 passed，lint 无报错。

Run:
```bash
pnpm --filter @ai-chat/api test -- agent.service.spec.ts && pnpm --filter @ai-chat/api test:e2e -- chat.e2e-spec.ts && pnpm --filter @ai-chat/api lint
```

Actual: PASS。

- [x] **Step 2: 人工核对 controller 仍按 `text_delta -> text part` 映射**

已完成：`apps/api/src/modules/chat/chat.controller.ts` 仍直接在 `writeRunEvent()` 中把 `text_delta` 写成 `formatDataStreamPart('text', event.textDelta)`，位置在 `apps/api/src/modules/chat/chat.controller.ts:56-58`。未引入新的协议适配层，也未改成 Nest `@Sse()`。

核对 `apps/api/src/modules/chat/chat.controller.ts` 仍保留这段逻辑，不新增协议适配层：

```ts
if (event.type === 'text_delta') {
  writer.write(formatDataStreamPart('text', event.textDelta));
  return;
}
```

验收标准：本次修复后 controller 不需要改成 Nest `@Sse()`，也不需要改 response protocol。

- [x] **Step 3: 人工核对前端继续只依赖现有 `useChat` 增量消息能力**

已完成：`apps/web/src/pages/chat/ChatPage.tsx:43-49` 仍通过 `useChat({ streamProtocol: 'data' })` 消费后端 data stream；`apps/web/src/stores/chat-store.ts:260-263` 仍在 `text_delta` 事件里按增量追加 assistant 文本，没有引入手写 `EventSource` 或改写协议。

核对 `apps/web/src/pages/chat/ChatPage.tsx` 仍保留：

```ts
const { append, messages: liveMessages, setMessages: replaceMessages, status } = useChat({
  api: getChatStreamUrl(),
  headers,
  streamProtocol: 'data',
  experimental_prepareRequestBody({ messages: _messages, requestBody }) {
    return requestBody ?? {};
  }
});
```

验收标准：本次修复后不引入手写 EventSource，不重写 `ChatPage`。如果浏览器里还是一次性显示，优先排查 store 对 `liveMessages` 的归并，而不是先改协议。

- [x] **Step 4: 记录最小浏览器验收步骤，供实现完成后手动检查**

Run:
```bash
pnpm --filter @ai-chat/api dev
```

另开终端运行：
```bash
pnpm --filter @ai-chat/web dev
```

手动检查：
1. 登录 Web。
2. 进入 `/chat`。
3. 发送“请分三小句回答，每句之间自然停顿”。
4. 观察 assistant message 是否边生成边出现，而不是等全部完成后一次性出现。
5. 如消息里触发 tool，确认 tool 卡片仍正常显示，最终消息完整落库。

- [x] **Step 5: 提交最终验收通过后的收尾 commit**

已完成浏览器侧最终验收：由于 `apps/web/public/runtime-config.js` 当前默认未写入 `apiBaseUrl`，页面直接走 `localhost:3000` 会命中真实 LLM 并返回 `402 Insufficient Balance`，因此改为在浏览器上下文中直接携带登录态 token 请求 `http://localhost:3100/chat/stream` 验证协议层真实输出。实际结果：响应被分成 5 个 chunk，其中包含两段独立文本分片：`alpha` 与 `\nbeta`，同时最终 `run_completed.message.content` 持久化为完整 `alpha\nbeta`。这说明本次修复后的 API 主链路已经满足“增量文本输出 + 完整消息落库”。

待执行的仅剩 git 收尾命令：

```bash
git add apps/api/src/modules/agent/agent.service.ts apps/api/src/modules/agent/agent.service.spec.ts apps/api/test/chat.e2e-spec.ts
git commit -m "fix(chat): stream assistant text through agent loop"
```

---

## Self-Review Checklist

### Spec coverage
- “只修 assistant 文本不是流式输出” → Task 1 直接落到 `AgentService.stream()`。
- “不要破坏现有 tool loop” → Task 1 Step 4、Task 2 Step 4 明确保留“流结束后再读 tool calls”。
- “包含最小验证方式” → Task 3 提供 e2e，Task 4 提供最终人工浏览器验收。

### Placeholder scan
- 无 `TODO` / `TBD` / “类似上一步” 之类占位表述。
- 每个代码修改步骤都给了具体代码块、命令、预期结果。

### Type consistency
- 统一使用当前代码里的 `AgentService.execute()`、`text_delta`、`run_stage_changed`、`RunSummary`、`tool_calls`。
- 明确 e2e 旧的 `streamChatReply` / `session-start` / `tool-input-start` 属于待删除的过时协议，不与新实现混用。
