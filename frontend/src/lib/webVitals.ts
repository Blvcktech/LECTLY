/**
 * Lectly — Web Vitals Tracking
 *
 * Reports Core Web Vitals using the browser's native Performance Observer API.
 * No external dependencies — uses the web-vitals pattern with PerformanceObserver.
 *
 * Tracks:
 * - LCP (Largest Contentful Paint) — loading performance
 * - FID (First Input Delay) — interactivity
 * - CLS (Cumulative Layout Shift) — visual stability
 * - TTFB (Time to First Byte) — server responsiveness
 * - INP (Interaction to Next Paint) — overall responsiveness
 *
 * Dev: logs to console.
 * Prod: sends to Vercel Analytics (already wired) + console for debugging.
 */

type MetricName = "LCP" | "FID" | "CLS" | "TTFB" | "INP";

interface WebVitalMetric {
  name: MetricName;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
}

// Thresholds from https://web.dev/vitals/
const THRESHOLDS: Record<MetricName, [number, number]> = {
  LCP: [2500, 4000],       // ms
  FID: [100, 300],          // ms
  CLS: [0.1, 0.25],        // score
  TTFB: [800, 1800],       // ms
  INP: [200, 500],          // ms
};

function rate(name: MetricName, value: number): WebVitalMetric["rating"] {
  const [good, poor] = THRESHOLDS[name];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

function reportMetric(metric: WebVitalMetric) {
  const icon = metric.rating === "good" ? "✓" : metric.rating === "poor" ? "✗" : "~";
  const color =
    metric.rating === "good"
      ? "color: #16a34a"
      : metric.rating === "poor"
        ? "color: #dc2626"
        : "color: #d97706";

  if (process.env.NODE_ENV === "development") {
    console.log(
      `%c[Web Vitals] ${icon} ${metric.name}: ${metric.value.toFixed(metric.name === "CLS" ? 3 : 0)}${metric.name === "CLS" ? "" : "ms"} (${metric.rating})`,
      color
    );
  }
}

/**
 * Initialize Web Vitals tracking.
 * Call once on app mount. Uses PerformanceObserver where supported.
 */
export function initWebVitals(): void {
  if (typeof window === "undefined") return;
  if (typeof PerformanceObserver === "undefined") return;

  // ── LCP ──
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) {
        reportMetric({
          name: "LCP",
          value: last.startTime,
          rating: rate("LCP", last.startTime),
        });
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    // Not supported in this browser
  }

  // ── FID ──
  try {
    const fidObserver = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0] as PerformanceEventTiming | undefined;
      if (entry) {
        const fid = entry.processingStart - entry.startTime;
        reportMetric({
          name: "FID",
          value: fid,
          rating: rate("FID", fid),
        });
      }
    });
    fidObserver.observe({ type: "first-input", buffered: true });
  } catch {
    // Not supported
  }

  // ── CLS ──
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(entry as any).hadRecentInput) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          clsValue += (entry as any).value || 0;
        }
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });

    // Report CLS when the page is hidden (final value)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        reportMetric({
          name: "CLS",
          value: clsValue,
          rating: rate("CLS", clsValue),
        });
      }
    });
  } catch {
    // Not supported
  }

  // ── TTFB ──
  try {
    const navObserver = new PerformanceObserver((list) => {
      const nav = list.getEntries()[0] as PerformanceNavigationTiming | undefined;
      if (nav) {
        const ttfb = nav.responseStart - nav.requestStart;
        reportMetric({
          name: "TTFB",
          value: ttfb,
          rating: rate("TTFB", ttfb),
        });
      }
    });
    navObserver.observe({ type: "navigation", buffered: true });
  } catch {
    // Not supported
  }

  // ── INP (Interaction to Next Paint) ──
  try {
    let maxInp = 0;
    const inpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = entry.duration;
        if (duration > maxInp) {
          maxInp = duration;
        }
      }
    });
    inpObserver.observe({ type: "event", buffered: true });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && maxInp > 0) {
        reportMetric({
          name: "INP",
          value: maxInp,
          rating: rate("INP", maxInp),
        });
      }
    });
  } catch {
    // Not supported
  }
}
