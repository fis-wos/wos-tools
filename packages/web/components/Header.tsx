import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-wos-border bg-wos-panel">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-gold-light to-gold-dark text-lg font-bold text-wos-dark">
            W
          </div>
          <h1 className="text-gradient-gold text-xl font-bold tracking-wide">
            WOS Tools
          </h1>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href="/simulator"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-wos-panel-light hover:text-gold-light"
          >
            シミュレーター
          </Link>
          <Link
            href="/lottery"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-wos-panel-light hover:text-gold-light"
          >
            SVS抽選
          </Link>
        </nav>
        {/* Mobile menu button */}
        <div className="flex sm:hidden">
          <Link
            href="/simulator"
            className="rounded-lg px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:text-gold-light"
          >
            SIM
          </Link>
          <Link
            href="/lottery"
            className="rounded-lg px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:text-gold-light"
          >
            SVS
          </Link>
        </div>
      </div>
    </header>
  );
}
