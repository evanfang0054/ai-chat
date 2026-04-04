# 2026-04-04 聊天文本流式输出修复设计

## 1. 背景

当前 Web 端聊天页已经使用 AI SDK `useChat` 并配置 `streamProtocol: 'data'`，后端 `/chat/stream` 也已经通过 `pipeDataStreamToResponse(...)` 持续写出 AI SDK data stream part。

但实际表现是 assistant 回复会在模型完成后一次性出现，而不是边生成边显示。

结合当前代码链路可知，问题不在前端是否“支持流式”，也不在 `/chat/stream` 是否已经具备流式响应能力，而在后端 agent 层实际仍然使用非流式模型调用：

- `apps/api/src/modules/agent/agent.service.ts` 当前在 `executeAgentLoop()` 中调用 `toolAwareModel.invoke(conversation)`
- `invoke()` 会等待模型整轮完成后返回完整 `AIMessage`
- 当前 `text_delta` 事件实际上是在拿到整段文本后一次性发出

因此，本次设计聚焦于：**在不改接口形态、不改前端接入方式、不重做协议的前提下，让 assistant 文本真正按 chunk 增量输出。**

---

## 2. 目标

本次设计目标：

1. 修复聊天 assistant 文本“一次性输出”的问题
2. 保持现有 `/chat/stream` 路由与 AI SDK `data` stream protocol 不变
3. 保持前端 `useChat` 和 store 同步链路不变
4. 保持现有 tool call 循环与 run/tool execution 事件结构不被推翻
5. 提供最小可验证路径，确认后端确实在持续输出 chunk

成功标准：

- 普通文本聊天时，前端 assistant 消息能逐步增长
- 触发工具调用时，既有 tool_started / tool_completed 等事件仍可正常工作
- 浏览器网络面板中可以观察到 `/chat/stream` 响应持续到达，而不是只在结束时一次性返回完整内容

---

## 3. 非目标

本次设计明确不包含：

- 不把 `/chat/stream` 改成 Nest 标准 `@Sse()` + `EventSource`
- 不切换前端到 `streamProtocol: 'text'`
- 不重构 chat controller 的协议层
- 不重做 chat store、timeline、run state 管理
- 不扩展到 tool 参数逐步流式展示
- 不统一 chat / schedule 的整条 execution spine 设计
- 不顺手重构 timeout、错误分类或 shared contract

本次只解决：**assistant 文本不能实时流式显示**。

---

## 4. 现状分析

### 4.1 前端链路已经按流式方式接入

当前前端：

- `apps/web/src/pages/chat/ChatPage.tsx` 使用 AI SDK `useChat`
- 明确配置 `streamProtocol: 'data'`
- 将 `liveMessages` 持续同步到 `chat-store`

这说明前端本身已经具备消费 AI SDK data stream 的能力，不是本次的主要改动点。

### 4.2 Controller 层已经具备流式输出能力

当前后端 controller：

- `apps/api/src/modules/chat/chat.controller.ts`
- 使用 `pipeDataStreamToResponse(res, { ... })`
- 对 `text_delta` 事件会写出 `formatDataStreamPart('text', event.textDelta)`

这说明 `/chat/stream` 的 HTTP 响应层已经是流式写出模型，不需要改成另一种传输协议。

### 4.3 真正的问题在 AgentService 的模型调用方式

当前：

- `apps/api/src/modules/agent/agent.service.ts`
- `executeAgentLoop()` 中使用 `toolAwareModel.invoke(conversation)`

这导致：

1. 模型要先完整生成
2. agent 才拿到完整 `AIMessage`
3. agent 再从完整结果中提取文本
4. 一次性发出一个 `text_delta`

因此，“不是流式输出”的根因不是前端不会接，而是 agent 并没有真实地产生增量文本事件。

---

## 5. 方案比较

### 方案 A：把 `invoke()` 改成 `stream()`，其余链路保持不动（推荐）

做法：

- 将 `toolAwareModel.invoke(conversation)` 改为 `toolAwareModel.stream(conversation)`
- 使用 `for await ... of` 读取 chunk
- 每拿到文本 chunk 就发一次 `text_delta`
- 同时将所有 chunk 聚合成最终 response
- 流结束后再读取 tool calls 并进入现有工具循环

优点：

- 改动最小
- 保持现有 controller、前端、shared 协议不变
- 能直接命中当前根因
- 最适合当前项目的 KISS 原则

缺点：

- 需要确认 `readChunkText` 对 chunk 内容兼容
- 需要确认聚合后的最终 response 仍可被 `readToolCalls` 正确消费

### 方案 B：改为 `streamEvents()` 驱动模型与执行事件

做法：

- 用 LangChainJS `streamEvents()` 取代 `stream()`
- 直接从模型事件流映射文本增量与执行状态事件

优点：

- 与现有 run/tool execution 事件体系更贴近
- 长期扩展性更好

缺点：

- 设计和实现范围更大
- 对本次“只修文本流式”的目标来说过重

### 方案 C：前端降级为纯文本流消费

做法：

- 后端退化为纯文本流
- 前端切换为 `streamProtocol: 'text'`

优点：

- 快速绕过协议细节

缺点：

- 会削弱当前 data stream / tool execution 协议能力
- 不是修根因，只是降级兼容

### 结论

选择 **方案 A**。

原因：

- 最贴近当前问题根因
- 改动边界最清晰
- 能保留现有聊天协议与前端接入方式
- 足以满足“文本流式 + 不破坏 tool call 循环 + 可验证”的范围要求

---

## 6. 设计方案

## 6.1 修改边界

本次只修改后端 agent 层的模型调用与文本增量产生方式，核心文件为：

- `apps/api/src/modules/agent/agent.service.ts`

默认保持不动的文件：

- `apps/api/src/modules/chat/chat.controller.ts`
- `apps/api/src/modules/llm/llm.service.ts`（除非验证后发现 DeepSeek 兼容流式必须补显式配置）
- `apps/web/src/pages/chat/ChatPage.tsx`
- `apps/web/src/stores/chat-store.ts`
- `apps/web/src/services/chat.ts`
- `packages/shared/*`

## 6.2 新的模型调用流程

`executeAgentLoop()` 从当前的“单次 invoke”改为“单轮 stream + 聚合结果”。

新的单轮流程如下：

1. 进入 `MODEL_CALLING` stage
2. 调用 `toolAwareModel.stream(conversation)` 获取异步流
3. 使用 `for await` 持续读取每个 chunk
4. 从每个 chunk 中提取文本增量
5. 每拿到一点文本，就立刻发出 `text_delta`
6. 同时把 chunk 累加成一个最终 response
7. 流结束后，基于最终 response 读取 tool calls
8. 若无 tool calls，则返回累计文本
9. 若有 tool calls，则沿现有逻辑进入 `TOOL_RUNNING`

这样可以保证：

- assistant 文本开始实时输出
- tool call 仍然基于完整一轮模型结果判断
- 现有多轮 tool loop 结构不需要推翻

## 6.3 文本增量策略

本次只要求“按 chunk 增量输出”，不强求严格 token 级别。

也就是说：

- 只要 LangChainJS 在 `stream()` 中产出一段文本
- 就立即映射成一次 `text_delta`
- controller 继续把 `text_delta` 转成 AI SDK `text` part

前端由现有 `useChat` 增量渲染即可。

## 6.4 Tool call 兼容策略

文本流式与工具调用的兼容原则是：

**文本边流，tool call 在本轮流结束后再判断。**

原因：

- 流式 chunk 中的 tool call 信息未必在中途完整
- 当前系统已经有稳定的“完整 response -> readToolCalls() -> execute tools”模式

因此本次不在 chunk 中途解析 tool call，而是：

- 持续流式发文本
- 流结束后用聚合结果读取工具调用
- 后续工具执行、失败重试、`ToolMessage` 回填 conversation 的逻辑保持现状

## 6.5 错误处理策略

本次保持现有错误语义稳定：

- stream 初始化失败：仍按 `MODEL_CALLING` 错误处理
- stream 消费中失败：仍归类到 `MODEL_CALLING`
- 空响应：延续当前 “Agent response was empty” 语义
- tool 执行失败：仍沿现有 `TOOL_RUNNING` 处理链路

本次不新增 failure category，也不修改 shared contract。

## 6.6 Timeout 策略

本次不重构 timeout 体系。

已知风险是：当前 `withTimeout(...)` 更适合包住单次 `invoke()`，切换到 `stream()` 后，可能只包住“创建 stream”的阶段，而不是完整消费阶段。

但本次范围优先级更高的是先让真实流式输出工作起来。因此：

- 第一阶段先完成流式改造
- 若验证后发现 timeout 行为异常，再单独补一个小改动处理整体流消费超时

这项风险记录在实现计划中，但不作为本次设计的阻塞项。

---

## 7. 影响范围

### 7.1 需要修改的文件

主要修改：

- `apps/api/src/modules/agent/agent.service.ts`

可能小幅修改：

- `apps/api/src/modules/llm/llm.service.ts`（仅当实际验证发现 provider 需要显式 streaming 配置）

### 7.2 明确不改的文件

- `apps/api/src/modules/chat/chat.controller.ts`
- `apps/web/src/pages/chat/ChatPage.tsx`
- `apps/web/src/stores/chat-store.ts`
- `apps/web/src/services/chat.ts`
- `packages/shared/src/chat.ts`
- `packages/shared/src/schedule.ts`

---

## 8. 验证方案

本次采用最小验证闭环。

### 8.1 纯文本场景验证

发送一个不会触发工具调用的普通问题。

验收标准：

- assistant 文本在前端逐步增长
- 不再等整条回复完成后一次性出现

### 8.2 Tool 场景验证

发送一个会触发工具调用的问题。

验收标准：

- assistant 文本仍可增量显示
- 现有 tool_started / tool_completed / tool_failed 事件不被破坏
- 最终消息仍能正常闭环

### 8.3 网络侧验证

通过浏览器开发者工具观察 `/chat/stream`：

- 响应应在请求未结束前持续增长
- 不应只在请求结束时一次性返回完整内容

### 8.4 失败回归验证

至少验证一次异常路径：

- 模型错误或空响应不会导致 controller 卡死
- 前端能维持现有错误处理行为

---

## 9. 风险与后续事项

### 风险 1：chunk 文本提取与当前 helper 不完全兼容

如果现有 `readChunkText(...)` 只适配完整 `AIMessage` 内容，而不适配流式 chunk 内容，需要做最小兼容修补。

处理原则：

- 只补当前 LangChain message content 需要的最小分支
- 不引入新的抽象层

### 风险 2：聚合后的最终 response 与 tool call 读取不兼容

如果 LangChainJS 的 chunk 聚合结果不能直接被 `readToolCalls(...)` 消费，需要在 `AgentService` 内做最小归一化处理。

处理原则：

- 只在 agent 内局部修补
- 不扩散到 shared/controller/front-end

### 风险 3：Provider 流式行为与 OpenAI 兼容层存在差异

当前 `LlmService` 使用 `ChatOpenAI` + DeepSeek OpenAI-compatible base URL。如果 provider 的流式细节和标准 OpenAI 存在差异，可能需要额外配置或验证。

本次优先顺序：

1. 先改调用方式为 `stream()`
2. 再通过真实请求验证 provider 是否持续返回 chunk
3. 如有必要，再对 `LlmService` 做最小 provider 兼容修补

---

## 10. 结论

本次设计采用最小改造策略：

- 保留 `/chat/stream`
- 保留 AI SDK `data` 协议
- 保留前端 `useChat`
- 保留 controller 当前 data stream 写法
- 只把 `AgentService` 的模型调用从 `invoke()` 改成 `stream()`
- 在流式消费 chunk 时持续发 `text_delta`
- 在流结束后再处理 tool calls

这能以最小代价修复“文本一次性输出”的核心问题，同时尽量不影响现有 execution / tool 结构。
