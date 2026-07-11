'use client';
import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'wealthos_theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Read from storage; default to light
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme) || 'light';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
