import { Card } from '../ui';

export function EmptyChatState() {
  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-4 rounded-full bg-[rgb(var(--accent)/0.1)] p-4">
        <svg className="h-8 w-8 text-[rgb(var(--accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-[rgb(var(--foreground))]">开始一个新的对话</h2>
      <p className="mt-2 text-sm text-[rgb(var(--foreground-secondary))]">
        在下方输入框中输入消息开始聊天
      </p>
    </Card>
  );
}
