import type { Grasp } from "@/app/lib/daily/highlights";

/** A highlighted passage, tinted by how it landed, with its note under it. */
export default function MarkedQuote({
  quote,
  note,
  grasp,
}: {
  quote: string;
  note: string;
  grasp: Grasp;
}) {
  return (
    <>
      <p className={`hl hl-${grasp} text-ink inline text-sm`}>“{quote}”</p>
      {note && <p className="text-ink-soft mt-1 text-sm italic">{note}</p>}
    </>
  );
}
