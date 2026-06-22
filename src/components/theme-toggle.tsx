"use client";

import { useEffect, useMemo, useState } from "react";
import { Sun } from "lucide-react";
import { useTheme } from "next-themes";

const STORAGE_KEY = "ds-theme";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const currentTheme = useMemo(
    () => (resolvedTheme === "light" ? "light" : "dark"),
    [resolvedTheme]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  function toggle() {
    const next = currentTheme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  if (!mounted) {
    return (
      <button className="text-brand-muted hover:text-brand-text transition-colors p-2" aria-label="Carregando tema">
        <Sun className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="text-brand-muted hover:text-brand-text transition-colors p-2"
      aria-label="Alternar tema"
    >
      <Sun className="h-5 w-5" />
    </button>
  );
}
