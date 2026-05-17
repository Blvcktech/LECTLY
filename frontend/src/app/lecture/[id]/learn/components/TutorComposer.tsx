"use client";

import React from "react";
import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Sparkles,
  Send,
} from "lucide-react";
import { TutorMessageContent } from "./markdown";
import type { TutorMessage } from "@/lib/api";

interface TutorComposerProps {
  expanded: boolean;
  onToggleExpanded: (expanded: boolean) => void;
  messages: TutorMessage[];
  input: string;
  onInputChange: (value: string) => void;
  loading: boolean;
  onSend: (message?: string) => void;
  onClear: () => void;
  placeholder: string;
  chips: { label: string }[];
  cardIndex: number;
  totalCards: number;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
}

export function TutorComposer({
  expanded,
  onToggleExpanded,
  messages,
  input,
  onInputChange,
  loading,
  onSend,
  onClear,
  placeholder,
  chips,
  cardIndex,
  totalCards,
  chatEndRef,
  chatInputRef,
}: TutorComposerProps) {
  return (
    <div className="sticky bottom-0 z-40 bg-[#FDFCF9] border-t border-[rgba(217,185,130,0.3)]">
      {/* Expanded conversation area */}
      {expanded && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6" style={{ maxHeight: "45vh", overflowY: "auto" }}>
          {/* Collapse handle */}
          <div className="sticky top-0 z-10 bg-[#FDFCF9] pt-2 pb-1 flex items-center justify-between border-b border-[rgba(217,185,130,0.15)]">
            <span className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest">Tutor</span>
            <button
              onClick={() => onToggleExpanded(false)}
              className="flex items-center gap-1 text-[11px] font-medium text-[#8a7f6f] hover:text-[#1a1815] px-2 py-1 rounded-lg hover:bg-[#EDE8DF] transition-colors"
              aria-label="Minimize tutor chat"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Minimize
            </button>
          </div>
          <div className="py-3 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="text-center py-4">
                <p className="text-sm text-[#8a7f6f]">Your tutor is ready to help. Ask anything about this lesson.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#1a1815] text-white rounded-br-md"
                    : "bg-[#EDE8DF] border border-[rgba(217,185,130,0.3)] text-[#2C2A25] rounded-bl-md"
                }`}>
                  {msg.role === "tutor" ? (
                    <TutorMessageContent content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#EDE8DF] border border-[rgba(217,185,130,0.3)] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-[#8a7f6f] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-[#8a7f6f] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-[#8a7f6f] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}

      {/* Resume conversation bar (shows when minimized with existing messages) */}
      {!expanded && messages.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <button
            onClick={() => onToggleExpanded(true)}
            className="w-full flex items-center gap-2 py-2 px-3 text-left hover:bg-[#EDE8DF]/50 rounded-lg transition-colors group"
          >
            <MessageCircle className="w-3.5 h-3.5 text-[#8a7f6f] flex-shrink-0" />
            <span className="text-[11px] text-[#8a7f6f] truncate flex-1">
              {messages[messages.length - 1]?.role === "tutor" ? "Tutor replied" : "You asked"}: {messages[messages.length - 1]?.content.substring(0, 60)}{messages[messages.length - 1]?.content.length > 60 ? "..." : ""}
            </span>
            <ChevronUp className="w-3.5 h-3.5 text-[#8a7f6f] group-hover:text-[#1a1815] flex-shrink-0" />
            <span className="text-[10px] font-medium text-[#8a7f6f] group-hover:text-[#1a1815] flex-shrink-0">Show</span>
          </button>
        </div>
      )}

      {/* Suggested chips */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-2 pt-2 pb-1.5 overflow-x-auto">
          <span className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-wider flex-shrink-0">Suggest:</span>
          {chips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => onSend(chip.label)}
              className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#EDE8DF] border border-[rgba(217,185,130,0.3)] text-[#2C2A25] hover:bg-[rgba(217,185,130,0.3)] hover:border-[rgba(217,185,130,0.5)] transition-all whitespace-nowrap flex-shrink-0"
            >
              {chip.label}
            </button>
          ))}
          {messages.length > 0 && (
            <button
              onClick={onClear}
              className="text-[10px] font-medium text-[#8a7f6f] hover:text-red-500 px-2 py-1 rounded-lg transition-colors ml-auto flex-shrink-0"
            >
              Clear
            </button>
          )}
          <span className={`text-[10px] text-[#8a7f6f] ${messages.length === 0 ? "ml-auto" : ""} flex-shrink-0`}>
            Card {cardIndex + 1}/{totalCards}
          </span>
        </div>
      </div>

      {/* Composer input */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-4 pt-1">
        <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[#EDE8DF] border border-[rgba(217,185,130,0.3)] rounded-xl px-4 py-2.5 focus-within:border-[#1a1815]/30 focus-within:ring-1 focus-within:ring-[#1a1815]/10 transition-all">
            <Sparkles className="w-4 h-4 text-[#8a7f6f] flex-shrink-0" />
            <input
              ref={chatInputRef}
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onFocus={() => { if (messages.length > 0) onToggleExpanded(true); }}
              placeholder={placeholder}
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-[#1a1815] placeholder:text-[#8a7f6f] focus:outline-none disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-[#1a1815] hover:bg-[#2C2A25] disabled:bg-[#EDE8DF] disabled:text-[#8a7f6f] text-white flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
