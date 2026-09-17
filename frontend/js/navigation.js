/**
 * @fileoverview View navigation controller for the Quemeds application.
 *
 * Manages switching between views (Overview, Predict, Batch, Models, Methodology)
 * and updates sidebar active states.
 */

let currentView = 'overview';

/**
 * Switch the active view.
 * @param {string} viewName - The view id suffix (e.g. 'overview', 'predict')
 */
export function switchView(viewName) {
  currentView = viewName;
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.remove('active'));

  const targetView = document.getElementById(`view-${viewName}`);
  const targetNav = document.getElementById(`nav-${viewName}`);
  if (targetView) targetView.classList.add('active');
  if (targetNav) targetNav.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Get current active view.
 * @returns {string}
 */
export function getCurrentView() {
  return currentView;
}

/**
 * Initialize navigation event listeners.
 */
export function initNavigation() {
  // Bind all nav-item buttons
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });

  // Expose on window for any inline onclick attributes
  window.switchView = switchView;
}
