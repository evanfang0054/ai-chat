# Chat Protocol Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 chat 主链路直接收敛到 AI SDK 兼容流式消息协议，并让 Web 聊天页改为 `@ai-sdk/react` + `useChat` 驱动的连续多轮消息体验，同时保持现有 session / chat message / tool execution 持久化兼容。

**Architecture:** API 端不再继续维护当前自定义 `ChatStreamEvent` SSE 协议，而是直接在 `POST /chat/stream` 中把现有 `chat -> agent -> tool` 执行过程映射为 AI SDK 兼容的数据流输出。Web 端移除当前“手写 SSE 解析 + Zustand 双轨 messages/toolExecutions 拼装”模式，改由 `useChat` 持有消息流状态，session 列表与历史消息加载仍通过现有 chat API 获取；历史消息只继续消费数据库里已有的纯文本 `ChatMessage` 与 `ToolExecution` 记录，不做 schema parts 化重构。

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, Vite, TypeScript, AI SDK (`ai`, `@ai-sdk/react`), LangChainJS, Jest, Vitest

---

## File Structure Map

### Shared contracts
- Modify: `packages/shared/src/chat.ts` — 删除旧 `ChatStreamEvent` 契约，补 AI SDK 聊天请求/历史消息查询所需的共享类型
- Modify: `packages/shared/src/index.ts` — 继续导出 chat 契约

### API chat streaming
- Modify: `apps/api/package.json` — 增加服务端 AI SDK 依赖
- Modify: `apps/api/src/modules/chat/chat.controller.ts` — `POST /chat/stream` 直接输出 AI SDK 兼容流式响应
- Modify: `apps/api/src/modules/chat/chat.service.ts` — 补历史消息 / tool execution 组装与 assistant 最终落库辅助方法
- Modify: `apps/api/src/modules/agent/agent.types.ts` — 用更贴近“文本块 + tool 生命周期”的内部事件替换旧事件命名
- Modify: `apps/api/src/modules/agent/agent.service.ts` — 保持 agent/tool 执行逻辑，输出更适合 AI SDK 流协议写出的事件载荷
- Modify: `apps/api/test/chat.e2e-spec.ts` — 断言新的 AI SDK 兼容流输出与持久化兼容

### Web chat experience
- Modify: `apps/web/package.json` — 增加 `ai` / `@ai-sdk/react`
- Modify: `apps/web/src/services/chat.ts` — 改为 `DefaultChatTransport` / chat fetch 辅助、保留 session/history 查询
- Modify: `apps/web/src/pages/chat/ChatPage.tsx` — 迁移到 `useChat`，负责会话切换、历史加载、发送消息、完成后刷新 session
- Modify: `apps/web/src/components/chat/MessageList.tsx` — 渲染 `UIMessage[]`，把 tool invocation/result/error 融入 assistant message
- Modify: `apps/web/src/components/chat/MessageItem.tsx` — 支持 user / assistant 连续气泡、markdown 文本块、tool parts
- Modify: `apps/web/src/components/chat/ChatComposer.tsx` — 对接 `useChat` 输入与提交接口
- Delete or narrow: `apps/web/src/components/chat/ToolExecutionList.tsx` — 不再作为聊天主视图独立列表
- Modify: `apps/web/src/stores/chat-store.ts` — 收缩为 session 列表 / 当前 session / 草稿以外的最小 UI 状态，移除流式 message/tool 状态拼装职责
- Modify: `apps/web/src/__tests__/chat-page.test.tsx` — 改为 mock `useChat` / transport，验证历史切换与发送流程
- Modify: `apps/web/src/__tests__/chat-store.test.ts` — 删除旧流式 reducer 断言，保留 session 级 store 行为测试

### Docs
- Modify: `docs/superpowers/specs/2026-03-30-gap-analysis-next-backlog-design.md` — 将 chat 主链路状态标注为“已进入 AI SDK 协议升级实施”或在实施后同步为已完成

---

### Task 1: 收敛 shared chat 契约到新聊天流边界

**Files:**
- Modify: `packages/shared/src/chat.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `pnpm --filter @ai-chat/shared exec tsc --noEmit`

- [ ] **Step 1: 删除旧 `ChatStreamEvent` 暴露，保留 HTTP 请求与历史查询契约**

```ts
export type ChatMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface ChatSessionSummary {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
}

export interface ListChatSessionsResponse {
  sessions: ChatSessionSummary[];
}

export interface GetChatMessagesResponse {
  session: ChatSessionSummary;
  messages: ChatMessage[];
}

export interface SendChatMessageRequest {
  sessionId?: string;
  content: string;
}
```

- [ ] **Step 2: 补前端聊天历史映射需要的持久化辅助类型**

```ts
import type { ToolExecutionSummary } from './tool';

export interface GetChatTimelineResponse {
  session: ChatSessionSummary;
  messages: ChatMessage[];
  toolExecutions: ToolExecutionSummary[];
}
```

- [ ] **Step 3: 继续从 shared 入口导出 chat 契约**

```ts
export * from './auth';
export * from './user';
export * from './chat';
export * from './tool';
export * from './schedule';
```

- [ ] **Step 4: 跑 shared 类型检查**

Run: `pnpm --filter @ai-chat/shared exec tsc --noEmit`
Expected: 命令退出码为 0，无共享类型错误

- [ ] **Step 5: 提交 shared 契约变更**

```bash
git add packages/shared/src/chat.ts packages/shared/src/index.ts
git commit -m "refactor: trim legacy chat stream contracts"
```

---

### Task 2: 让 API 直接输出 AI SDK 兼容流式聊天响应

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/modules/chat/chat.controller.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Modify: `apps/api/src/modules/agent/agent.types.ts`
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Test: `pnpm --filter @ai-chat/api test -- chat.e2e-spec.ts`

- [ ] **Step 1: 增加 API 侧 AI SDK 依赖**

```json
{
  "dependencies": {
    "ai": "^4.3.16"
  }
}
```

- [ ] **Step 2: 把 agent 流式事件收敛成文本块与 tool 生命周期事件**

```ts
export type AgentStreamEvent =
  | { type: 'text-delta'; textDelta: string }
  | {
      type: 'tool-input-start';
      toolExecution: ToolExecutionRunningSummary;
    }
  | {
      type: 'tool-input-available';
      toolExecution: ToolExecutionRunningSummary;
    }
  | {
      type: 'tool-output-available';
      toolExecution: ToolExecutionSucceededSummary;
    }
  | {
      type: 'tool-output-error';
      toolExecution: ToolExecutionFailedSummary;
    }
  | { type: 'finish' };
```

- [ ] **Step 3: 在 `agent.service.ts` 中保持现有执行逻辑，只改事件输出名义**

```ts
yield { type: 'tool-input-start', toolExecution: this.toRunningExecutionSummary(started.execution) };
yield { type: 'tool-input-available', toolExecution: this.toRunningExecutionSummary(started.execution) };

// tool succeed
yield {
  type: 'tool-output-available',
  toolExecution: this.toSucceededExecutionSummary(result.execution)
};

// text
yield { type: 'text-delta', textDelta: text };

// fail
yield {
  type: 'tool-output-error',
  toolExecution: failedSummary
};

yield { type: 'finish' };
```

- [ ] **Step 4: 在 `chat.service.ts` 中新增时间线查询和 assistant 最终化辅助方法**

```ts
async getSessionTimeline(userId: string, sessionId: string) {
  const session = await this.getSessionOrThrow(userId, sessionId);
  const [messages, toolExecutions] = await Promise.all([
    this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' }
    }),
    this.prisma.toolExecution.findMany({
      where: { sessionId },
      orderBy: { startedAt: 'asc' }
    })
  ]);

  return {
    session: this.formatSessionSummary(session),
    messages: messages.map((message) => this.formatMessage(message)),
    toolExecutions: toolExecutions.map((execution) => this.formatToolExecution(execution))
  };
}

async finalizeAssistantReply(sessionId: string, assistantText: string) {
  const message = await this.saveAssistantMessage(sessionId, assistantText);
  const session = await this.prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } });
  return {
    session: this.formatSessionSummary(session),
    message: this.formatMessage(message)
  };
}
```

- [ ] **Step 5: 让 `chat.controller.ts` 直接用 AI SDK 的 `createUIMessageStream` / `pipeUIMessageStreamToResponse` 输出兼容 SSE data parts，而不是旧 `ChatStreamEvent` JSON**

```ts
@Post('stream')
async streamChat(
  @CurrentUser() user: CurrentUserPayload,
  @Body() dto: CreateChatMessageDto,
  @Res() res: Response
) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: 'start' });

      writer.write({
        type: 'data-session',
        data: {
          sessionId: session.id,
          userMessageId: userMessage.id
        }
      });

      writer.write({
        type: 'text-start',
        id: assistantMessageId
      });

      for await (const event of this.agentService.streamChatReply(...)) {
        if (event.type === 'text-delta') {
          assistantText += event.textDelta;
          writer.write({
            type: 'text-delta',
            id: assistantMessageId,
            delta: event.textDelta
          });
          continue;
        }

        if (event.type === 'tool-input-start') {
          writer.write({
            type: 'data-tool-input-start',
            data: {
              toolCallId: event.toolExecution.id,
              toolName: event.toolExecution.toolName
            }
          });
          continue;
        }

        if (event.type === 'tool-input-available') {
          writer.write({
            type: 'data-tool-input',
            data: {
              toolCallId: event.toolExecution.id,
              toolName: event.toolExecution.toolName,
              input: event.toolExecution.input
            }
          });
          continue;
        }

        if (event.type === 'tool-output-available') {
          writer.write({
            type: 'data-tool-output',
            data: {
              toolCallId: event.toolExecution.id,
              output: event.toolExecution.output
            }
          });
          continue;
        }

        if (event.type === 'tool-output-error') {
          writer.write({
            type: 'data-tool-error',
            data: {
              toolCallId: event.toolExecution.id,
              errorText: event.toolExecution.errorMessage
            }
          });
          throw new Error(event.toolExecution.errorMessage);
        }
      }

      writer.write({
        type: 'text-end',
        id: assistantMessageId
      });

      const finalized = await this.chatService.finalizeAssistantReply(session.id, assistantText);
      writer.write({
        type: 'data-session-finish',
        data: {
          sessionId: finalized.session.id,
          assistantMessageId: finalized.message.id
        }
      });
    },
    onError: (error) => (error instanceof Error ? error.message : 'Chat stream failed')
  });

  pipeUIMessageStreamToResponse({
    response: res,
    stream
  });
}
```

- [ ] **Step 6: 保留失败分支，但用 `onError` 返回错误文本，不再手写旧协议 `run_failed` 事件**

```ts
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // ...正常流式写入...
  },
  onError: (error) => (error instanceof Error ? error.message : 'Chat stream failed')
});
```

- [ ] **Step 7: 跑 chat e2e，先确认新流输出和持久化仍成立**

Run: `pnpm --filter @ai-chat/api test -- chat.e2e-spec.ts`
Expected: `POST /chat/stream` 用例通过，断言 response text 中包含 `text-delta`、tool parts 和 `finish`

- [ ] **Step 8: 提交 API 流协议升级**

```bash
git add apps/api/package.json apps/api/src/modules/chat/chat.controller.ts apps/api/src/modules/chat/chat.service.ts apps/api/src/modules/agent/agent.types.ts apps/api/src/modules/agent/agent.service.ts apps/api/test/chat.e2e-spec.ts
git commit -m "feat(api): stream chat with ai sdk protocol"
```

---

### Task 3: 重写 chat e2e 测试到新协议断言

**Files:**
- Modify: `apps/api/test/chat.e2e-spec.ts`
- Test: `pnpm --filter @ai-chat/api test -- chat.e2e-spec.ts`

- [ ] **Step 1: 把 mock agent 输出改成新的内部事件序列**

```ts
agentService.streamChatReply.mockImplementation(() =>
  createStream(
    {
      type: 'tool-input-start',
      toolExecution: {
        id: 'tool-execution-1',
        sessionId: 'pending-session-id',
        toolName: 'get_current_time',
        status: 'RUNNING',
        input: '{"timezone":"UTC"}',
        output: null,
        errorMessage: null,
        startedAt: '2026-03-26T12:00:00.000Z',
        finishedAt: null
      }
    },
    {
      type: 'tool-output-available',
      toolExecution: {
        id: 'tool-execution-1',
        sessionId: 'pending-session-id',
        toolName: 'get_current_time',
        status: 'SUCCEEDED',
        input: '{"timezone":"UTC"}',
        output: '{"now":"2026-03-26T12:00:00.000Z"}',
        errorMessage: null,
        startedAt: '2026-03-26T12:00:00.000Z',
        finishedAt: '2026-03-26T12:00:01.000Z'
      }
    },
    { type: 'text-delta', textDelta: 'Hello' },
    { type: 'text-delta', textDelta: ' world' },
    { type: 'finish' }
  )
);
```

- [ ] **Step 2: 把 response text 断言从旧 `run_started/run_completed` 改成新 data parts**

```ts
expect(response.text).toContain('text-delta');
expect(response.text).toContain('tool-input-start');
expect(response.text).toContain('tool-output-available');
expect(response.text).toContain('finish');
expect(response.text).not.toContain('run_started');
```

- [ ] **Step 3: 继续断言数据库里只持久化 user/assistant 文本消息与 tool execution 记录**

```ts
const messages = await prisma.chatMessage.findMany({ orderBy: { createdAt: 'asc' } });
expect(messages.map((message) => ({ role: message.role, content: message.content }))).toEqual([
  { role: 'USER', content: 'What time is it?' },
  { role: 'ASSISTANT', content: 'Hello world' }
]);

const executions = await prisma.toolExecution.findMany({ orderBy: { startedAt: 'asc' } });
expect(executions).toHaveLength(1);
expect(executions[0]?.status).toBe('SUCCEEDED');
```

- [ ] **Step 4: 运行 chat e2e**

Run: `pnpm --filter @ai-chat/api test -- chat.e2e-spec.ts`
Expected: chat e2e 全绿，证明 API 对外协议升级但持久化兼容未破坏

- [ ] **Step 5: 提交 e2e 更新**

```bash
git add apps/api/test/chat.e2e-spec.ts
git commit -m "test(api): update chat e2e for ai sdk stream"
```

---

### Task 4: 让 Web chat transport 改为 AI SDK useChat

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/services/chat.ts`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Modify: `apps/web/src/components/chat/ChatComposer.tsx`
- Test: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`

- [ ] **Step 1: 增加 Web 侧 AI SDK 依赖**

```json
{
  "dependencies": {
    "ai": "^4.3.16",
    "@ai-sdk/react": "^1.1.20"
  }
}
```

- [ ] **Step 2: 在 `chat.ts` 中保留 session/history 查询，新增 transport 工厂**

```ts
import { DefaultChatTransport } from 'ai';

export function createChatTransport(accessToken: string) {
  return new DefaultChatTransport({
    api: `${resolveApiBaseUrl()}/chat/stream`,
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    credentials: 'include'
  });
}

export async function getChatTimeline(accessToken: string, sessionId: string) {
  return apiFetch<GetChatTimelineResponse>(`/chat/sessions/${sessionId}/messages`, {
    method: 'GET',
    accessToken
  });
}
```

- [ ] **Step 3: 在 `ChatPage.tsx` 中把消息流状态切到 `useChat`**

```tsx
const transport = useMemo(() => {
  if (!accessToken) {
    return null;
  }
  return createChatTransport(accessToken);
}, [accessToken]);

const {
  messages,
  input,
  setInput,
  sendMessage,
  setMessages,
  status,
  error,
  stop
} = useChat({
  id: currentSessionId ?? 'new-chat',
  transport,
  onFinish: async () => {
    const nextSessions = await listChatSessions(accessToken!);
    setSessions(nextSessions.sessions);
  }
});
```

- [ ] **Step 4: 历史会话切换时，把数据库历史映射成 `UIMessage[]` 后塞给 `useChat`**

```tsx
useEffect(() => {
  if (!accessToken || !requestedSessionId) {
    setMessages([]);
    return;
  }

  void getChatTimeline(accessToken, requestedSessionId).then((response) => {
    setCurrentSession(response.session.id);
    setMessages(buildUiMessagesFromTimeline(response.messages, response.toolExecutions));
  });
}, [accessToken, requestedSessionId, setMessages, setCurrentSession]);
```

- [ ] **Step 5: 发送消息时直接调用 `sendMessage`，不再手写 SSE block 解析**

```tsx
const handleSubmit = async () => {
  const content = input.trim();
  if (!content || status === 'streaming') {
    return;
  }

  await sendMessage({ text: content }, {
    body: {
      sessionId: currentSessionId ?? undefined,
      content
    }
  });
};
```

- [ ] **Step 6: 让 `ChatComposer` 直接消费 `useChat` 输入状态**

```tsx
export function ChatComposer(props: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <Textarea
        rows={4}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button disabled={props.disabled} onClick={props.onSubmit}>
          Send
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 运行 chat page 测试**

Run: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
Expected: 页面测试通过，证明 `useChat` 驱动下仍能发送消息、切换 session、刷新 session 列表

- [ ] **Step 8: 提交 Web transport 迁移**

```bash
git add apps/web/package.json apps/web/src/services/chat.ts apps/web/src/pages/chat/ChatPage.tsx apps/web/src/components/chat/ChatComposer.tsx
git commit -m "feat(web): move chat page to useChat"
```

---

### Task 5: 把 tool 调用与结果融入 assistant message 渲染

**Files:**
- Modify: `apps/web/src/components/chat/MessageList.tsx`
- Modify: `apps/web/src/components/chat/MessageItem.tsx`
- Delete or narrow: `apps/web/src/components/chat/ToolExecutionList.tsx`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Test: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`

- [ ] **Step 1: 让 `MessageList` 只接收 `UIMessage[]`**

```tsx
import type { UIMessage } from 'ai';

export function MessageList({ messages }: { messages: UIMessage[] }) {
  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 在 `MessageItem` 中按 message parts 渲染文本与 tool blocks**

```tsx
export function MessageItem({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className={isUser ? 'max-w-3xl rounded-2xl bg-cyan-500 px-4 py-3 text-slate-950' : 'max-w-4xl space-y-3'}>
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            return (
              <div key={`${message.id}-text-${index}`} className="prose prose-invert max-w-none">
                <Markdown>{part.text}</Markdown>
              </div>
            );
          }

          if (part.type === 'tool-invocation') {
            return (
              <div key={`${message.id}-tool-${index}`} className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
                <div className="text-xs text-slate-400">{part.toolInvocation.toolName}</div>
                <pre className="mt-2 overflow-x-auto text-xs text-slate-300">
                  {JSON.stringify(part.toolInvocation.args ?? {}, null, 2)}
                </pre>
                {'result' in part.toolInvocation && part.toolInvocation.result ? (
                  <pre className="mt-2 overflow-x-auto text-xs text-emerald-300">
                    {JSON.stringify(part.toolInvocation.result, null, 2)}
                  </pre>
                ) : null}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 删除聊天主视图对 `ToolExecutionList` 的独立渲染**

```tsx
<MessageList messages={messages} />
```

- [ ] **Step 4: 在历史映射函数中把 tool execution 归并到 assistant message parts**

```ts
function buildUiMessagesFromTimeline(messages: ChatMessage[], toolExecutions: ToolExecutionSummary[]): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== 'ASSISTANT') {
      return {
        id: message.id,
        role: message.role === 'USER' ? 'user' : 'system',
        parts: [{ type: 'text', text: message.content }]
      } satisfies UIMessage;
    }

    const relatedExecutions = toolExecutions.filter((execution) => execution.sessionId === message.sessionId);
    return {
      id: message.id,
      role: 'assistant',
      parts: [
        ...relatedExecutions.map((execution) => toToolPart(execution)),
        { type: 'text', text: message.content }
      ]
    } satisfies UIMessage;
  });
}
```

- [ ] **Step 5: 运行 chat page 测试，覆盖 tool part 显示**

Run: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
Expected: 测试能看到 assistant message 中的 tool 名称、参数或结果，不再依赖独立 tool list

- [ ] **Step 6: 提交消息渲染升级**

```bash
git add apps/web/src/components/chat/MessageList.tsx apps/web/src/components/chat/MessageItem.tsx apps/web/src/pages/chat/ChatPage.tsx apps/web/src/components/chat/ToolExecutionList.tsx
git commit -m "feat(web): render tool parts inside assistant messages"
```

---

### Task 6: 收缩 chat store 到 session 级职责

**Files:**
- Modify: `apps/web/src/stores/chat-store.ts`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Modify: `apps/web/src/__tests__/chat-store.test.ts`
- Test: `pnpm --filter @ai-chat/web test -- chat-store.test.ts`

- [ ] **Step 1: 删除旧流式 reducer，只保留 session / currentSessionId / error 等页面级状态**

```ts
type ChatState = {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  error: string | null;
  setSessions: (sessions: ChatSessionSummary[]) => void;
  setCurrentSession: (sessionId: string | null) => void;
  setError: (message: string | null) => void;
  reset: () => void;
};
```

- [ ] **Step 2: 删除这些旧方法与相关实现**

```ts
applyRunStarted
applyToolStarted
applyToolCompleted
applyToolFailed
applyTextDelta
applyRunCompleted
applyRunFailed
setMessages
setDraft
```

- [ ] **Step 3: 把 `ChatPage.tsx` 中对这些方法的依赖全部删掉，错误由 `useChat` / 页面本地状态承接**

```tsx
const { sessions, currentSessionId, setSessions, setCurrentSession, error, setError } = useChatStore();
```

- [ ] **Step 4: 把 `chat-store.test.ts` 改成只测 session 级行为**

```ts
it('sets and resets current session state', () => {
  const store = useChatStore.getState();
  store.setSessions([
    {
      id: 'session-1',
      title: 'Hello AI',
      model: 'deepseek-chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]);
  store.setCurrentSession('session-1');

  expect(useChatStore.getState().currentSessionId).toBe('session-1');

  useChatStore.getState().reset();
  expect(useChatStore.getState().sessions).toEqual([]);
});
```

- [ ] **Step 5: 运行 chat store 测试**

Run: `pnpm --filter @ai-chat/web test -- chat-store.test.ts`
Expected: store 测试通过，不再出现旧流式 reducer 断言

- [ ] **Step 6: 提交 store 收缩**

```bash
git add apps/web/src/stores/chat-store.ts apps/web/src/pages/chat/ChatPage.tsx apps/web/src/__tests__/chat-store.test.ts
git commit -m "refactor(web): narrow chat store to session state"
```

---

### Task 7: 更新 Web 页面测试到 useChat 模型

**Files:**
- Modify: `apps/web/src/__tests__/chat-page.test.tsx`
- Test: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`

- [ ] **Step 1: mock `useChat`，不再 mock 旧 `streamChatMessage(..., onEvent)`**

```tsx
vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [
      {
        id: 'msg-user',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello AI' }]
      },
      {
        id: 'msg-assistant',
        role: 'assistant',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-1',
              toolName: 'get_current_time',
              args: { timezone: 'UTC' },
              result: { now: '2026-03-26T12:00:00.000Z' }
            }
          },
          { type: 'text', text: 'Hi there' }
        ]
      }
    ],
    input: '',
    setInput: vi.fn(),
    sendMessage: vi.fn(),
    setMessages: vi.fn(),
    status: 'ready',
    error: undefined,
    stop: vi.fn()
  })
}));
```

- [ ] **Step 2: 更新页面断言，检查 assistant message 内的 tool part 与文本**

```tsx
expect(await screen.findByText('Hello AI')).toBeInTheDocument();
expect(await screen.findByText('Hi there')).toBeInTheDocument();
expect(await screen.findByText('get_current_time')).toBeInTheDocument();
```

- [ ] **Step 3: 继续验证发送时调用 `sendMessage`，body 带 `sessionId` / `content`**

```tsx
await userEvent.click(screen.getByRole('button', { name: 'Send' }));
expect(sendMessageMock).toHaveBeenCalledWith(
  { text: 'Hello AI' },
  expect.objectContaining({
    body: expect.objectContaining({
      content: 'Hello AI'
    })
  })
);
```

- [ ] **Step 4: 运行页面测试**

Run: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
Expected: chat page 测试通过，说明页面已完成 `useChat` 迁移

- [ ] **Step 5: 提交测试改造**

```bash
git add apps/web/src/__tests__/chat-page.test.tsx
git commit -m "test(web): update chat page for useChat"
```

---

### Task 8: 做一次端到端回归并同步设计文档状态

**Files:**
- Modify: `docs/superpowers/specs/2026-03-30-gap-analysis-next-backlog-design.md`
- Test: `pnpm --filter @ai-chat/api test -- chat.e2e-spec.ts`
- Test: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
- Test: `pnpm --filter @ai-chat/web test -- chat-store.test.ts`
- Test: `pnpm --filter @ai-chat/api build`
- Test: `pnpm --filter @ai-chat/web build`
- Test: `agent-browser` skill 手动 E2E 验证聊天主链路

- [ ] **Step 1: 在 gap analysis/spec 中把本阶段状态同步为已实施或实施中真实状态**

```md
- chat 前后端主链路已切换到 AI SDK 兼容流式消息协议
- Web chat 页面已迁移到 `@ai-sdk/react` + `useChat`
- tool 调用与结果已内嵌到 assistant message
- 未引入独立协议适配层；数据库仍保持文本 message + tool execution 持久化模型
```

- [ ] **Step 2: 跑 API chat e2e 回归**

Run: `pnpm --filter @ai-chat/api test -- chat.e2e-spec.ts`
Expected: PASS

- [ ] **Step 3: 跑 Web chat 测试回归**

Run: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
Expected: PASS

Run: `pnpm --filter @ai-chat/web test -- chat-store.test.ts`
Expected: PASS

- [ ] **Step 4: 跑受影响 workspace build**

Run: `pnpm --filter @ai-chat/api build && pnpm --filter @ai-chat/web build`
Expected: 两个 workspace 均构建成功

- [ ] **Step 5: 使用 `agent-browser` skill 做最终交互式 E2E 验证**

Run: `agent-browser` skill
Expected:
- 能登录并进入聊天页
- 首次发送消息时能创建新 session，并在侧栏出现会话标题
- user / assistant 消息按连续多轮聊天样式展示，而不是旧的分离式卡片 + 独立 tool 列表
- assistant streaming 文本能逐步出现
- tool 调用、结果、失败状态出现在 assistant message 内部，而不是独立列表
- 切换已有 session 后，历史消息仍能正确回放，tool 相关内容仍嵌在 assistant message 中
- 整体交互观感符合预期，没有明显协议回退到旧 SSE 事件模型的 UI 痕迹

- [ ] **Step 6: 提交文档与回归完成状态**

```bash
git add docs/superpowers/specs/2026-03-30-gap-analysis-next-backlog-design.md
git commit -m "docs: sync chat protocol upgrade status"
```
