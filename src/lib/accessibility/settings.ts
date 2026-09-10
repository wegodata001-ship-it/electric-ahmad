export const A11Y_STORAGE_KEY = "elec.a11y.settings.v1";

export type AccessibilitySettings = {
  /** Root font scale factor (1 = default). */
  fontScale: number;
  highContrast: boolean;
  grayscale: boolean;
  highlightLinks: boolean;
  readableFont: boolean;
  wideSpacing: boolean;
  reduceMotion: boolean;
};

export const DEFAULT_A11Y_SETTINGS: AccessibilitySettings = {
  fontScale: 1,
  highContrast: false,
  grayscale: false,
  highlightLinks: false,
  readableFont: false,
  wideSpacing: false,
  reduceMotion: false,
};

export const FONT_SCALE_MIN = 0.875;
export const FONT_SCALE_MAX = 1.375;
export const FONT_SCALE_STEP = 0.125;

export function clampFontScale(value: number): number {
  const stepped = Math.round(value / FONT_SCALE_STEP) * FONT_SCALE_STEP;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Number(stepped.toFixed(3))));
}

export function loadAccessibilitySettings(): AccessibilitySettings {
  if (typeof window === "undefined") return { ...DEFAULT_A11Y_SETTINGS };
  try {
    const raw = window.localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) {
      const prefersReduce =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      return {
        ...DEFAULT_A11Y_SETTINGS,
        reduceMotion: prefersReduce,
      };
    }
    const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
    return {
      fontScale: clampFontScale(
        typeof parsed.fontScale === "number" ? parsed.fontScale : 1
      ),
      highContrast: Boolean(parsed.highContrast),
      grayscale: Boolean(parsed.grayscale),
      highlightLinks: Boolean(parsed.highlightLinks),
      readableFont: Boolean(parsed.readableFont),
      wideSpacing: Boolean(parsed.wideSpacing),
      reduceMotion: Boolean(parsed.reduceMotion),
    };
  } catch {
    return { ...DEFAULT_A11Y_SETTINGS };
  }
}

export function saveAccessibilitySettings(settings: AccessibilitySettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings));
}

/** Apply settings as data attributes / CSS variables on <html>. */
export function applyAccessibilitySettings(settings: AccessibilitySettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--a11y-font-scale", String(settings.fontScale));
  root.dataset.a11yContrast = settings.highContrast ? "high" : "off";
  root.dataset.a11yGrayscale = settings.grayscale ? "on" : "off";
  root.dataset.a11yLinks = settings.highlightLinks ? "on" : "off";
  root.dataset.a11yFont = settings.readableFont ? "readable" : "default";
  root.dataset.a11ySpacing = settings.wideSpacing ? "wide" : "default";
  root.dataset.a11yMotion = settings.reduceMotion ? "reduce" : "default";
}
