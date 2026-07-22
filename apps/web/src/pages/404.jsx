import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Search, FileQuestion } from "lucide-react";
import NavBar from "../components/MarketingNavBar";
import Seo from "../components/Seo";
import { APP_NAME } from "../lib/brand";

// Next.js renders this automatically for any unmatched route — including
// /templates/[slug] when getStaticProps returns { notFound: true } for a
// missing or removed template key. Renders identically whether the visitor
// is logged in or not (MarketingNavBar doesn't check auth state), so it
// covers the "before and after login" case without any special-casing.
export default function Custom404() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const runSearch = (e) => {
    e.preventDefault();
    router.push(`/templates?q=${encodeURIComponent(search)}`);
  };

  return (
    <div className="font-body text-ink min-h-screen flex flex-col">
      <Seo title="Page Not Found" description={`This page doesn't exist on ${APP_NAME}.`} noindex path={router.asPath} />
      <NavBar />

      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-base flex items-center justify-center mx-auto mb-5">
            <FileQuestion size={26} className="text-ink/40" />
          </div>
          <h1 className="font-display font-bold text-2xl text-ink mb-2">
            {router.asPath.startsWith("/templates/") ? "Template Not Found" : "Page Not Found"}
          </h1>
          <p className="text-ink/60 mb-6">
            {router.asPath.startsWith("/templates/")
              ? "That template doesn't exist or may have been renamed — try searching for what you need, or browse the full marketplace."
              : "The page you're looking for doesn't exist or may have moved."}
          </p>

          <form onSubmit={runSearch} className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="w-full h-11 pl-9 pr-3 rounded-lg border border-border text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </form>

          <div className="flex items-center justify-center gap-3">
            <Link href="/templates" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark">
              Browse Templates
            </Link>
            <Link href="/" className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-ink/70 hover:bg-base">
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
