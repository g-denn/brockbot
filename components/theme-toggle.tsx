"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Mode = "light" | "dark" | "system";

function apply(mode: Mode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

// Light by default. Cycles light -> dark -> system.
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Mode | null) ?? "light";
    setMode(saved);
    apply(saved);
  }, []);

  function next() {
    const order: Mode[] = ["light", "dark", "system"];
    const m = order[(order.indexOf(mode) + 1) % order.length];
    setMode(m);
    localStorage.setItem("theme", m);
    apply(m);
  }

  return (
    <Button variant="outline" onClick={next} aria-label="Toggle theme" className="h-9 px-3">
      {mode}
    </Button>
  );
}
