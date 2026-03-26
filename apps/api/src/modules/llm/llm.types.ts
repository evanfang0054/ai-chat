export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmStreamDelta {
  type: 'delta';
  text: string;
}

export interface LlmStreamCompleted {
  type: 'completed';
}

export interface LlmStreamFailed {
  type: 'error';
  message: string;
}

export type LlmStreamEvent = LlmStreamDelta | LlmStreamCompleted | LlmStreamFailed;
