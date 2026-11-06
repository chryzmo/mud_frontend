import { useEffect, useState } from 'react';

// Keeps --app-height and --app-top equal to the part of the screen the player can
// actually see. On iOS the on-screen keyboard shrinks the visual viewport but not
// the layout viewport, so a page sized in vh or dvh stays behind the keyboard and
// the input is hidden. Sized from visualViewport, the app ends above the keyboard.
export function trackViewport(win: Window = window): () => void {
  const vv = win.visualViewport;
  if (!vv) return () => {};
  const root = win.document.documentElement;
  const update = () => {
    root.style.setProperty('--app-height', `${vv.height}px`);
    root.style.setProperty('--app-top', `${vv.offsetTop}px`);
  };
  update();
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  return () => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
    root.style.removeProperty('--app-height');
    root.style.removeProperty('--app-top');
  };
}

export function useViewport() {
  useEffect(() => trackViewport(), []);
}

const visibleHeight = (win: Window) => win.visualViewport?.height ?? win.innerHeight;

// The height of the part of the screen the player can see (it shrinks with the keyboard).
export function useVisibleHeight(): number {
  const [height, setHeight] = useState(() => visibleHeight(window));
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setHeight(vv.height);
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);
  return height;
}
