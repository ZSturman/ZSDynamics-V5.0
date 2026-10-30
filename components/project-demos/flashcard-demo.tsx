"use client";
import { useDemoAnalytics } from "@/lib/use-demo-analytics";
import { useState } from "react";
const cards = [
  ["Which planet has the largest rings?", "Saturn. Its rings are mostly pieces of ice and rock."],
  ["What does a plant use photosynthesis for?", "To turn light energy into chemical energy, producing sugars from carbon dioxide and water."],
  ["What is 12 squared?", "144: twelve multiplied by twelve."],
];
export function FlashcardDemo() {
  const demo = useDemoAnalytics("recallable");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<string[]>([]);
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">Sample deck · {index + 1} of {cards.length}</p>
    <section className="rounded-2xl border p-8 space-y-6"><h2 className="text-2xl font-semibold">{cards[index][0]}</h2>{flipped ? <p>{cards[index][1]}</p> : <button className="rounded-lg bg-primary px-5 py-3 text-primary-foreground" onClick={() => { demo.start(); setFlipped(true); }}>Show answer</button>}</section>
    {flipped && <div className="flex flex-wrap gap-3">{["Hard", "Good", "Easy"].map(rating => <button key={rating} className="rounded-lg border px-5 py-3" onClick={() => { if (ratings.length === 2) demo.complete(); setRatings([...ratings, rating]); setIndex((index + 1) % cards.length); setFlipped(false); }}>{rating}</button>)}</div>}
    <p role="status">{ratings.length} sample {ratings.length === 1 ? "review" : "reviews"} completed.</p>
    <button className="underline" onClick={() => { demo.reset(); setIndex(0); setFlipped(false); setRatings([]); }}>Reset demo</button>
  </div>;
}
