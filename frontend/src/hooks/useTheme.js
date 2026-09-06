import { useEffect, useState } from 'react';

const KEY = 'academiai-theme';

function notifyThemeChange(dark) {
  window.dispatchEvent(
    new CustomEvent('academiai-theme-change', {
      detail: { dark },
    }),
  );
}

export function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(KEY) === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(KEY, dark ? 'dark' : 'light');
    } catch {
      /* storage unavailable */
    }
    notifyThemeChange(dark);
  }, [dark]);

  useEffect(() => {
    const handleThemeChange = (event) => {
      setDark(Boolean(event.detail?.dark));
    };
    window.addEventListener('academiai-theme-change', handleThemeChange);
    return () =>
      window.removeEventListener('academiai-theme-change', handleThemeChange);
  }, []);

  return { dark, toggle: () => setDark((d) => !d) };
}
