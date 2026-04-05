import Link from "next/link";

const HERO_IMGS = {
  magnus: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/magnus.jpg",
  hervil: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FHervor-1.jpg",
  blanchette: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/12/blanchette350.jpg",
  carol: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fkarol-1.jpg",
  lyjia: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FLigeia-1.jpg",
  elionora: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/03/eleonora.jpg",
  rufas: "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/03/rufus.jpg",
};

function HeroBubble({ src, name, size = "md", className = "" }: { src: string; name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dim = size === "lg" ? "h-20 w-20 sm:h-24 sm:w-24" : size === "md" ? "h-14 w-14 sm:h-16 sm:w-16" : "h-10 w-10 sm:h-12 sm:w-12";
  const ring = size === "lg" ? "ring-3" : "ring-2";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={`${dim} rounded-full object-cover ${ring} ring-gold/40 shadow-lg shadow-gold/20 transition-transform duration-300 hover:scale-110 ${className}`}
    />
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      {/* ヒーローショーケース上部 */}
      <div className="mb-6 flex items-center gap-3 sm:gap-5">
        <HeroBubble src={HERO_IMGS.carol} name="カロール" size="sm" className="opacity-60 -translate-y-2" />
        <HeroBubble src={HERO_IMGS.hervil} name="ヘルヴィル" size="md" className="opacity-80" />
        <HeroBubble src={HERO_IMGS.magnus} name="マグナス" size="lg" />
        <HeroBubble src={HERO_IMGS.blanchette} name="ブランシュ" size="md" className="opacity-80" />
        <HeroBubble src={HERO_IMGS.lyjia} name="ライジーア" size="sm" className="opacity-60 -translate-y-2" />
      </div>

      {/* タイトル */}
      <div className="mb-2 text-center">
        <h2 className="text-gradient-gold text-3xl font-black tracking-wider sm:text-5xl">
          WOS Tools
        </h2>
        <p className="mt-2 text-xs font-medium tracking-[0.3em] text-text-muted sm:text-sm">
          WHITEOUT SURVIVAL COMMUNITY TOOLKIT
        </p>
      </div>

      <div className="gold-divider mx-auto mb-8 w-32 sm:mb-10 sm:w-48" />

      {/* ツールカード */}
      <div className="grid w-full max-w-3xl gap-4 sm:gap-6 sm:grid-cols-2">
        {/* シミュレーター */}
        <Link
          href="/simulator"
          className="card-corners panel-glow group relative overflow-hidden rounded-2xl border-2 border-wos-border bg-wos-panel transition-all duration-300 hover:border-atk-red/40 hover:shadow-xl hover:-translate-y-1"
        >
          {/* 背景グラデーション */}
          <div className="absolute inset-0 bg-gradient-to-br from-atk-red/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative flex items-center gap-4 p-5 sm:p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_IMGS.magnus}
              alt="マグナス"
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-2 border-gold/30 object-cover shadow-md transition-transform duration-300 group-hover:scale-105 group-hover:shadow-lg"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">⚔️</span>
                <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-atk-red to-atk-red-light bg-clip-text text-transparent">
                  集結シミュレーター
                </h3>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-text-secondary line-clamp-2">
                英雄スキル・兵種相性を考慮した集結戦闘シミュレーション
              </p>
              <div className="mt-3 inline-flex items-center gap-1 rounded-lg bg-atk-red/10 px-3 py-1 text-xs font-bold text-atk-red transition-colors group-hover:bg-atk-red/20">
                開始する →
              </div>
            </div>
          </div>
        </Link>

        {/* SVS抽選 */}
        <Link
          href="/lottery"
          className="card-corners panel-glow group relative overflow-hidden rounded-2xl border-2 border-wos-border bg-wos-panel transition-all duration-300 hover:border-def-blue/40 hover:shadow-xl hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-def-blue/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative flex items-center gap-4 p-5 sm:p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_IMGS.blanchette}
              alt="ブランシュ"
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-2 border-gold/30 object-cover shadow-md transition-transform duration-300 group-hover:scale-105 group-hover:shadow-lg"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🎰</span>
                <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-def-blue to-def-blue-light bg-clip-text text-transparent">
                  SVS褒賞抽選
                </h3>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-text-secondary line-clamp-2">
                SVSイベントの褒賞を公平に抽選・管理
              </p>
              <div className="mt-3 inline-flex items-center gap-1 rounded-lg bg-def-blue/10 px-3 py-1 text-xs font-bold text-def-blue transition-colors group-hover:bg-def-blue/20">
                開始する →
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* 下部の英雄ショーケース */}
      <div className="gold-divider mx-auto mt-10 mb-4 w-32 sm:w-48" />
      <div className="flex items-center gap-3 sm:gap-6">
        <HeroBubble src={HERO_IMGS.elionora} name="エリオノーラ" size="sm" className="opacity-50" />
        <HeroBubble src={HERO_IMGS.rufas} name="ルーファス" size="sm" className="opacity-50" />
        <p className="text-center text-[10px] sm:text-xs text-text-muted leading-relaxed max-w-[180px] sm:max-w-none">
          極寒の地で生き抜く<br className="sm:hidden" />英雄たちの物語
        </p>
        <HeroBubble src={HERO_IMGS.carol} name="カロール" size="sm" className="opacity-50" />
        <HeroBubble src={HERO_IMGS.lyjia} name="ライジーア" size="sm" className="opacity-50" />
      </div>
    </div>
  );
}
