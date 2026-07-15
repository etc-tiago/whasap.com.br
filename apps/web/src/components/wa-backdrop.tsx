import { cn } from "@whasap/ui/lib/utils";

type Props = {
  className?: string;
};

export function WaBackdrop({ className }: Props) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 -z-10 bg-wa-bg", className)}
    >
      <div className="absolute inset-0 wa-wallpaper" />
    </div>
  );
}
