import { useEffect, useRef } from 'react';

export function PaperBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      renderTexture(ctx, canvas.width, canvas.height);
    };

    const renderTexture = (context: CanvasRenderingContext2D, width: number, height: number) => {
      context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#faf9f6';
      context.fillRect(0, 0, width, height);

      const imageData = context.getImageData(0, 0, width, height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 15;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
      }

      context.putImageData(imageData, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}
