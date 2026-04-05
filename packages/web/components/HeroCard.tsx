interface HeroCardProps {
  name: string;
  generation: number;
  rarity: "SSR" | "SR";
  troopType: "shield" | "spear" | "bow";
  imageUrl?: string;
  selected?: boolean;
  onClick?: () => void;
}

const troopColors: Record<string, string> = {
  shield: "border-shield-blue bg-shield-blue/10",
  spear: "border-spear-orange bg-spear-orange/10",
  bow: "border-bow-green bg-bow-green/10",
};

const troopLabels: Record<string, string> = {
  shield: "盾",
  spear: "槍",
  bow: "弓",
};

const rarityColors: Record<string, string> = {
  SSR: "text-gold-dark",
  SR: "text-def-blue",
};

export default function HeroCard({
  name,
  generation,
  rarity,
  troopType,
  imageUrl,
  selected = false,
  onClick,
}: HeroCardProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center rounded-lg border-2 p-2 transition-all ${
        selected
          ? "border-gold bg-gold/10 shadow-[0_0_10px_rgba(212,168,67,0.3)]"
          : `${troopColors[troopType]} hover:border-gold-dark/50`
      }`}
    >
      {/* Rarity badge */}
      <span
        className={`absolute top-1 left-1 text-[10px] font-bold ${rarityColors[rarity]}`}
      >
        {rarity}
      </span>

      {/* Generation badge */}
      <span className="absolute top-1 right-1 text-[10px] text-text-muted">
        G{generation}
      </span>

      {/* Portrait */}
      <div className="my-1 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white/60 sm:h-16 sm:w-16">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-2xl text-text-muted">?</span>
        )}
      </div>

      {/* Name */}
      <span className="mt-1 text-xs font-medium text-text-primary leading-tight">
        {name}
      </span>

      {/* Troop type label */}
      <span className="mt-0.5 text-[10px] text-text-secondary">
        {troopLabels[troopType]}
      </span>
    </button>
  );
}
