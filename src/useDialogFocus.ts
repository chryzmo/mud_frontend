import { RefObject, useEffect } from 'react';

// For a modal sheet: move focus into it when it opens, keep Tab inside it, and give
// focus back to whatever had it (the input, usually) when it closes.
export function useDialogFocus(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    const before = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(el?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, [ref]);
}
