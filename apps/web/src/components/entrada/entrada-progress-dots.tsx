type Props = { total: number; current: number };

export function EntradaProgressDots({ total, current }: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const active = i <= current;
        return (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              active ? "bg-wa-green" : "bg-wa-border"
            }`}
            style={{ width: i === current ? 28 : 10 }}
          />
        );
      })}
    </div>
  );
}
