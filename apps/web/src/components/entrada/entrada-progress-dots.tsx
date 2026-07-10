import { cn } from "@whasap/ui/lib/utils";

type Props = { total: number; current: number };

const DOT_IDS = ["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"] as const;

export function EntradaProgressDots({ total, current }: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      {DOT_IDS.slice(0, total).map((id, i) => {
        const active = i <= current;
        return (
          <span
            key={id}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              active ? "bg-wa-green" : "bg-wa-border",
            )}
            style={{ width: i === current ? 28 : 10 }}
          />
        );
      })}
    </div>
  );
}
