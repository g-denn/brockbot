import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <section className="fade-in py-12 sm:py-24">
      <p className="mb-4 text-sm font-medium text-muted-foreground">BROCKBOT · EAT. SLEEP. DELEGATE. CONQUER. REPEAT.</p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Hand work to a teammate. Review what comes back.</h1>
      <p className="mt-6 max-w-2xl text-lg text-muted-foreground">Brockbot gives each local teammate a focused workspace, visible activity, and a review step before work is marked done.</p>
      <div className="flex gap-3">
        <Link href="/workspace"><Button>Open workspace</Button></Link>
      </div>
      <div className="mt-16 grid gap-4 border-t border-border pt-8 sm:grid-cols-3"><p><strong className="block">Message first</strong><span className="text-sm text-muted-foreground">Name a teammate, define its job, and give it a task.</span></p><p><strong className="block">Work you can inspect</strong><span className="text-sm text-muted-foreground">See activity and download the files it creates.</span></p><p><strong className="block">Review stays with you</strong><span className="text-sm text-muted-foreground">Review each result before using it. No external app connectors are built in.</span></p></div>
    </section>
  );
}
