/**
 * @fileoverview Application entry point for Quemeds.
 *
 * Bootstraps theme settings, navigation, overview dashboard,
 * single-patient prediction, and batch analysis controllers.
 */

import { initTheme } from './theme.js';
import { initNavigation } from './navigation.js';
import { initOverview } from './overview.js';
import { initPredict } from './predict.js';
import { initBatch } from './batch.js';
import { initAuth } from './auth.js';

function bootstrap() {
  initTheme();
  initNavigation();
  initOverview();
  initPredict();
  initBatch();
  initAuth();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
