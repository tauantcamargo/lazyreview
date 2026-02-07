import { useState, useCallback, useMemo } from 'react';

export interface UseFocusOptions {
  panels: string[];
  initialPanel?: string;
  wrapAround?: boolean;
}

export interface UseFocusResult {
  activePanel: string;
  setActivePanel: (panel: string) => void;
  focusNext: () => void;
  focusPrevious: () => void;
  focusFirst: () => void;
  focusLast: () => void;
  isActive: (panel: string) => boolean;
}

export function useFocus({
  panels,
  initialPanel,
  wrapAround = true,
}: UseFocusOptions): UseFocusResult {
  const [activePanel, setActivePanel] = useState(
    initialPanel ?? panels[0] ?? ''
  );

  const currentIndex = useMemo(
    () => panels.indexOf(activePanel),
    [panels, activePanel]
  );

  const focusNext = useCallback(() => {
    if (panels.length === 0) return;

    let nextIndex = currentIndex + 1;
    if (nextIndex >= panels.length) {
      nextIndex = wrapAround ? 0 : panels.length - 1;
    }
    setActivePanel(panels[nextIndex] ?? panels[0] ?? '');
  }, [panels, currentIndex, wrapAround]);

  const focusPrevious = useCallback(() => {
    if (panels.length === 0) return;

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = wrapAround ? panels.length - 1 : 0;
    }
    setActivePanel(panels[prevIndex] ?? panels[0] ?? '');
  }, [panels, currentIndex, wrapAround]);

  const focusFirst = useCallback(() => {
    if (panels.length > 0) {
      setActivePanel(panels[0] ?? '');
    }
  }, [panels]);

  const focusLast = useCallback(() => {
    if (panels.length > 0) {
      setActivePanel(panels[panels.length - 1] ?? '');
    }
  }, [panels]);

  const isActive = useCallback(
    (panel: string): boolean => panel === activePanel,
    [activePanel]
  );

  return {
    activePanel,
    setActivePanel,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    isActive,
  };
}
