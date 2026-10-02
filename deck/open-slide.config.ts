import type { OpenSlideConfig } from '@open-slide/core';

const openSlideConfig: OpenSlideConfig = {
  // GitHub Pages serves the site from /<repo>/; the deploy workflow sets this.
  base: process.env.OPEN_SLIDE_BASE ?? '/',
  // The public build shows only the deck itself, not the slide browser
  // (dev keeps the browser regardless).
  build: { showSlideBrowser: false },
};

export default openSlideConfig;
