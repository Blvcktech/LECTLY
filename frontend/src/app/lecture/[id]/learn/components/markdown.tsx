"use client";

import { Code } from "lucide-react";

// ── Helper: render inline formatting (bold, inline code) ──
export function RenderInline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded-md bg-amber-100/60 border border-amber-200/40 text-[13px] font-mono text-amber-900"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Helper: render a paragraph that might be a math step ──
export function RenderParagraph({ text, index }: { text: string; index: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const isStep = /^(Step \d|Given:|Find:|Formula:|Answer:|Therefore:|Solution:|Result:|Where:)/i.test(trimmed);
  const isCalculation = /^[A-Za-z_]\s*=\s*.+/.test(trimmed) || /^[A-Za-z(].*[=×÷].*\d/.test(trimmed);
  const isBullet = /^[-•]\s/.test(trimmed);
  const isNumberedItem = /^\d+[\.\)]\s/.test(trimmed);

  if (isStep) {
    return (
      <div key={index} className="flex items-start gap-3 my-2">
        <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
        <p className="text-sm font-semibold text-ink leading-relaxed">
          <RenderInline text={trimmed} />
        </p>
      </div>
    );
  }

  if (isCalculation) {
    return (
      <div key={index} className="my-2 mx-4 bg-[#1a1a2e] border border-amber-200/20 rounded-lg px-4 py-2">
        <code className="text-[13px] text-green-400 font-mono">
          {trimmed}
        </code>
      </div>
    );
  }

  if (isBullet) {
    const bulletText = trimmed.replace(/^[-•]\s*/, "");
    return (
      <div key={index} className="flex items-start gap-2 my-1 ml-2">
        <span className="text-amber-700 mt-0.5 flex-shrink-0">•</span>
        <p className="text-sm text-ink-l leading-relaxed">
          <RenderInline text={bulletText} />
        </p>
      </div>
    );
  }

  if (isNumberedItem) {
    const match = trimmed.match(/^(\d+[\.\)])\s*(.*)/);
    return (
      <div key={index} className="flex items-start gap-2 my-1 ml-2">
        <span className="text-amber-700 font-mono text-xs mt-0.5 flex-shrink-0 min-w-[1.2rem]">
          {match?.[1]}
        </span>
        <p className="text-sm text-ink-l leading-relaxed">
          <RenderInline text={match?.[2] || trimmed} />
        </p>
      </div>
    );
  }

  return (
    <p key={index} className="text-sm text-ink-l leading-[1.85] mb-4 last:mb-0">
      <RenderInline text={trimmed} />
    </p>
  );
}

// ── Helper: render body text with code blocks, math, and formatting ──
export function RenderBody({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.slice(3, -3).split("\n");
          const lang = lines[0]?.trim() || "";
          const code = lang ? lines.slice(1).join("\n") : lines.join("\n");

          return (
            <div key={i} className="my-5 rounded-xl overflow-hidden border border-amber-200/30 shadow-sm">
              <div className="bg-[rgba(26,24,21,0.06)] px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-3.5 h-3.5 text-ink-m" />
                  <span className="text-[10px] font-bold text-ink-m uppercase tracking-wider">
                    {lang || "code"}
                  </span>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(code.trim())}
                  className="text-[10px] font-medium text-ink-m hover:text-ink px-2 py-0.5 rounded hover:bg-amber-100/50 transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="bg-[#1a1a2e] px-5 py-4 overflow-x-auto">
                <code className="text-[13px] text-green-400 leading-[1.7] font-mono whitespace-pre">
                  {code.trim()}
                </code>
              </pre>
            </div>
          );
        }

        return part.split(/\n\n+/).map((paragraph, j) => {
          const trimmed = paragraph.trim();
          if (!trimmed) return null;

          // Auto-detect code that wasn't wrapped in backticks
          const codeLinePattern = /^[\s]*(public |private |class |import |int |String |void |System\.|for\s*\(|if\s*\(|while\s*\(|return |var |let |const |function |def |print\(|console\.|#include|using namespace|\}|else\s*\{|try\s*\{|catch\s*\()/;
          const allLines = trimmed.split("\n");
          const hasMultipleCodeLines = allLines.length >= 3;
          const codeLineCount = allLines.filter((l: string) => codeLinePattern.test(l)).length;
          const codeLineRatio = allLines.length > 0 ? codeLineCount / allLines.length : 0;
          const looksLikeCode = hasMultipleCodeLines && codeLineRatio >= 0.5 && (trimmed.includes(";") || trimmed.includes("{")) && !/^[A-Z].*\.\s/.test(trimmed);

          if (looksLikeCode) {
            let detectedLang = "code";
            if (/System\.out|public class|private |void /.test(trimmed)) detectedLang = "java";
            else if (/console\.|const |let |=>/.test(trimmed)) detectedLang = "javascript";
            else if (/def |print\(|import /.test(trimmed) && !trimmed.includes(";")) detectedLang = "python";
            else if (/#include|using namespace|cout/.test(trimmed)) detectedLang = "cpp";

            return (
              <div key={`${i}-${j}`} className="my-5 rounded-xl overflow-hidden border border-amber-200/30 shadow-sm">
                <div className="bg-[rgba(26,24,21,0.06)] px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 text-ink-m" />
                    <span className="text-[10px] font-bold text-ink-m uppercase tracking-wider">{detectedLang}</span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(trimmed)}
                    className="text-[10px] font-medium text-ink-m hover:text-ink px-2 py-0.5 rounded hover:bg-amber-100/50 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <pre className="bg-[#1a1a2e] px-5 py-4 overflow-x-auto">
                  <code className="text-[13px] text-green-400 leading-[1.7] font-mono whitespace-pre">
                    {trimmed}
                  </code>
                </pre>
              </div>
            );
          }

          const lines = trimmed.split("\n");
          if (lines.length > 1) {
            return (
              <div key={`${i}-${j}`} className="mb-4">
                {lines.map((line, li) => (
                  <RenderParagraph key={`${i}-${j}-${li}`} text={line} index={`${i}-${j}-${li}`} />
                ))}
              </div>
            );
          }

          return <RenderParagraph key={`${i}-${j}`} text={trimmed} index={`${i}-${j}`} />;
        });
      })}
    </>
  );
}

// ── Helper: render tutor message content ──
export function TutorMessageContent({ content }: { content: string }) {
  // Render inline markdown: **bold**, `code`
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={idx} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={idx} className="px-1 py-0.5 rounded bg-amber-100/60 text-[11px] font-mono text-amber-900">{part.slice(1, -1)}</code>;
      return <span key={idx}>{part}</span>;
    });
  };

  // Render a single line with appropriate styling
  const renderLine = (line: string, key: string) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Step headers — bold, with top margin for visual separation
    if (/^(Step \d|Given:|Formula:|Answer:|Solution:)/i.test(trimmed)) {
      return <p key={key} className="text-sm leading-relaxed font-semibold text-ink mt-2 first:mt-0">{renderInline(trimmed)}</p>;
    }
    // Bullet points (-, •, *)
    if (/^[-•*]\s+/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-•*]\s+/, "");
      return <p key={key} className="text-sm leading-relaxed mb-0.5 flex gap-2 pl-1"><span className="text-amber-600 flex-shrink-0">•</span><span>{renderInline(bulletText)}</span></p>;
    }
    // Numbered list items (1., 2., etc.)
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+[.)])\s+(.*)/);
      if (match) {
        return <p key={key} className="text-sm leading-relaxed mb-0.5 flex gap-2 pl-1"><span className="text-accent font-semibold flex-shrink-0 min-w-[1.2rem]">{match[1]}</span><span>{renderInline(match[2])}</span></p>;
      }
    }
    // Equations / formulas (X = something)
    if (/^[A-Za-z_]\s*=\s*.+/.test(trimmed) && trimmed.length < 120) {
      return <div key={key} className="bg-[rgba(26,24,21,0.06)] rounded px-3 py-1.5 my-1"><code className="text-[12px] text-green-700 font-mono">{trimmed}</code></div>;
    }
    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      return <hr key={key} className="border-[rgba(217,185,130,0.3)] my-2" />;
    }
    // Regular paragraph
    return <p key={key} className="text-sm leading-relaxed text-ink-l">{renderInline(trimmed)}</p>;
  };

  return (
    <div className="space-y-1.5">
      {content.split(/(```[\s\S]*?```)/g).map((block, bi) => {
        // Code blocks
        if (block.startsWith("```")) {
          const lines = block.slice(3, -3).split("\n");
          const lang = lines[0]?.trim() || "";
          const code = lang ? lines.slice(1).join("\n") : lines.join("\n");
          return (
            <div key={bi} className="my-2 rounded-lg overflow-hidden border border-amber-200/30">
              {lang && (
                <div className="bg-[rgba(26,24,21,0.06)] px-3 py-1 flex items-center gap-1.5">
                  <Code className="w-3 h-3 text-ink-m" />
                  <span className="text-[9px] font-bold text-ink-m uppercase">{lang}</span>
                </div>
              )}
              <pre className="bg-[#1a1a2e] px-3 py-2.5 overflow-x-auto">
                <code className="text-[12px] text-green-400 leading-[1.6] font-mono whitespace-pre">{code.trim()}</code>
              </pre>
            </div>
          );
        }

        // Text content — split on EVERY newline, not just double newlines
        // This ensures Step 1, Step 2, bullets, etc. each render on their own line
        const lines = block.split("\n");
        const elements: React.ReactNode[] = [];
        let consecutiveEmpty = 0;

        for (let li = 0; li < lines.length; li++) {
          const line = lines[li];
          if (!line.trim()) {
            consecutiveEmpty++;
            // Add spacing for double newlines (paragraph breaks)
            if (consecutiveEmpty >= 2) {
              elements.push(<div key={`${bi}-gap-${li}`} className="h-2" />);
              consecutiveEmpty = 0;
            }
            continue;
          }
          consecutiveEmpty = 0;
          const rendered = renderLine(line, `${bi}-${li}`);
          if (rendered) elements.push(rendered);
        }

        return <div key={bi}>{elements}</div>;
      })}
    </div>
  );
}
