"use client";
import { useState } from "react";
const drafts = [
  { title: "A small project milestone", text: "A little progress today: our sample garden journal now has a weekly view. What helps you keep a project moving?" },
  { title: "Learning in public", text: "This week I tried sketching the smallest useful version before adding features. A good reminder to start with one clear action." },
];
export function EditorialDemo() {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(drafts[0].text);
  const [confirm, setConfirm] = useState(false);
  const [decisions, setDecisions] = useState<string[]>([]);
  const decide = (decision: string) => { setDecisions([...decisions, `${drafts[index].title}: ${decision}`]); setIndex(index + 1); setText(drafts[index + 1]?.text || ""); setConfirm(false); };
  return <div className="space-y-5">
    {index < drafts.length ? <>
      <p className="text-sm text-muted-foreground">Draft {index + 1} of {drafts.length}</p>
      <h2 className="text-2xl font-semibold">{drafts[index].title}</h2>
      <label htmlFor="sample-draft" className="block font-medium">Publication text</label>
      <textarea id="sample-draft" className="min-h-36 w-full rounded-xl border bg-background p-4" value={text} maxLength={280} onChange={e => { setText(e.target.value); setConfirm(false); }} />
      <div className="grid gap-4 sm:grid-cols-2">{["LinkedIn", "Bluesky"].map(destination => <article key={destination} className="rounded-xl border p-5 space-y-3"><h3 className="font-semibold">{destination} preview</h3><p className="text-sm text-muted-foreground">Sample author · Selected destination</p><p className="whitespace-pre-wrap break-words">{text || "Your draft preview"}</p></article>)}</div>
      <div className="flex flex-wrap gap-3"><button className="rounded-lg border px-4 py-3" onClick={() => decide("Rejected")}>Reject &amp; next</button><button disabled={!text.trim()} className="rounded-lg bg-primary px-4 py-3 text-primary-foreground disabled:opacity-40" onClick={() => setConfirm(true)}>Mark ready</button></div>
      {confirm && <section className="rounded-xl border p-5 space-y-3" aria-label="Confirm sample approval"><p>Approve this exact text for both selected destinations?</p><p className="text-sm text-muted-foreground">This demo records the decision. It does not publish a post.</p><button className="rounded-lg border px-4 py-2" onClick={() => decide("Ready")}>Confirm approval</button></section>}
    </> : <h2 className="text-2xl font-semibold">Sample queue reviewed</h2>}
    <div role="status" className="space-y-2">{decisions.map(decision => <p key={decision}>{decision}</p>)}</div>
    <button className="underline" onClick={() => { setIndex(0); setText(drafts[0].text); setConfirm(false); setDecisions([]); }}>Reset demo</button>
  </div>;
}
