import type { RunSummary } from './schedule';
import type { ToolExecutionSummary } from './tool';

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
  runId?: string | null;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
}

export interface ChatMessageTimelineEntry {
  kind: 'message';
  id: string;
  sessionId: string;
  runId: string | null;
  messageId: string;
  createdAt: string;
  message: ChatMessage;
}

export interface ChatToolExecutionTimelineEntry {
  kind: 'tool_execution';
  id: string;
  sessionId: string;
  runId: string | null;
  messageId: string | null;
  createdAt: string;
  toolExecution: ToolExecutionSummary;
}

export interface ChatRunStatusTimelineEntry {
  kind: 'run_status';
  id: string;
  sessionId: string;
  runId: string | null;
  messageId: string | null;
  createdAt: string;
  run: RunSummary;
}

export type ChatTimelineEntry =
  | ChatMessageTimelineEntry
  | ChatToolExecutionTimelineEntry
  | ChatRunStatusTimelineEntry;

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

export interface ListChatSessionsResponse {
  sessions: ChatSessionSummary[];
}

export interface GetChatMessagesResponse {
  session: ChatSessionSummary;
  messages: ChatMessage[];
}

export interface GetChatTimelineResponse {
  session: ChatSessionSummary;
  run: RunSummary | null;
  messages: ChatMessage[];
  toolExecutions: ToolExecutionSummary[];
  timeline: ChatTimelineEntry[];
}

export interface SendChatMessageRequest {
  sessionId?: string;
  content: string;
}
