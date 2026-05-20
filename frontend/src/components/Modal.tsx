"use client";

import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useModal, UseModalOptions } from "@/hooks/useModal";

/**
 * Modal — Accessible overlay dialog.
 *
 * Uses useModal hook internally for focus trap, ESC, click-outside.
 * Renders a backdrop + centered panel via React portal-less approach
 * (fixed positioning).
 *
 * Usage:
 *   <Modal isOpen={show} onClose={() => setShow(false)} title="Confirm">
 *     <p>Are you sure?</p>
 *   </Modal>
 */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Max width class (default: "max-w-md") */
  size?: string;
  /** Hide the X close button */
  hideCloseButton?: boolean;
  /** Options passed to useModal */
  modalOptions?: Omit<UseModalOptions, "onClose" | "initialOpen">;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "max-w-md",
  hideCloseButton = false,
  modalOptions = {},
}: ModalProps) {
  const { modalRef } = useModal({
    ...modalOptions,
    onClose,
    initialOpen: isOpen,
  });

  // Sync external isOpen with internal ESC/click-outside behavior
  const prevOpenRef = useRef(isOpen);
  useEffect(() => {
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  // Handle ESC key directly since we control open state externally
  useEffect(() => {
    if (!isOpen || modalOptions.disableEsc) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose, modalOptions.disableEsc]);

  // Click outside
  useEffect(() => {
    if (!isOpen || modalOptions.disableClickOutside) return;

    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose, modalRef, modalOptions.disableClickOutside]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative ${size} w-full bg-paper border border-cream-d rounded-2xl shadow-2xl shadow-black/20 animate-[modalIn_0.2s_ease-out]`}
      >
        {/* Header */}
        {(title || !hideCloseButton) && (
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            {title && (
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
            )}
            {!hideCloseButton && (
              <button
                onClick={onClose}
                className="ml-auto text-ink-m hover:text-ink transition-colors p-1 -mr-1"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
