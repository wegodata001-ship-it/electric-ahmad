"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyAccessibilitySettings,
  clampFontScale,
  DEFAULT_A11Y_SETTINGS,
  FONT_SCALE_STEP,
  loadAccessibilitySettings,
  saveAccessibilitySettings,
  type AccessibilitySettings,
} from "@/lib/accessibility/settings";

type AccessibilityContextValue = {
  settings: AccessibilitySettings;
  increaseFont: () => void;
  decreaseFont: () => void;
  resetFont: () => void;
  toggleHighContrast: () => void;
  toggleGrayscale: () => void;
  toggleHighlightLinks: () => void;
  toggleReadableFont: () => void;
  toggleWideSpacing: () => void;
  toggleReduceMotion: () => void;
  resetAll: () => void;
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(
  null
);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(
    DEFAULT_A11Y_SETTINGS
  );

  useEffect(() => {
    const loaded = loadAccessibilitySettings();
    setSettings(loaded);
    applyAccessibilitySettings(loaded);
  }, []);

  const commit = useCallback((next: AccessibilitySettings) => {
    setSettings(next);
    applyAccessibilitySettings(next);
    saveAccessibilitySettings(next);
  }, []);

  const value = useMemo<AccessibilityContextValue>(
    () => ({
      settings,
      increaseFont: () =>
        commit({
          ...settings,
          fontScale: clampFontScale(settings.fontScale + FONT_SCALE_STEP),
        }),
      decreaseFont: () =>
        commit({
          ...settings,
          fontScale: clampFontScale(settings.fontScale - FONT_SCALE_STEP),
        }),
      resetFont: () => commit({ ...settings, fontScale: 1 }),
      toggleHighContrast: () =>
        commit({ ...settings, highContrast: !settings.highContrast }),
      toggleGrayscale: () =>
        commit({ ...settings, grayscale: !settings.grayscale }),
      toggleHighlightLinks: () =>
        commit({ ...settings, highlightLinks: !settings.highlightLinks }),
      toggleReadableFont: () =>
        commit({ ...settings, readableFont: !settings.readableFont }),
      toggleWideSpacing: () =>
        commit({ ...settings, wideSpacing: !settings.wideSpacing }),
      toggleReduceMotion: () =>
        commit({ ...settings, reduceMotion: !settings.reduceMotion }),
      resetAll: () => commit({ ...DEFAULT_A11Y_SETTINGS }),
    }),
    [commit, settings]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return ctx;
}
