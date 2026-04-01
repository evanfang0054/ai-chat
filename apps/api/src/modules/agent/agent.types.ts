import type {
  ChatRunEvent,
  FailureCategory,
  RunStage,
  RunSummary,
  RunTriggerSource,
  ToolExecutionSummary,
  ToolName
} from '@ai-chat/shared';

export interface AgentHistoryMessage {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
}

export interface ForcedToolCall {
  name: ToolName;
  input: Record<string, unknown>;
}

export type ExecutionIntent = 'chat' | 'schedule' | 'manual_retry' | 'diagnostics_replay';

export interface ExecutionRequest {
  userId: string;
  sessionId: string;
  messageId?: string;
  runId?: string;
  scheduleId?: string;
  requestId?: string;
  triggerSource: RunTriggerSource;
  history: AgentHistoryMessage[];
  prompt: string;
  intent?: ExecutionIntent;
  forcedToolCall?: ForcedToolCall;
}

export interface ExecutionDiagnostics {
  requestId: string;
  sessionId: string;
  runId: string | null;
  messageId: string | null;
  triggerSource: RunTriggerSource;
}

export interface IntentRouteResult {
  intent: ExecutionIntent;
  systemPrompt: string;
  forcedToolCall?: ForcedToolCall;
  maxIterations: number;
  diagnostics: ExecutionDiagnostics;
}

export interface AgentRunContext {
  userId: string;
  sessionId: string;
  messageId: string | null;
  runId: string | null;
  scheduleId: string | null;
  requestId: string;
  triggerSource: RunTriggerSource;
  intent: ExecutionIntent;
  maxIterations: number;
}

export interface AgentFailureDetails {
  stage: RunStage;
  errorCategory: FailureCategory;
  errorMessage: string;
  repairAction?: string | null;
}

export type AgentLoopEvent =
  | { type: 'run_stage_changed'; run: RunSummary }
  | { type: 'text_delta'; runId: string; messageId: string; textDelta: string }
  | { type: 'tool_started'; toolExecution: ToolExecutionSummary }
  | { type: 'tool_progressed'; toolExecution: ToolExecutionSummary }
  | { type: 'tool_completed'; toolExecution: ToolExecutionSummary }
  | { type: 'tool_failed'; toolExecution: ToolExecutionSummary }
  | { type: 'run_repaired'; run: RunSummary; repairAction: string };

export interface StreamChatReplyResult {
  text: string;
  run: RunSummary;
  events: AgentLoopEvent[];
}

export type AgentStreamEvent = ChatRunEvent;
