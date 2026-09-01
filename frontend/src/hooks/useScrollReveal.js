import { useEffect, useRef, useState } from 'react';

const mqReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Returns a ref and an `isVisible` boolean. The element fades in once
 * when it enters the viewport. Respects prefers-reduced-motion.
 *
 * @param {Object} [options]
 * @param {number} [options.threshold=0.15]  IntersectionObserver threshold
 * @param {string} [options.rootMargin='0px 0px -40px 0px']  Observer root margin
 */
export function useScrollReveal({
  threshold = 0.15,
  rootMargin = '0px 0px -40px 0px',
} = {}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(() => {
    // Reduce: render the final state immediately, no observer needed.
    if (mqReduced()) return true;
    return false;
  });

  useEffect(() => {
    // Reduced motion: the lazy initializer already shows the final state, so
    // there is nothing to observe.
    const el = ref.current;
    if (!el || mqReduced()) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { ref, isVisible };
}
