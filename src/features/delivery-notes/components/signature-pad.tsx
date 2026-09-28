"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui";

type Props = {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  height?: number;
  placeholder?: string;
  showClear?: boolean;
};

/** Simple canvas signature pad — outputs PNG data URL */
export function SignaturePad({
  value,
  onChange,
  label = "חתימה",
  height = 140,
  placeholder = "חתום כאן",
  showClear = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, height);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, height);
      };
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  function pos(e: ReactPointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: ReactPointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, height);
    onChange(null);
  }

  return (
    <div className="space-y-1.5">
      {showClear && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-600">{label}</p>
          <Button type="button" size="sm" variant="outline" onClick={clear}>
            נקה חתימה
          </Button>
        </div>
      )}
      <div className="relative">
        {!value && placeholder && (
          <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm font-semibold text-slate-400">
            {placeholder}
          </p>
        )}
        <canvas
          ref={canvasRef}
          className="w-full touch-none rounded-xl border border-gray-300 bg-white"
          style={{ height }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      </div>
      {!showClear && (
        <button
          type="button"
          onClick={clear}
          className="text-xs font-semibold text-slate-500 underline"
        >
          נקה חתימה
        </button>
      )}
    </div>
  );
}
