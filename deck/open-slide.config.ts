import type { OpenSlideConfig } from '@open-slide/core';

const openSlideConfig: OpenSlideConfig = {
  // GitHub Pages serves the site from /<repo>/; the deploy workflow sets this.
  base: process.env.OPEN_SLIDE_BASE ?? '/',
};

export default openSlideConfig;
