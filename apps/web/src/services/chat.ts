import type {
  ChatMessage,
  GetChatTimelineResponse,
  ListChatSessionsResponse,
  SendChatMessageRequest,
  ToolExecutionSummary
} from '@ai-chat/shared';
import type { UIMessage } from 'ai';
import { apiFetch } from '../lib/api';
import { getApiBaseUrl } from '../lib/env';

export function listChatSessions(accessToken: string) {
  return apiFetch<ListChatSessionsResponse>('/chat/sessions', { accessToken });
}

export function getChatMessages(accessToken: string, sessionId: string) {
  return apiFetch<GetChatTimelineResponse>(`/chat/sessions/${sessionId}/messages`, { accessToken });
}

export function getChatStreamUrl() {
  return `${getApiBaseUrl()}/chat/stream`;
}

export function createChatRequestBody(payload: SendChatMessageRequest) {
  return {
    content: payload.content,
    ...(payload.sessionId ? { sessionId: payload.sessionId } : {})
  };
}

function toMessageRole(role: ChatMessage['role']): UIMessage['role'] {
  if (role === 'USER') {
    return 'user';
  }

  if (role === 'ASSISTANT') {
    return 'assistant';
  }

  return 'system';
}

function getToolInvocationState(toolExecution: ToolExecutionSummary) {
  if (toolExecution.status === 'RUNNING') {
    return 'call' as const;
  }

  return 'result' as const;
}

function getToolInvocationResult(toolExecution: ToolExecutionSummary) {
  if (toolExecution.status === 'SUCCEEDED') {
    return toolExecution.output ? safeParseJson(toolExecution.output) : {};
  }

  return {
    error: toolExecution.errorMessage ?? 'Tool execution failed'
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { value };
  }
}

function toToolInvocationPart(toolExecution: ToolExecutionSummary) {
  const args = toolExecution.input ? safeParseJson(toolExecution.input) : {};

  return {
    type: 'tool-invocation' as const,
    toolInvocation:
      getToolInvocationState(toolExecution) === 'call'
        ? {
            state: 'call' as const,
            toolCallId: toolExecution.id,
            toolName: toolExecution.toolName,
            args
          }
        : {
            state: 'result' as const,
            toolCallId: toolExecution.id,
            toolName: toolExecution.toolName,
            args,
            result: getToolInvocationResult(toolExecution)
          }
  };
}

function getToolSortTime(toolExecution: ToolExecutionSummary) {
  return toolExecution.startedAt ?? toolExecution.finishedAt ?? '';
}

function getMessageTime(message: ChatMessage) {
  return message.createdAt;
}

function takeToolExecutionsForMessage(
  toolExecutions: ToolExecutionSummary[],
  message: ChatMessage,
  hasLaterAssistantMessage: boolean
) {
  if (!hasLaterAssistantMessage) {
    return toolExecutions.splice(0, toolExecutions.length);
  }

  const messageTime = getMessageTime(message);
  let count = 0;

  while (count < toolExecutions.length && getToolSortTime(toolExecutions[count]) <= messageTime) {
    count += 1;
  }

  return toolExecutions.splice(0, count);
}

export function createUiMessagesFromTimeline(timeline: GetChatTimelineResponse): UIMessage[] {
  const pendingToolExecutions = [...timeline.toolExecutions].sort((left, right) =>
    getToolSortTime(left).localeCompare(getToolSortTime(right))
  );
  const assistantIndexes = timeline.messages.reduce<number[]>((indexes, message, index) => {
    if (message.role === 'ASSISTANT') {
      indexes.push(index);
    }

    return indexes;
  }, []);

  return timeline.messages.map((message, index) => {
    const assistantPosition = assistantIndexes.indexOf(index);
    const hasLaterAssistantMessage = assistantPosition !== -1 && assistantPosition < assistantIndexes.length - 1;
    const toolParts =
      message.role === 'ASSISTANT'
        ? takeToolExecutionsForMessage(pendingToolExecutions, message, hasLaterAssistantMessage).map(toToolInvocationPart)
        : [];

    return {
      id: message.id,
      role: toMessageRole(message.role),
      content: message.content,
      createdAt: new Date(message.createdAt),
      parts: [
        ...(message.content ? [{ type: 'text' as const, text: message.content }] : []),
        ...toolParts
      ]
    } satisfies UIMessage;
  });
}
