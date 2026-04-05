import Link from "next/link";

const tools = [
  {
    title: "集結シミュレーター",
    description:
      "攻撃・防御の編成を組み、英雄スキルや兵種相性を考慮した集結戦闘をシミュレーションします。",
    href: "/simulator",
    icon: "⚔️",
    accent: "from-atk-red to-atk-red-light",
    border: "hover:border-atk-red/50",
  },
  {
    title: "SVS褒賞抽選",
    description:
      "SVSイベントの褒賞を公平に抽選。参加者と報酬を設定して、ワンクリックで結果を生成します。",
    href: "/lottery",
    icon: "🎰",
    accent: "from-ice-blue to-ice-blue-light",
    border: "hover:border-ice-blue/50",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="mb-12 text-center">
        <h2 className="text-gradient-gold mb-3 text-4xl font-bold tracking-wide sm:text-5xl">
          WOS Tools
        </h2>
        <p className="text-sm text-gray-400 sm:text-base">
          Whiteout Survival コミュニティツール
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className={`panel-glow group rounded-xl border-2 border-wos-border bg-wos-panel p-6 transition-all ${tool.border} hover:bg-wos-panel-light`}
          >
            <div className="mb-4 text-4xl">{tool.icon}</div>
            <h3
              className={`mb-2 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent ${tool.accent}`}
            >
              {tool.title}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">
              {tool.description}
            </p>
            <div className="mt-4 text-xs font-medium text-gold-dark transition-colors group-hover:text-gold-light">
              開く &rarr;
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
