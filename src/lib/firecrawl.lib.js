import { Firecrawl } from 'firecrawl';
import { config } from '../config/env.js';

export const firecrawlApp = new Firecrawl({ apiKey: config.firecrawl.apiKey });