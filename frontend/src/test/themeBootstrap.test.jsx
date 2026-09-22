import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// The anti-flash bootstrap executes before React mounts, so it cannot be
// observed by a render test. This asserts the contract that makes it work:
// it is inline+blocking, it runs before the app bundle, and it agrees with
// useTheme() on the storage key and the class it toggles.
const html = readFileSync(
  path.resolve(process.cwd(), 'index.html'),
  'utf8'
);

describe('theme bootstrapping (flash-of-wrong-theme)', () => {
  const match = html.match(
    /<script(?![^>]*\b(?:src|type="module"|defer|async))[^>]*>([\s\S]*?)<\/script>/
  );

  it('runs a blocking inline script before the app bundle', () => {
    expect(match, 'no inline blocking script in <head>').toBeTruthy();
    const bootstrap = match.index;
    const bundle = html.indexOf('type="module"');
    expect(bundle).toBeGreaterThan(-1);
    expect(bootstrap).toBeLessThan(bundle);
  });

  it('applies the stored theme to <html> using the app storage key', () => {
    const code = match?.[1] ?? '';
    expect(code).toContain('academiai-theme');
    expect(code).toMatch(/classList\.(add|toggle)\(\s*['"]dark['"]/);
    expect(code).toMatch(/document\.documentElement|getElementsByTagName\(['"]html['"]\)/);
  });

  it('never throws when storage is unavailable', () => {
    expect(match?.[1] ?? '').toMatch(/try\s*\{[\s\S]*catch/);
  });
});
