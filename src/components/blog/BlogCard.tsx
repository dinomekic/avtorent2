import Link from "next/link";
import Image from "next/image";
import { BlogPost, CATEGORIES, formatDate } from "@/lib/blog";

interface BlogCardProps {
  post: BlogPost;
  featured?: boolean;
}

const CATEGORY_COLORS: Record<BlogPost["category"], string> = {
  savjeti: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  destinacije: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  vijesti: "bg-sky-500/20 text-sky-400 border-sky-500/30",
};

export function BlogCard({ post, featured = false }: BlogCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group block overflow-hidden rounded-2xl border border-white/5 bg-neutral-900 transition-all duration-300 hover:border-white/15 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 ${
        featured ? "md:col-span-2" : ""
      }`}
    >
      <div
        className={`relative overflow-hidden ${featured ? "h-72" : "h-48"}`}
      >
        <Image
          src={post.coverImage}
          alt={post.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/20 to-transparent" />
        <span
          className={`absolute top-4 left-4 text-xs font-semibold px-3 py-1 rounded-full border backdrop-blur-sm ${
            CATEGORY_COLORS[post.category]
          }`}
        >
          {CATEGORIES[post.category]}
        </span>
      </div>

      <div className="p-6">
        <h2
          className={`font-bold text-white leading-tight mb-2 group-hover:text-amber-400 transition-colors ${
            featured ? "text-2xl" : "text-lg"
          }`}
        >
          {post.title}
        </h2>
        <p className="text-neutral-400 text-sm leading-relaxed mb-4 line-clamp-2">
          {post.excerpt}
        </p>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>{formatDate(post.date)}</span>
          <span>{post.readTime} min čitanja</span>
        </div>
      </div>
    </Link>
  );
}
