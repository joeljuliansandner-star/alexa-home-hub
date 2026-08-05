import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Ripple = { id: number; x: number; y: number };

/**
 * Große Touchfläche mit Ripple-Effekt und Long-Press.
 * Kurzer Tipp = primäre Aktion, langes Drücken = Detailansicht.
 */
export function Pressable({
  children,
  className,
  onPress,
  onLongPress,
  disabled,
  ariaLabel,
  longPressMs = 450,
}: {
  children: ReactNode;
  className?: string | undefined;
  onPress?: (() => void) | undefined;
  onLongPress?: (() => void) | undefined;
  disabled?: boolean | undefined;
  ariaLabel?: string | undefined;
  longPressMs?: number;
}) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const timer = useRef<number | null>(null);
  const longFired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const spawn = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setRipples((current) => [
      ...current,
      { id, x: event.clientX - rect.left, y: event.clientY - rect.top },
    ]);
    window.setTimeout(() => setRipples((c) => c.filter((r) => r.id !== id)), 600);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "ripple-host relative select-none text-left outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "transition-transform duration-200 ease-out active:scale-[0.985] disabled:opacity-50 disabled:active:scale-100",
        className,
      )}
      onPointerDown={(event) => {
        if (disabled) return;
        longFired.current = false;
        spawn(event);
        if (onLongPress) {
          timer.current = window.setTimeout(() => {
            longFired.current = true;
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              navigator.vibrate?.(12);
            }
            onLongPress();
          }, longPressMs);
        }
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(event) => {
        if (onLongPress) event.preventDefault();
      }}
      onClick={() => {
        if (longFired.current) {
          longFired.current = false;
          return;
        }
        onPress?.();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.shiftKey && onLongPress) {
          event.preventDefault();
          onLongPress();
        }
      }}
    >
      {children}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        {ripples.map((ripple) => (
          <span key={ripple.id} className="ripple" style={{ left: ripple.x, top: ripple.y }} />
        ))}
      </span>
    </button>
  );
}
