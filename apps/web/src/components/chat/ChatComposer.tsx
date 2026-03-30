import { Button, Textarea } from '../ui';

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
      <div className="flex justify-end">
        <Button disabled={props.disabled} onClick={props.onSubmit}>
          Send
        </Button>
      </div>
    </div>
  );
}
