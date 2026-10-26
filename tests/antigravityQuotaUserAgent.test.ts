import { describe, expect, test } from 'bun:test';
import {
  ANTIGRAVITY_REQUEST_HEADERS,
  buildAntigravityUserAgent,
} from '../src/utils/quota/constants';

describe('Antigravity quota client identity', () => {
  test('uses the upstream Hub identity required for Gemini quota groups', () => {
    expect(ANTIGRAVITY_REQUEST_HEADERS['User-Agent']).toBe('antigravity/hub/2.23.0 darwin/arm64');
    expect(ANTIGRAVITY_REQUEST_HEADERS.Authorization).toBe('Bearer $TOKEN$');
  });

  test('keeps explicit version and platform overrides', () => {
    expect(buildAntigravityUserAgent({ version: '2.24.0', platform: 'linux/amd64' })).toBe(
      'antigravity/hub/2.24.0 linux/amd64'
    );
  });
});
