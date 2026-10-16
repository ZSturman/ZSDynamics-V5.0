"use client";

import { useState } from "react";
import Image from "next/image";
import { workspaceRelease as release } from "@/lib/better-workspace";

const steps = [
  { title: "Overview", heading: "Know where to begin", body: "Overview keeps your next task close to the project, idea and notes behind it. This garden journal is the app’s fictional sample workspace.", image: "mac-personal-sample.webp", width: 1280, height: 800, alt: "Actual Mac personal Overview showing the garden journal sample" },
  { title: "Projects & tasks", heading: "Give the idea a place to grow", body: "A project holds the context. Link a task to it, set a priority and choose a small next action. Try completing the practice task below.", image: "mac-personal-project-build8.png", width: 1280, height: 800, alt: "Actual Mac sample project editor for Garden journal" },
  { title: "Ideas", heading: "Keep a possibility without making it a commitment", body: "Keep an idea nearby until you are ready to act. The advanced connected workspace adds priority and scoring so you can compare what deserves attention.", image: "iphone-idea-scoring-optimized.webp", width: 1206, height: 2622, alt: "Actual iPhone connected sample idea priority and scoring" },
  { title: "Quick Capture", heading: "Catch the thought. Organize it later.", body: "Use Quick Capture / Ingest to save a thought, link or file, then review where it belongs. Try a fictional text capture below; it stays only in this page’s memory.", image: "iphone-build8-capture-widget.png", width: 530, height: 532, alt: "Actual Build 8 iPhone Quick Capture widget" },
  { title: "Progress & work", heading: "Return with the context intact", body: "Completed tasks make progress visible. The advanced Mac’s work history and sessions help you see recent attention. The practice session below illustrates that concept without tracking your activity.", image: "mac-store-overview-optimized.webp", width: 1280, height: 800, alt: "Actual Mac connected sample Overview with next action and workspace organization" },
  { title: "Across devices", heading: "Keep the next step with you", body: "Personal records save offline and sync through private iCloud when available. The optional connected folder workspace uses the advanced Mac’s index and reviewed changes. This demonstration makes no account or sync connections.", image: "ipad-personal-sample.webp", width: 2064, height: 2752, alt: "Actual iPad sample personal workspace" },
];

export function WorkspaceDemo() {
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [capture, setCapture] = useState("");
  const [captures, setCaptures] = useState<string[]>([]);
  const [session, setSession] = useState(false);
  const [finished, setFinished] = useState(false);
  const current = steps[step];
  function reset() { setComplete(false); setCapture(""); setCaptures([]); setSession(false); setFinished(false); setStep(0); }
  return <div className="space-y-6">
    <nav aria-label="Demo chapters" className="flex flex-wrap gap-2">{steps.map((item, index) => <button key={item.title} type="button" aria-pressed={index === step} onClick={() => setStep(index)} className={`rounded-lg border px-3 py-2 text-sm ${index === step ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{index + 1}. {item.title}</button>)}</nav>
    <section aria-live="polite" aria-atomic="true" className="space-y-4 rounded-xl border p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">{step + 1} / {steps.length} · Guided walkthrough</p><h2 className="text-2xl font-semibold">{current.heading}</h2><p>{current.body}</p>
      <figure className="space-y-2"><Image key={current.image} src={`${release.images}/${current.image}`} alt={current.alt} width={current.width} height={current.height} className="h-auto max-h-[520px] w-full rounded-lg border bg-muted/20 object-contain" /><figcaption className="text-xs text-muted-foreground">{step === 3 ? "Real Build 8 capture widget. Practice text capture in the example below." : "Real app screenshot · Disposable sample data."}</figcaption></figure>
      <div className="flex justify-between gap-3"><button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={step === steps.length - 1} onClick={() => setStep(step + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Next chapter</button></div>
    </section>
    <section className="space-y-5 rounded-xl border bg-accent/20 p-4 sm:p-6" aria-label="Practice workspace">
      <div><p className="text-sm text-muted-foreground">Simplified interactive example</p><h2 className="text-xl font-semibold">Garden journal</h2><p className="text-sm text-muted-foreground">Record small changes. Notice what grows.</p></div>
      <div className="space-y-2"><p className="text-sm font-medium">Next action · High priority</p><label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-4"><input type="checkbox" checked={complete} onChange={e => setComplete(e.target.checked)} className="h-5 w-5" /><span className={complete ? "line-through" : ""}>Sketch the weekly journal</span></label><p role="status" className="text-sm">{complete ? "1 of 1 sample tasks complete — room for the next small step." : "0 of 1 sample tasks complete."}</p><progress aria-label="Sample project progress" value={complete ? 1 : 0} max={1} className="w-full accent-primary" /></div>
      <article className="rounded-lg border bg-background p-4"><h3 className="font-medium">Idea: A reading nook for slow Sundays</h3><p className="text-sm text-muted-foreground">A comfortable chair, warm light and books worth returning to.</p></article>
      <form className="space-y-2" onSubmit={e => { e.preventDefault(); if (capture.trim()) { setCaptures([...captures, capture.trim()]); setCapture(""); } }}><label htmlFor="demo-capture" className="block font-medium">Try a quick capture</label><input id="demo-capture" value={capture} onChange={e => setCapture(e.target.value)} maxLength={240} placeholder="Notice the first autumn leaves" className="w-full rounded-lg border bg-background px-3 py-3" /><button disabled={!capture.trim()} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-40">Capture in demo</button><p className="text-xs text-muted-foreground">Use fictional text. Nothing entered here is saved or sent to a workspace.</p></form>
      <div role="status" aria-label="Demo inbox"><p className="font-medium">Demo inbox · {captures.length}</p>{captures.length > 0 && <ul className="mt-2 list-disc pl-5">{captures.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul>}</div>
      <div className="space-y-2 border-t pt-4"><h3 className="font-medium">Work session</h3><p className="text-sm">{session ? "Sample session active · Sketch the weekly journal" : finished ? "Sample session finished. Your next visit has a little more context." : "Make a little time for the next step."}</p><button type="button" className="rounded-lg border bg-background px-4 py-2" onClick={() => { setSession(!session); if (session) setFinished(true); }}>{session ? "Finish sample session" : "Start sample session"}</button></div>
      <button type="button" onClick={reset} className="text-sm underline">Reset demonstration</button><p className="text-xs text-muted-foreground">All practice changes disappear on refresh. This page does not access the app, personal files, iCloud, Notion or any production database.</p>
    </section>
  </div>;
}
