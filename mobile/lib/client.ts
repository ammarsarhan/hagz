import { hc } from 'hono/client';
import type { AppType } from '../../api/dist/src/index.js';

const API_URL = 'http://localhost:8080';

export const client = hc<AppType>(API_URL);