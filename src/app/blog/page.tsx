import type { Metadata } from "next";
import { getAllPosts, getPostsByCategory, CATEGORIES, BlogPost } from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";

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

type CategoryFilter = BlogPost["category"] | "sve";

interface BlogPageProps {
  searchParams: { kategorija?: string };
}

export default function BlogPage({ searchParams }: BlogPageProps) {
  const activeCategory = (searchParams?.kategorija ?? "sve") as CategoryFilter;

  const posts =
    activeCategory === "sve"
      ? getAllPosts()
      : getPostsByCategory(activeCategory as BlogPost["category"]);

  const allPosts = getAllPosts();
  const featuredPost = allPosts[0];
  const restPosts = activeCategory === "sve" ? allPosts.slice(1) : posts;

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

      {/* Category Filter */}
      <section className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto scrollbar-none">
          {(["sve", "savjeti", "destinacije", "vijesti"] as const).map(
            (cat) => (
              <a
                key={cat}
                href={cat === "sve" ? "/blog" : `/blog?kategorija=${cat}`}
                className={`flex-none px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-amber-500 text-black"
                    : "bg-white/5 text-neutral-300 hover:bg-white/10"
                }`}
              >
                {cat === "sve"
                  ? "Sve"
                  : CATEGORIES[cat as BlogPost["category"]]}
              </a>
            )
          )}
        </div>
      </section>

      {/* Posts */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        {activeCategory === "sve" && featuredPost && (
          <div className="mb-8">
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-4">
              Istaknuto
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <BlogCard post={featuredPost} featured />
            </div>
          </div>
        )}

        {restPosts.length > 0 ? (
          <>
            {activeCategory === "sve" && (
              <p className="text-xs text-neutral-500 uppercase tracking-widest mb-4 mt-10">
                Svi članci
              </p>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {restPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-neutral-500">
            Nema objava u ovoj kategoriji.
          </div>
        )}
      </section>
    </main>
  );
}
