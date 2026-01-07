/**
 * Ad Optimization Worker Runner
 * 
 * Starts the video ad optimization worker that polls Meta API
 * and automatically optimizes campaigns based on performance metrics.
 * 
 * Run with: pnpm --filter api worker:ads
 */

import 'dotenv/config';
import './workers/videoAdOptimizerWorker.js';

console.log('Ad optimization worker started. Press Ctrl+C to stop.');


