/**
 * @fileoverview Theme controller for the Quemeds design system.
 *
 * Manages dark/light mode via the `data-theme` attribute on <html>
 * and the `dark-mode` class on <body> (for CSS backward-compat).
 * Persists preference in localStorage.
 */

/** SVG markup for the sun icon (shown in dark mode → switch to light). */
const SUN_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

/** SVG markup for the moon icon (shown in light mode → switch to dark). */
const MOON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

const STORAGE_KEY = 'quemeds_theme';

/**
 * Apply the given theme to the document.
 * @param {'light' | 'dark'} theme
 */
function applyTheme(theme) {
  const btn = document.getElementById('theme-toggle');
  const isDark = theme === 'dark';

  document.documentElement.setAttribute('data-theme', theme);

  if (isDark) {
    document.body.classList.add('dark-mode');
    if (btn) {
      btn.innerHTML = SUN_ICON;
      btn.setAttribute('title', 'Switch to Light Mode');
    }
  } else {
    document.body.classList.remove('dark-mode');
    if (btn) {
      btn.innerHTML = MOON_ICON;
      btn.setAttribute('title', 'Switch to Dark Mode');
    }
  }

  localStorage.setItem(STORAGE_KEY, theme);
}

/**
 * Initialise the theme system.
 * Reads persisted preference, applies it, and binds the toggle button.
 */
export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY) || 'dark';
  applyTheme(saved);

  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const isCurrentlyDark =
        document.body.classList.contains('dark-mode') ||
        document.documentElement.getAttribute('data-theme') === 'dark';
      applyTheme(isCurrentlyDark ? 'light' : 'dark');
    });
  }
}
