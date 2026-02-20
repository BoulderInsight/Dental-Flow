"use client";

import { useEffect } from "react";

interface ShortcutActions {
  onBusiness: () => void;
  onPersonal: () => void;
  onAmbiguous: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onCreateRule: () => void;
  onToggleHelp: () => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip when typing in form fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          actions.onBusiness();
          break;
        case "p":
          e.preventDefault();
          actions.onPersonal();
          break;
        case "a":
          e.preventDefault();
          actions.onAmbiguous();
          break;
        case "j":
        case "arrowdown":
          e.preventDefault();
          actions.onNext();
          break;
        case "k":
        case "arrowup":
          e.preventDefault();
          actions.onPrevious();
          break;
        case "r":
          e.preventDefault();
          actions.onCreateRule();
          break;
        case "?":
          e.preventDefault();
          actions.onToggleHelp();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions]);
}
