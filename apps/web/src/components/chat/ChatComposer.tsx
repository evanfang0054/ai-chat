export function ChatComposer(props: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <textarea
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <button disabled={props.disabled} onClick={props.onSubmit}>
        Send
      </button>
    </div>
  );
}
