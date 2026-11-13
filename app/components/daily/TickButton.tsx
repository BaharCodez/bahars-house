/** The "I did it today" pill: a filled call to action until it's ticked. */
export default function TickButton({
  done,
  busy,
  onTick,
  idleLabel,
  doneLabel,
  className,
}: {
  done: boolean;
  busy: boolean;
  onTick: () => void;
  idleLabel: string;
  doneLabel: string;
  className?: string;
}) {
  const label = done ? doneLabel : busy ? "…" : idleLabel;
  const look = done
    ? "bg-accent/30 text-ink cursor-default"
    : "bg-accent text-accent-ink hover:opacity-90";
  const classes = [
    "font-pixel",
    className,
    "rounded-full px-4 py-2 text-sm transition-opacity",
    look,
  ];
  return (
    <button
      type="button"
      onClick={onTick}
      disabled={done || busy}
      className={classes.filter(Boolean).join(" ")}
    >
      {label}
    </button>
  );
}
