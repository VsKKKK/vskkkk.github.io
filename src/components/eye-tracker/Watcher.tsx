// Copyright (c) 2026 Lorenzo Cabra. MIT License, see LICENSE.
// Adapted from Bencho blocks/eye-tracker at c65992417427bb09e661674ffa800bef29adef49.
import { useEffect, useId, useRef } from 'react';
import type { CSSProperties } from 'react';
import './Watcher.css';

const R = 50;
const STYLES = { Slant: { w: 9, h: 15, r: 4.5 } };

const GAP = 0.19;

const TILT = 64;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const body = "M30 6 H70 A24 24 0 0 1 94 30 V70 A24 24 0 0 1 70 94 H30 A24 24 0 0 1 6 70 V30 A24 24 0 0 1 30 6 Z";
const lines = ['别戳我啦！', '又来啦？好吧。', '啵！', '嗨，你好！'];

export function Watcher({ instance, size = 100, follow = 60, bounce = 30 }: {
  instance: string;
  size?: number;
  follow?: number;
  bounce?: number;
}) {
  const box = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const showBubble = useRef<() => void>(() => {});
  const eyes = useRef<(SVGGElement | null)[]>([]);
  const clip = `eyt-clip-${instance}-${useId().replace(/[^\w-]/g, '')}`;

  useEffect(() => {
    const trigger = box.current;
    const message = bubble.current;
    if (!trigger || !message) return;
    const dialog = trigger.closest('dialog');
    const viewport = window.visualViewport;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let index = 0;
    let timer = 0;
    let finish = 0;

    const position = () => {
      if (!message.matches(':popover-open')) return;
      const anchor = trigger.getBoundingClientRect();
      const leftEdge = (viewport?.offsetLeft ?? 0) + 12;
      const rightEdge = leftEdge + (viewport?.width ?? document.documentElement.clientWidth) - 24;
      const topEdge = (viewport?.offsetTop ?? 0) + 12;
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 24;
      const center = anchor.left + anchor.width / 2;
      const above = anchor.top - message.offsetHeight - 6 >= topEdge;
      const left = clamp(center - message.offsetWidth / 2, leftEdge, rightEdge - message.offsetWidth);
      const top = clamp(above ? anchor.top - message.offsetHeight - 6 : anchor.bottom + 6, topEdge, bottomEdge - message.offsetHeight);
      message.dataset.side = above ? 'above' : 'below';
      message.style.left = `${left}px`;
      message.style.top = `${top}px`;
      message.style.setProperty('--eyt-tail', `${clamp(center - left, 12, message.offsetWidth - 12)}px`);
    };
    const hide = () => {
      window.clearTimeout(timer);
      window.clearTimeout(finish);
      if (message.matches(':popover-open')) message.hidePopover();
      delete message.dataset.fading;
    };
    showBubble.current = () => {
      window.clearTimeout(timer);
      window.clearTimeout(finish);
      delete message.dataset.fading;
      if (!message.matches(':popover-open')) message.showPopover();
      message.textContent = lines[index];
      index = (index + 1) % lines.length;
      position();
      timer = window.setTimeout(() => {
        message.dataset.fading = '';
        finish = window.setTimeout(hide, reducedMotion.matches ? 0 : 160);
      }, 1700);
    };
    dialog?.addEventListener('close', hide);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    viewport?.addEventListener('resize', position);
    viewport?.addEventListener('scroll', position);
    return () => {
      showBubble.current = () => {};
      hide();
      dialog?.removeEventListener('close', hide);
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      viewport?.removeEventListener('resize', position);
      viewport?.removeEventListener('scroll', position);
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    const frame = el?.closest<HTMLElement>('[data-eye-tracker-region]');
    if (!el || !frame) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const t = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    let raf = 0;
    let timer = 0;
    let prev = 0;
    let blink = -Infinity;
    let nextBlink = performance.now() + 2200;
    let seen = false;

    const draw = (now: number) => {
      /* a blink is 160ms down and up, as a squash on each eye */
      let lid = 1;
      if (now > nextBlink) {
        blink = now;
        nextBlink = now + (2600 + Math.random() * 3200);
      }
      const since = now - blink;
      if (since < 160) lid = 1 - 0.9 * Math.sin((since / 160) * Math.PI);

      /* the turn that brings the front of the ball to the face's
         spot: yaw about the vertical, pitch about the horizontal */
      const as = (v: number) => Math.asin(clamp(v, -0.92, 0.92));
      const yaw = as(t.x);
      const pitch = -as(t.y);
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      /* the pair leans with a diagonal look and stands level on
         the axes: up-right and down-left lean one way, the other
         two the other, nothing straight on */
      const tilt = TILT * t.x * t.y;
      /* bigger eyes stand a little further apart */
      const g0 = GAP;

      [-g0, g0].forEach((x0, i) => {
        const g = eyes.current[i];
        if (!g) return;
        /* the eye as a point on the unit sphere, either side of
           the front, turned with the ball */
        const z0 = Math.sqrt(1 - x0 * x0);
        const x1 = x0 * cy + z0 * sy;
        const z1 = -x0 * sy + z0 * cy;
        const y2 = -z1 * sp;
        const z2 = z1 * cp;
        /* depth: the eye nearer the rim is further from you, so it
           is smaller all over and narrower still across the turn */
        const near = clamp(z2, 0, 1);
        const k = 0.45 + 0.55 * near;
        const sx = k * (0.7 + 0.3 * near);
        /* ── the size is written as a size, never as a scale ──
           A scale stretches the corner with the shape: an eye
           narrowed for depth or squashed by a blink had elliptical
           corners, rounder on one side than the other. Writing the
           width and height directly keeps every corner the same
           radius, clamped so it never exceeds half a side. */
        const e0 = STYLES.Slant;
        const w = e0.w * sx;
        const h = Math.max(0.6, e0.h * k * lid);
        const rect = g.firstElementChild as SVGRectElement | null;
        if (rect) {
          rect.setAttribute("x", (-w / 2).toFixed(2));
          rect.setAttribute("y", (-h / 2).toFixed(2));
          rect.setAttribute("width", w.toFixed(2));
          rect.setAttribute("height", h.toFixed(2));
          rect.setAttribute("rx", Math.min(e0.r, w / 2, h / 2).toFixed(2));
        }
        g.setAttribute(
          "transform",
          `translate(${(50 + x1 * R).toFixed(2)} ${(50 + y2 * R).toFixed(2)}) rotate(${tilt.toFixed(2)})`,
        );
        g.style.opacity = z2 < 0.05 ? "0" : "1";
      });
    };


    const active = () => seen && !document.hidden && !motion.matches && pointer.matches;
    const tick = (now: number) => {
      if (!active()) { raf = 0; prev = 0; return; }
      const dt = prev ? Math.min(2.5, (now - prev) / 16.67) : 1;
      prev = now;
      const k = 0.06;
      const d = 0.34 - (clamp(bounce, 0, 100) / 100) * 0.22;
      t.vx += ((t.tx - t.x) * k - t.vx * d) * dt;
      t.vy += ((t.ty - t.y) * k - t.vy * d) * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      const settled = Math.max(Math.abs(t.tx - t.x), Math.abs(t.ty - t.y), Math.abs(t.vx), Math.abs(t.vy)) < 0.0002;
      if (settled) Object.assign(t, { x: t.tx, y: t.ty, vx: 0, vy: 0 });
      draw(now);
      raf = 0;
      if (!settled || now - blink < 160) {
        raf = requestAnimationFrame(tick);
      } else {
        prev = 0;
        timer = window.setTimeout(wake, Math.max(0, nextBlink - now));
      }
    };
    function wake() {
      window.clearTimeout(timer);
      if (!raf && active()) raf = requestAnimationFrame(tick);
    }
    const update = () => {
      if (active()) {
        wake();
        return;
      }
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      raf = 0;
      prev = 0;
      Object.assign(t, { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 });
      blink = -Infinity;
      nextBlink = performance.now() + 2200;
      draw(performance.now());
    };
    const aimAt = (x: number, y: number) => {
      if (!active()) return;
      const f = frame.getBoundingClientRect();
      if (x < f.left || x > f.right || y < f.top || y > f.bottom) {
        t.tx = 0;
        t.ty = 0;
        return;
      }
      const r = el.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.max(60, Math.min(f.width, f.height) * 0.28);
      const far = clamp(Math.tanh(d / reach) * (clamp(follow, 0, 100) / 100) * 1.5, 0, 0.85);
      t.tx = (dx / d) * far;
      t.ty = (dy / d) * far;
      wake();
    };
    const aim: EventListener = (event) => {
      if (!(event instanceof PointerEvent)) return;
      if (event.pointerType === 'touch') return;
      aimAt(event.clientX, event.clientY);
    };
    const rest = () => {
      t.tx = 0;
      t.ty = 0;
      wake();
    };


    const observer = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting;
      update();
    });
    observer.observe(el);
    frame.addEventListener('pointermove', aim, { passive: true });
    frame.addEventListener('pointerleave', rest);
    frame.addEventListener('pointercancel', rest);
    window.addEventListener('blur', rest);
    document.addEventListener('visibilitychange', update);
    motion.addEventListener('change', update);
    pointer.addEventListener('change', update);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      observer.disconnect();
      frame.removeEventListener('pointermove', aim);
      frame.removeEventListener('pointerleave', rest);
      frame.removeEventListener('pointercancel', rest);
      window.removeEventListener('blur', rest);
      document.removeEventListener('visibilitychange', update);
      motion.removeEventListener('change', update);
      pointer.removeEventListener('change', update);
    };
  }, [follow, bounce]);

  return (
    <>
    <button type="button" className="eyt" ref={box} style={{ '--eyt-size': `${clamp(size, 16, 180)}px` } as CSSProperties}
      aria-label="和角色打个招呼" onClick={event => { event.stopPropagation(); showBubble.current(); }}>
      <svg className="eyt-ball" viewBox="0 0 100 100" focusable="false" aria-hidden="true">
        <defs><clipPath id={clip}><path d={body} /></clipPath></defs>
        <path className="eyt-body" d={body} />
        <g clipPath={`url(#${clip})`}>
          {[40.5, 59.5].map((x, i) => (
            <g key={x} transform={`translate(${x} 50) rotate(0)`} ref={node => { eyes.current[i] = node; }}>
              <rect className="eyt-eye" x="-4.43" y="-7.43" width="8.86" height="14.85" rx="4.43" />
            </g>
          ))}
        </g>
      </svg>
    </button>
    <div className="eyt-bubble" ref={bubble} popover="manual" role="status" />
    </>
  );
}
