// Motion adapted from the DesignBookmark Copy Button:
// https://designbookmark.com/motion-src/copy-button/index.html
import { track } from '../scripts/analytics';

export function bindCopyButton(button: HTMLButtonElement) {
  const roll = button.querySelector<HTMLElement>('[data-copy-window]')!;
  const words = button.querySelector<HTMLElement>('[data-copy-words]')!;
  const labels = [...words.children] as HTMLElement[];
  const copyIcon = button.querySelector<SVGElement>('[data-copy-icon]')!;
  const checkIcon = button.querySelector<SVGElement>('[data-copy-check]')!;
  const status = button.nextElementSibling as HTMLElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const rowHeight = 18;

  const spring = (stiffness: number, damping: number) => ({
    value: 0, target: 0, velocity: 0, stiffness, damping,
  });
  const word = spring(260, 20);
  const icon = spring(420, 18);
  const width = spring(300, 24);
  const springs = [word, icon, width];
  const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

  let frame: number | undefined;
  let timer: number | undefined;
  let request = 0;
  let copying = false;

  function render() {
    const amount = clamp(icon.value, -.2, 1.2);
    const turn = clamp(amount);
    roll.style.inlineSize = `${width.value}px`;
    words.style.transform = `translateY(${-rowHeight * word.value}px)`;
    copyIcon.style.opacity = String(clamp(1 - amount * 1.6));
    copyIcon.style.transform = `scale(${1 - .5 * turn}) rotate(${-40 * turn}deg)`;
    checkIcon.style.opacity = String(clamp(amount * 1.6 - .4));
    checkIcon.style.transform = `scale(${.4 + .6 * amount})`;
  }

  function settle() {
    for (const item of springs) {
      item.value = item.target;
      item.velocity = 0;
    }
    render();
  }

  function show(state: 'default' | 'success' | 'error', immediate = false) {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    const row = state === 'default' ? 0 : 1;
    if (row === 1) labels[1].textContent = state === 'success' ? '已复制' : '复制失败';
    button.dataset.copyState = state;
    if (!width.value) width.value = labels[0].getBoundingClientRect().width;
    word.target = row;
    icon.target = state === 'success' ? 1 : 0;
    width.target = labels[row].getBoundingClientRect().width;

    if (immediate || reducedMotion.matches) {
      settle();
      return;
    }

    let last = performance.now();
    function update(now: number) {
      const step = Math.min((now - last) / 1000, 1 / 30) / 4;
      last = now;
      for (let i = 0; i < 4; i++) {
        for (const item of springs) {
          const acceleration = item.stiffness * (item.target - item.value) - item.damping * item.velocity;
          item.velocity += acceleration * step;
          item.value += item.velocity * step;
        }
      }
      if (reducedMotion.matches || springs.every(item => Math.abs(item.target - item.value) < .001 && Math.abs(item.velocity) < .01)) {
        settle();
        if (state === 'default') roll.style.removeProperty('inline-size');
        frame = undefined;
        return;
      }
      render();
      frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
  }

  function reset(immediate = false) {
    status.textContent = '';
    show('default', immediate);
    if (immediate) roll.style.removeProperty('inline-size');
  }

  button.addEventListener('click', async () => {
    if (copying) return;
    copying = true;
    const currentRequest = ++request;
    window.clearTimeout(timer);
    button.dataset.copyState = 'copying';
    button.setAttribute('aria-busy', 'true');
    status.textContent = '正在复制';

    let success = false;
    try {
      const source = button.dataset.copySource;
      const text = source ? document.getElementById(source)?.textContent : button.dataset.copyText;
      if (!text) throw new Error('Copy text is missing');
      await navigator.clipboard.writeText(text);
      success = true;
      if (button.hasAttribute('data-track-email')) track('email_copy');
    } catch {
      // Keep the source text available for manual selection.
    }

    if (request !== currentRequest) return;
    copying = false;
    button.removeAttribute('aria-busy');
    status.textContent = (success ? button.dataset.copySuccess : button.dataset.copyError) ?? '';
    show(success ? 'success' : 'error');
    timer = window.setTimeout(() => reset(), success ? 1800 : 2800);
  });

  button.closest('dialog')?.addEventListener('close', () => {
    request++;
    copying = false;
    window.clearTimeout(timer);
    button.removeAttribute('aria-busy');
    reset(true);
  });
}
