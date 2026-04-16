"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

interface MobileSidebarDrawerProps {
  menuAriaLabel: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}

export function MobileSidebarDrawer({
  menuAriaLabel,
  rightSlot,
  children,
}: MobileSidebarDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  function openDrawer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsClosing(false);
    setIsOpen(true);
  }

  function closeDrawer() {
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, 280);
  }

  const isAnimatingOpen = isOpen && !isClosing;

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusedElementRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
      previousFocusedElementRef.current?.focus();
    };
  }, [isOpen]);

  return (
    <>
      {/*
        Sem barra horizontal full-width: controles flutuantes (&lt; md).
        Em telas maiores o shell usa sidebar fixa.
      */}
      <div
        className="pointer-events-none fixed right-3 z-40 flex max-w-[calc(100vw-1.5rem)] justify-end md:hidden"
        style={{ top: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-brand-border bg-brand-surface/95 px-1 py-1 shadow-lg backdrop-blur-sm ring-1 ring-brand-neon/10">
          <button
            ref={openButtonRef}
            type="button"
            onClick={openDrawer}
            className="rounded-lg p-2 text-brand-muted transition-all duration-300 hover:bg-brand-surface hover:text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-neon"
            aria-label={menuAriaLabel}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          {rightSlot}
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
              isAnimatingOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu lateral do dashboard"
            className={`relative flex w-[280px] max-w-[84%] flex-col bg-brand-surface shadow-xl transition-transform duration-300 ease-out ${
              isAnimatingOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="h-1 w-full bg-gradient-to-r from-brand-neon/0 via-brand-neon/60 to-brand-neon/0" />
            <div className="absolute right-3 top-3 z-10">
              <button
                ref={closeButtonRef}
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-border bg-brand-surface/95 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-neon"
                onClick={closeDrawer}
              >
                <span className="sr-only">Fechar barra lateral</span>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="h-full w-full pt-8">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
