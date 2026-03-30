import type { FormEvent } from 'react';
import { Button, Textarea } from '../ui';

export function ChatComposer(props: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    props.onSubmit();
  };

  return (
    <form className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4" onSubmit={handleSubmit}>
      <Textarea
        rows={4}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <div className="flex justify-end">
        <Button disabled={props.disabled} type="submit">
          Send
        </Button>
      </div>
    </form>
  );
}
