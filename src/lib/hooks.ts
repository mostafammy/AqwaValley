import { useState, useEffect, useRef } from "react";

/**
 * Custom hook to detect when an element enters the viewport using IntersectionObserver.
 * Useful for triggering animations or lazy-loading data.
 *
 * @param options - IntersectionObserver configuration (threshold, root, rootMargin).
 * @returns { targetRef, isVisible } - Ref to attach to the element and visibility state.
 */
export function useIntersectionObserver(options: IntersectionObserverInit = { threshold: 0.1 }) {
  const [isVisible, setIsVisible] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // SSR or old browser check
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setIsVisible(true);
        observer.disconnect(); // Only trigger once
      }
    }, options);

    const currentTarget = targetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      observer.disconnect();
    };
  }, [options]);

  return { targetRef, isVisible };
}
