import Link from "next/link";

export default function Header() {
  return (
    <header className="relative z-10 border-b-2 border-gold/30 overflow-hidden">
      {/* 背景: 公式風の青空グラデーション */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#3a7cc0] via-[#5aa0d8] to-[#7ec0ee]" />

      {/* 雪山シルエット */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1200 50" fill="none" preserveAspectRatio="none" className="block w-full h-[40px]">
          <path d="M0,50 L0,35 L80,28 L150,33 L250,18 L320,28 L400,12 L450,22 L520,6 L580,20 L650,10 L720,22 L800,4 L870,20 L950,14 L1020,25 L1100,18 L1150,28 L1200,20 L1200,50 Z" fill="rgba(255,255,255,0.2)" />
          <path d="M0,50 L0,40 L100,32 L200,38 L300,24 L380,34 L480,18 L560,30 L640,16 L720,28 L820,12 L900,26 L980,20 L1060,30 L1140,22 L1200,28 L1200,50 Z" fill="rgba(255,255,255,0.12)" />
        </svg>
      </div>

      {/* キラキラ */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute text-white/30 animate-pulse"
            style={{
              left: `${12 + i * 15}%`,
              top: `${20 + (i % 3) * 15}%`,
              fontSize: `${5 + (i % 3) * 2}px`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${2 + (i % 3)}s`,
            }}
          >
            ✦
          </div>
        ))}
      </div>

      {/* コンテンツ */}
      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-light via-gold to-gold-dark text-lg font-black text-white shadow-lg shadow-gold/30 ring-2 ring-white/30 transition-transform group-hover:scale-110">
            W
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/60 text-xs">❄</span>
              <h1 className="text-lg sm:text-xl font-black tracking-wider text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
                WOS <span className="text-gold-light drop-shadow-[0_0_6px_rgba(240,192,64,0.4)]">Tools</span>
              </h1>
              <span className="text-white/60 text-xs">❄</span>
            </div>
            <p className="hidden sm:block text-[9px] font-medium text-white/50 tracking-[0.2em]">WHITEOUT SURVIVAL TOOLKIT</p>
          </div>
        </Link>

        {/* ナビゲーション */}
        <nav className="flex items-center gap-2">
          <Link
            href="/simulator"
            className="flex items-center gap-1.5 rounded-lg bg-white/15 backdrop-blur-sm px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white ring-1 ring-white/20 transition-all hover:bg-white/25 hover:scale-105"
          >
            <span>⚔️</span>
            <span className="hidden sm:inline">シミュレーター</span>
            <span className="sm:hidden">SIM</span>
          </Link>
          <Link
            href="/lottery"
            className="flex items-center gap-1.5 rounded-lg bg-white/15 backdrop-blur-sm px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white ring-1 ring-white/20 transition-all hover:bg-white/25 hover:scale-105"
          >
            <span>🎰</span>
            <span className="hidden sm:inline">SVS抽選</span>
            <span className="sm:hidden">SVS</span>
          </Link>
        </nav>
      </div>

      {/* 下部ゴールドライン */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold-light/50 to-transparent z-10" />
    </header>
  );
}
