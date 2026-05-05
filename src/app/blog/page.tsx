import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Blog — AdriaDrive",
  description:
    "Savjeti za putovanje, destinacije na Balkanu i vijesti iz AdriaDrive-a.",
  openGraph: {
    title: "Blog — AdriaDrive",
    description:
      "Savjeti za putovanje, destinacije na Balkanu i vijesti iz AdriaDrive-a.",
    siteName: "AdriaDrive",
  },
};

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-neutral-950 to-neutral-950" />
        <div className="relative max-w-5xl mx-auto text-center">
          <span className="inline-block text-amber-400 text-sm font-semibold tracking-widest uppercase mb-4">
            AdriaDrive Blog
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
            Putujte pametnije.
            <br />
            <span className="text-amber-400">Otkrijte više.</span>
          </h1>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Savjeti za iznajmljivanje, destinacije koje vrijedi posjetiti i
            najnovije vijesti iz AdriaDrive-a.
          </p>
        </div>
      </section>

      {/* Soro Blog Embed */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div id="soro-blog" />
        <Script
          src="https://app.trysoro.com/api/embed/16773211-0733-4454-87cc-ebd145c43c1b"
          strategy="afterInteractive"
        />
      </section>
    </main>
  );
}
