import { Card } from '../ui';

export function EmptyChatState() {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">开始一个新的对话</h2>
      <p className="mt-2 text-sm text-slate-300">输入你的第一条消息，系统会自动创建会话。</p>
    </Card>
  );
}
