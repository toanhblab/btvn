'use client';

import { useEffect, useRef } from 'react';

/** Confetti man chuc mung — port tu Stitch 04. */
export default function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = ['#0058be', '#fd761a', '#eec200', '#22c55e', '#ffb690', '#adc6ff'];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const bits = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 14 + 10,
      h: Math.random() * 14 + 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: Math.random() * 3 + 2,
      speedX: Math.random() * 2 - 1,
      rot: Math.random() * 360,
      rotSpeed: Math.random() * 5 - 2.5,
    }));

    let raf = 0;
    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const c of bits) {
        c.y += c.speedY;
        c.x += c.speedX;
        c.rot += c.rotSpeed;
        if (c.y > canvas.height) {
          c.y = -20;
          c.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
        ctx.rotate((c.rot * Math.PI) / 180);
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 4);
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    frame();

    // Dung han khi roi man, khong thi chay ngam ton pin iPad
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="fixed inset-0 w-full h-full pointer-events-none z-0" />;
}
