import { useCallback, useEffect, useRef, useState } from 'react';
import { readingApi } from '@/services/api';

const RESUME_THRESHOLD = 5;

export function useReadingPosition(resourceId) {
  const [percentage, setPercentage] = useState(0);
  const [savedPosition, setSavedPosition] = useState(null);
  const [isResuming, setIsResuming] = useState(false);
  const savedIdRef = useRef(null);
  const saveTimerRef = useRef(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!resourceId) return;
    restoredRef.current = false;
    savedIdRef.current = null;
    // eslint-disable-next-line react/set-state-in-effect
    setPercentage(0);
    setSavedPosition(null);
    setIsResuming(false);

    let cancelled = false;
    readingApi.getPosition(resourceId).then((pos) => {
      if (cancelled || !pos) return;
      savedIdRef.current = pos.id;
      setSavedPosition(pos);
      if (pos.scroll_percentage > RESUME_THRESHOLD) {
        setIsResuming(true);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [resourceId]);

  const save = useCallback((pct) => {
    if (!resourceId) return;
    const clamped = Math.max(0, Math.min(100, pct));
    setPercentage(clamped);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        if (savedIdRef.current) {
          await readingApi.updatePosition(savedIdRef.current, { scroll_percentage: clamped });
        } else {
          const result = await readingApi.savePosition(resourceId, { scroll_percentage: clamped });
          savedIdRef.current = result.id;
        }
      } catch { /* silent */ }
    }, 2000);
  }, [resourceId]);

  const restore = useCallback((scrollRef) => {
    if (!scrollRef?.current || !savedPosition || restoredRef.current) return;
    const el = scrollRef.current;
    const total = el.scrollHeight - el.clientHeight;
    if (total <= 0) return;
    el.scrollTop = (savedPosition.scroll_percentage / 100) * total;
    restoredRef.current = true;
    setIsResuming(false);
  }, [savedPosition]);

  const dismissResume = useCallback(() => {
    setIsResuming(false);
    restoredRef.current = true;
  }, []);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  return { percentage, savedPosition, isResuming, save, restore, dismissResume };
}
