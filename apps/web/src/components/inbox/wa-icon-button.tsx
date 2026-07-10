import { forwardRef, type ReactNode } from "react";
import { cn } from "@whasap/ui/lib/utils";

type WaIconButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export const WaIconButton = forwardRef<HTMLButtonElement, WaIconButtonProps>(
  ({ children, onClick, disabled, label, className }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full text-wa-icon transition-colors hover:bg-wa-hover disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
      >
        {children}
      </button>
    );
  },
);
WaIconButton.displayName = "WaIconButton";
