import { describe, expect, it } from 'vitest';
import { trackViewport } from './useViewport';

class FakeViewport extends EventTarget {
  height = 800;
  offsetTop = 0;
}

describe('trackViewport', () => {
  it('sizes the app to the visible area as the keyboard comes and goes', () => {
    const vv = new FakeViewport();
    const win = { visualViewport: vv, document } as unknown as Window;
    const root = document.documentElement.style;

    const stop = trackViewport(win);
    expect(root.getPropertyValue('--app-height')).toBe('800px');

    vv.height = 450; // keyboard up
    vv.offsetTop = 30; // and the page nudged
    vv.dispatchEvent(new Event('resize'));
    expect(root.getPropertyValue('--app-height')).toBe('450px');
    expect(root.getPropertyValue('--app-top')).toBe('30px');

    stop();
    expect(root.getPropertyValue('--app-height')).toBe('');
    vv.height = 300;
    vv.dispatchEvent(new Event('resize'));
    expect(root.getPropertyValue('--app-height')).toBe(''); // no longer listening
  });

  it('does nothing where visualViewport is missing', () => {
    expect(() => trackViewport({ visualViewport: null } as unknown as Window)()).not.toThrow();
  });
});
