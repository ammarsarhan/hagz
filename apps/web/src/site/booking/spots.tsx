// An open game's spots, as the app draws them (Figma C11's signature): the booker as an outlined
// disc with their initial, each player who's joined, then each spot still open, dashed. The page is
// for someone who hasn't joined, so the joined players are hatched in grey: there, but not who (the
// API keeps their names until you join).

const OPEN = "#b5b9bf";

export function Spots({ booker, joined, open }: { booker: string; joined: number; open: number }) {
  const disc = "flex size-10 shrink-0 items-center justify-center rounded-full lg:size-11";
  return (
    <div className="flex flex-wrap gap-1.5" aria-hidden>
      <span className={`${disc} border-[1.5px] border-ink text-label font-semibold`}>
        {booker.slice(0, 1).toUpperCase()}
      </span>
      {Array.from({ length: joined }, (_, index) => (
        <span
          key={`j${index}`}
          className={`${disc} border-[1.5px]`}
          style={{
            borderColor: OPEN,
            backgroundImage: `repeating-linear-gradient(45deg, ${OPEN} 0 1px, transparent 1px 5px)`,
          }}
        />
      ))}
      {Array.from({ length: open }, (_, index) => (
        <span
          key={`o${index}`}
          className={`${disc} border-[1.5px] border-dashed`}
          style={{ borderColor: OPEN }}
        />
      ))}
    </div>
  );
}
