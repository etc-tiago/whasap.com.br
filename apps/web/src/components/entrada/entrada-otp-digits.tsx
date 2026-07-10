import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

const OTP_DIGIT_IDS = ["otp-0", "otp-1", "otp-2", "otp-3", "otp-4", "otp-5"] as const;

export function EntradaOtpDigits({ value, onChange, disabled, autoFocus = true }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  const update = (i: number, ch: string) => {
    const clean = ch.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[i] = clean;
    const joined = next.join("").replace(/\s/g, "").slice(0, 6);
    onChange(joined);
    if (clean && i < 5) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i].trim() && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text) {
      e.preventDefault();
      onChange(text);
      refs.current[Math.min(text.length, 5)]?.focus();
    }
  };

  return (
    <div className="flex justify-between gap-2" onPaste={onPaste}>
      {digits.map((d, i) => (
        <input
          key={OTP_DIGIT_IDS[i]}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={d.trim()}
          onChange={(e) => update(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          className="h-14 w-full rounded-xl border border-wa-border bg-wa-surface text-center text-xl font-semibold text-wa-text outline-none transition focus:border-wa-green focus:ring-2 focus:ring-wa-green/25 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
