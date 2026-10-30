import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";


export function Nav() {
  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold">Brockbot</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/workspace" className="hover:underline">Workspace</Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
