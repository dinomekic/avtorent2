import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getPostBySlug,
  getAllPosts,
  CATEGORIES,
  formatDate,
  BlogPost,
} from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} — AdriaDrive Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [{ url: post.coverImage }],
    },
  };
}

const CATEGORY_COLORS: Record<BlogPost["category"], string> = {
  savjeti: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  destinacije: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  vijesti: "bg-sky-500/20 text-sky-400 border-sky-500/30",
};

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const allPosts = getAllPosts();
  const related = allPosts
    .filter((p) => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);

  // Simple markdown-to-HTML: headings, bold, paragraphs
  const renderContent = (md: string) => {
    return md
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("# "))
          return (
            <h1
              key={i}
              className="text-3xl font-bold text-white mt-8 mb-4 first:mt-0"
            >
              {line.slice(2)}
            </h1>
          );
        if (line.startsWith("## "))
          return (
            <h2 key={i} className="text-xl font-bold text-white mt-8 mb-3">
              {line.slice(3)}
            </h2>
          );
        if (line.startsWith("### "))
          return (
            <h3 key={i} className="text-lg font-semibold text-white mt-6 mb-2">
              {line.slice(4)}
            </h3>
          );
        if (line.startsWith("- "))
          return (
            <li key={i} className="text-neutral-300 ml-4 list-disc mb-1">
              {line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}
            </li>
          );
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return (
          <p key={i} className="text-neutral-300 leading-relaxed mb-2">
            {line}
          </p>
        );
      });
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Back */}
      <div className="max-w-3xl mx-auto px-4 pt-8">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-amber-400 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Nazad na blog
        </Link>
      </div>

      {/* Hero */}
      <article className="max-w-3xl mx-auto px-4 pt-8 pb-20">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full border ${
              CATEGORY_COLORS[post.category]
            }`}
          >
            {CATEGORIES[post.category]}
          </span>
          <span className="text-neutral-500 text-sm">
            {formatDate(post.date)}
          </span>
          <span className="text-neutral-500 text-sm">
            · {post.readTime} min čitanja
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6 tracking-tight">
          {post.title}
        </h1>

        <p className="text-lg text-neutral-400 mb-8 leading-relaxed border-l-2 border-amber-500/50 pl-4">
          {post.excerpt}
        </p>

        {/* Cover */}
        <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden mb-10">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/30 to-transparent" />
        </div>

        {/* Content */}
        <div className="prose-custom">{renderContent(post.content)}</div>

        {/* Author */}
        <div className="mt-12 pt-8 border-t border-white/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
            AD
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{post.author}</p>
            <p className="text-neutral-500 text-xs">AdriaDrive — Rent a Car Balkan</p>
          </div>
        </div>
      </article>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t border-white/5 bg-neutral-900/50 py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-bold mb-8">
              Slični članci
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((p) => (
                <BlogCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
