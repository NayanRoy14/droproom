import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes } from './utils.ts';

describe('formatBytes', () => {
  it('formats 0 bytes correctly', () => {
    assert.equal(formatBytes(0), '0 Bytes');
  });

  it('formats KB correctly', () => {
    assert.equal(formatBytes(1024), '1 KB');
    assert.equal(formatBytes(1536), '1.5 KB');
  });

  it('formats MB correctly', () => {
    assert.equal(formatBytes(1048576), '1 MB');
  });
});

