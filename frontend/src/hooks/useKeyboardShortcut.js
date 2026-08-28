import { useEffect, useMemo, useRef } from 'react';

/**
 * Register a global keyboard shortcut.
 *
 * @param {string|string[]} keys  Single key or combo, e.g. "mod+k", "?", "Escape", "/".
 *                                Use "mod" to auto-map to Cmd on Mac and Ctrl elsewhere.
 * @param {(e: KeyboardEvent) => void} handler
 * @param {{enabled?: boolean, allowInInputs?: boolean}} options
 */
export function useKeyboardShortcut(keys, handler, options = {}) {
  const { enabled = true, allowInInputs = false } = options;
  const combos = useMemo(
    () => (Array.isArray(keys) ? keys : [keys]).map((k) => k.toLowerCase().split('+').map((p) => p.trim())),
    [keys],
  );
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const isMac =
      typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

    const onKey = (e) => {
      for (const parts of combos) {
        const needsMod = parts.some((p) => ['mod', 'cmd', 'ctrl'].includes(p));
        const needsShift = parts.includes('shift');
        const needsAlt = parts.includes('alt') || parts.includes('option');
        const keyPart = parts
          .filter((p) => !['mod', 'cmd', 'ctrl', 'shift', 'alt', 'option'].includes(p))
          .join('+');

        const modHeld = isMac ? e.metaKey : e.ctrlKey;
        const modMatches = needsMod
          ? modHeld && (isMac ? !e.ctrlKey : !e.metaKey)
          : !modHeld;
        const shiftMatches = needsShift === e.shiftKey;
        const altMatches = needsAlt === e.altKey;

        const pressedKey = e.key?.toLowerCase() ?? '';
        const keyMatches =
          keyPart === pressedKey ||
          (keyPart === 'escape' && pressedKey === 'escape') ||
          (keyPart === 'enter' && pressedKey === 'enter') ||
          (keyPart === ' ' && pressedKey === ' ') ||
          (keyPart === '/' && pressedKey === '/') ||
          (keyPart === '?' && pressedKey === '?');

        if (!(modMatches && shiftMatches && altMatches && keyMatches)) continue;

        if (!allowInInputs) {
          const tag = (e.target?.tagName || '').toUpperCase();
          const editable = e.target?.isContentEditable;
          const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable;
          if (inField && !needsMod) continue;
        }

        e.preventDefault();
        handlerRef.current(e);
        return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combos, enabled, allowInInputs]);
}

export default useKeyboardShortcut;
