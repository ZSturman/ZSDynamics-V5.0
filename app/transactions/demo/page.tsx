import type { Metadata } from "next";
import Link from "next/link";
import { PageColumn, PageFrame } from "@/components/layout/page-frame";
import { TransactionsDemo } from "@/components/project-demos/transactions-demo";
export const metadata: Metadata = { title: "Transactions — Try the demo", description: "Try requesting, approving and settling shared expenses." };
export default function DemoPage() {
 return <PageFrame as="main" className="py-10"><PageColumn className="max-w-3xl space-y-8">
  <header className="space-y-3"><Link className="underline text-sm" href="/projects/transactions">← Transactions</Link><p className="text-sm font-medium text-primary">Interactive browser demo · Fictional data</p><h1 className="text-3xl font-semibold">Try Transactions</h1><p>Try requesting, approving and settling shared expenses.</p><p className="text-sm text-muted-foreground">A simplified walkthrough of the app. Use sample text; entries stay in this page until refresh. No account needed.</p></header>
  <TransactionsDemo />
  <footer className="flex flex-wrap gap-4 border-t pt-6"><Link href="https://transactions-lmct.vercel.app/login" className="rounded-lg bg-primary px-5 py-3 text-primary-foreground">Open Transactions</Link><Link href="/projects/transactions" className="rounded-lg border px-5 py-3">Project story</Link></footer>
 </PageColumn></PageFrame>;
}
