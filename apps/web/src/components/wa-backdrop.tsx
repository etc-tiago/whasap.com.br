import { cn } from "@whasap/ui/lib/utils";

type Props = {
  className?: string;
};

export function WaBackdrop({ className }: Props) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 -z-10 bg-wa-bg wa-wallpaper", className)}
    />
  );
}
