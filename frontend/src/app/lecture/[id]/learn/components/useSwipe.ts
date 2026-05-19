"use client";

import { useRef, useCallback } from "react";

interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Touch swipe hook for mobile card navigation.
 * Returns touch handlers to spread onto a container element.
 * Minimum 50px horizontal swipe with velocity check to avoid false triggers.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight }: SwipeCallbacks) {
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const dt = Date.now() - touchStart.current.t;
      touchStart.current = null;

      // Must be mostly horizontal and at least 50px
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < 50 || absDy > absDx * 0.7 || dt > 500) return;

      if (dx < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    },
    [onSwipeLeft, onSwipeRight]
  );

  return { onTouchStart, onTouchEnd };
}
