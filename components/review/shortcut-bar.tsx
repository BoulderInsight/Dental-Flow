"use client";

export function ShortcutBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur px-4 py-2">
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">B</kbd>{" "}
          Business
        </span>
        <span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">P</kbd>{" "}
          Personal
        </span>
        <span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">A</kbd>{" "}
          Ambiguous
        </span>
        <span className="border-l border-border pl-6">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">J</kbd>/
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">&darr;</kbd>{" "}
          Next
        </span>
        <span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">K</kbd>/
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">&uarr;</kbd>{" "}
          Prev
        </span>
        <span className="border-l border-border pl-6">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">R</kbd>{" "}
          Create Rule
        </span>
        <span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">?</kbd>{" "}
          Help
        </span>
      </div>
    </div>
  );
}
