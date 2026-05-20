"use client";

import { useEffect, useRef, useCallback, useState } from "react";

/**
 * useModal — Accessible modal/dialog behavior hook.
 *
 * Provides:
 * - Open/close state management
 * - ESC key to close
 * - Click-outside to close
 * - Focus trap (Tab/Shift+Tab cycle within modal)
 * - Focus restore (returns focus to trigger element on close)
 * - Body scroll lock while open
 *
 * Usage:
 *   const { isOpen, open, close, modalRef, triggerRef } = useModal();
 *
 *   <button ref={triggerRef} onClick={open}>Open</button>
 *   {isOpen && (
 *     <div ref={modalRef} role="dialog" aria-modal="true">
 *       <button onClick={close}>Close</button>
 *     </div>
 *   )}
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export interface UseModalOptions {
  /** Called when the modal opens */
  onOpen?: () => void;
  /** Called when the modal closes */
  onClose?: () => void;
  /** Disable closing on ESC key (default: false) */
  disableEsc?: boolean;
  /** Disable closing on click outside (default: false) */
  disableClickOutside?: boolean;
  /** Start in open state (default: false) */
  initialOpen?: boolean;
}

export function useModal(options: UseModalOptions = {}) {
  const {
    onOpen,
    onClose,
    disableEsc = false,
    disableClickOutside = false,
    initialOpen = false,
  } = options;

  const [isOpen, setIsOpen] = useState(initialOpen);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousOverflowRef = useRef<string>("");

  const open = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const toggle = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [isOpen, open, close]);

  // Focus trap + ESC handler
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Lock body scroll
    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus first focusable element inside modal
    const focusables = modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
      // Small delay to let React render complete
      requestAnimationFrame(() => focusables[0]?.focus());
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close
      if (e.key === "Escape" && !disableEsc) {
        e.preventDefault();
        close();
        return;
      }

      // Tab trap
      if (e.key === "Tab") {
        const currentFocusables = modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (currentFocusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = currentFocusables[0];
        const last = currentFocusables[currentFocusables.length - 1];

        if (e.shiftKey) {
          // Shift+Tab on first → wrap to last
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab on last → wrap to first
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore body scroll
      document.body.style.overflow = previousOverflowRef.current;
    };
  }, [isOpen, close, disableEsc]);

  // Click outside handler
  useEffect(() => {
    if (!isOpen || disableClickOutside) return;

    const handleClickOutside = (e: MouseEvent) => {
      const modal = modalRef.current;
      if (modal && !modal.contains(e.target as Node)) {
        close();
      }
    };

    // Use mousedown so the click registers before any blur
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, close, disableClickOutside]);

  // Restore focus to trigger on close
  useEffect(() => {
    if (!isOpen) {
      // When transitioning from open → closed, restore focus
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  return { isOpen, open, close, toggle, modalRef, triggerRef };
}
