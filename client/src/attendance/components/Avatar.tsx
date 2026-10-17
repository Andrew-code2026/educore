/**
 * Avatar por iniciales (sin fotografías): el color se deriva del nombre, así el
 * mismo estudiante conserva siempre su identidad visual.
 */
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-7 w-7 text-[11px]",
  lg: "h-11 w-11 text-sm",
};

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function Avatar({ name, initials, size = "md", className }: AvatarProps) {
  const hue = hash(name) % 360;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[10px] font-semibold text-white/95",
        "ring-1 ring-inset ring-white/15",
        SIZE_CLASS[size],
        className,
      )}
      style={{
        background: `linear-gradient(145deg, oklch(0.62 0.11 ${hue}), oklch(0.48 0.13 ${(hue + 42) % 360}))`,
      }}
    >
      <span className="tabular tracking-[0.02em]">{initials}</span>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/12" />
    </span>
  );
}
