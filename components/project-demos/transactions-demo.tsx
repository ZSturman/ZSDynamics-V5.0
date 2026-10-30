"use client";

import { useDemoAnalytics } from "@/lib/use-demo-analytics";
import { useState } from "react";

type Entry = { id: number; title: string; cents: number; state: "approved" | "pending" | "settled" };
const initial: Entry[] = [
  { id: 1, title: "Dinner · Maya owes you", cents: 2400, state: "approved" },
  { id: 2, title: "Train tickets · You owe Maya", cents: -1800, state: "approved" },
  { id: 3, title: "Groceries · Maya owes you", cents: 3100, state: "pending" },
];
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(cents) / 100);

export function TransactionsDemo() {
  const demo = useDemoAnalytics("transactions");
  const [entries, setEntries] = useState(initial);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("owed");
  const [message, setMessage] = useState("");
  const balance = entries.filter(e => e.state === "approved").reduce((sum, e) => sum + e.cents, 0);
  return <div className="space-y-6">
    <section className="rounded-2xl border bg-card p-6 space-y-2" aria-label="Sample balance">
      <p className="text-sm text-muted-foreground">Your balance with Maya</p>
      <h2 className="text-3xl font-semibold" data-testid="demo-balance">{money(balance)}</h2>
      <p>{balance > 0 ? "Maya owes you" : balance < 0 ? "You owe Maya" : "All settled"}</p>
      <p className="text-sm text-muted-foreground">Pending requests are excluded until approved.</p>
      <button className="rounded-lg border px-4 py-2 disabled:opacity-40" disabled={balance === 0} onClick={() => { if (entries.find(e => e.id === 3)?.state === "approved") demo.complete(); else demo.start(); setEntries(entries.map(e => e.state === "approved" ? { ...e, state: "settled" } : e)); setMessage("Sample balance settled. No payment was made."); }}>Settle sample balance</button>
    </section>
    <section aria-label="Sample transactions" className="space-y-3">
      <h2 className="text-xl font-semibold">Shared activity</h2>
      {entries.map(entry => <article key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div><h3 className="font-medium">{entry.title}</h3><p className="text-sm text-muted-foreground">{entry.state} · {money(entry.cents)}</p></div>
        {entry.state === "pending" && <button className="rounded-lg border px-4 py-2" onClick={() => { demo.start(); setEntries(entries.map(e => e.id === entry.id ? { ...e, state: "approved" } : e)); setMessage("Sample request approved. Balance updated."); }}>Approve request</button>}
      </article>)}
    </section>
    <form className="grid gap-3 rounded-xl border p-5" onSubmit={e => {
      e.preventDefault();
      demo.start();
      if (!/^\d{1,5}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || !title.trim()) { setMessage("Enter a title and a positive amount with up to two decimal places."); return; }
      const cents = Math.round(Number(amount) * 100) * (direction === "owed" ? 1 : -1);
      setEntries([...entries, { id: Math.max(...entries.map(item => item.id)) + 1, title: `${title.trim()} · ${direction === "owed" ? "Maya owes you" : "You owe Maya"}`, cents, state: "pending" }]);
      setTitle(""); setAmount(""); setMessage("Sample request added. Approve it to update the balance.");
    }}>
      <h2 className="text-xl font-semibold">Try a shared expense</h2>
      <label htmlFor="expense-title">Description</label><input id="expense-title" className="rounded-lg border bg-background p-3" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder="Museum tickets" required />
      <label htmlFor="expense-amount">Amount owed ($)</label><input id="expense-amount" className="rounded-lg border bg-background p-3" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="12.50" required />
      <label htmlFor="expense-direction">Who owes whom?</label><select id="expense-direction" className="rounded-lg border bg-background p-3" value={direction} onChange={e => setDirection(e.target.value)}><option value="owed">Maya owes you</option><option value="owe">You owe Maya</option></select>
      <button className="rounded-lg bg-primary px-4 py-3 text-primary-foreground">Add sample request</button>
    </form>
    <p role="status" className="text-sm">{message}</p>
    <button className="underline" onClick={() => { demo.reset(); setEntries(initial); setTitle(""); setAmount(""); setMessage("Demo reset."); }}>Reset demo</button>
  </div>;
}
