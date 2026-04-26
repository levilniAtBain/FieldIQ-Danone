"use client";

import { useState, useMemo } from "react";
import { Search, X, ExternalLink, Play, Package, Pencil, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  videoUrl: string | null;
  unitPrice: string | null;
};

const BRAND_COLORS: Record<string, string> = {
  nutricia: "bg-blue-50 text-blue-700 border-blue-200",
  gallia: "bg-green-50 text-green-700 border-green-200",
  bledina: "bg-amber-50 text-amber-700 border-amber-200",
  aptamil: "bg-red-50 text-red-700 border-red-200",
  evian: "bg-sky-50 text-sky-700 border-sky-200",
  volvic: "bg-emerald-50 text-emerald-700 border-emerald-200",
  other: "bg-gray-100 text-gray-600 border-gray-200",
};

const BRANDS = [
  "nutricia", "gallia", "bledina", "aptamil", "evian", "volvic",
];

function brandLabel(b: string) {
  return b.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.replace("/", "");
      return `https://player.vimeo.com/video/${id}`;
    }
    // Direct video file
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return null; // handled as <video>
    return null;
  } catch {
    return null;
  }
}

function isDirectVideo(url: string) {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

export function CatalogView({
  initialProducts,
  categories,
}: {
  initialProducts: Product[];
  categories: string[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);

  function handleProductUpdate(id: string, patch: Partial<Product>) {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
    setSelected((prev) => prev?.id === id ? { ...prev, ...patch } : prev);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) &&
          !p.sku.toLowerCase().includes(q) &&
          !p.brand.toLowerCase().includes(q) &&
          !p.category.toLowerCase().includes(q) &&
          !(p.description?.toLowerCase().includes(q))) return false;
      if (brandFilter.length > 0 && !brandFilter.includes(p.brand)) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(p.category)) return false;
      return true;
    });
  }, [products, search, brandFilter, categoryFilter]);

  // Group by brand for display
  const grouped = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    for (const p of filtered) {
      if (!groups[p.brand]) groups[p.brand] = [];
      groups[p.brand].push(p);
    }
    return groups;
  }, [filtered]);

  const toggleBrand = (b: string) =>
    setBrandFilter((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]);
  const toggleCategory = (c: string) =>
    setCategoryFilter((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Catalogue produits</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {filtered.length} produit{filtered.length !== 1 ? "s" : ""}
          {filtered.length < initialProducts.length && ` sur ${initialProducts.length}`}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, SKU, marque, catégorie…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={14} className="text-gray-400" />
          </button>
        )}
      </div>

      {/* Brand filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {BRANDS.map((b) => (
          <button
            key={b}
            onClick={() => toggleBrand(b)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
              brandFilter.includes(b)
                ? BRAND_COLORS[b]
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
            )}
          >
            {brandLabel(b)}
          </button>
        ))}
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => toggleCategory(c)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs border transition-all capitalize",
                categoryFilter.includes(c)
                  ? "bg-brand-50 border-brand-300 text-brand-700 font-medium"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Active filters summary */}
      {(brandFilter.length > 0 || categoryFilter.length > 0) && (
        <button
          onClick={() => { setBrandFilter([]); setCategoryFilter([]); }}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <X size={12} /> Effacer les filtres
        </button>
      )}

      {/* Product grid grouped by brand */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <Package size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">Aucun produit trouvé</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([brand, prods]) => (
            <section key={brand}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", BRAND_COLORS[brand] ?? BRAND_COLORS.other)}>
                  {brandLabel(brand)}
                </span>
                <span className="text-xs text-gray-400">{prods.length} produit{prods.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {prods.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-brand-200 hover:shadow-sm transition-all text-left"
                  >
                    {/* Image */}
                    <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-full object-contain p-2"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Package size={32} className="text-gray-200" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">{p.category}</p>
                      {p.unitPrice && (
                        <p className="text-xs font-semibold text-gray-700 mt-1">
                          €{parseFloat(p.unitPrice).toFixed(2)}
                        </p>
                      )}
                      {p.videoUrl && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-brand-500 mt-1">
                          <Play size={10} /> Vidéo
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Product detail modal */}
      {selected && (
        <ProductModal
          product={selected}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => handleProductUpdate(selected.id, patch)}
        />
      )}
    </div>
  );
}

function ProductModal({
  product,
  onClose,
  onUpdate,
}: {
  product: Product;
  onClose: () => void;
  onUpdate: (patch: Partial<Product>) => void;
}) {
  const embedUrl = product.videoUrl ? getVideoEmbedUrl(product.videoUrl) : null;
  const directVideo = product.videoUrl && isDirectVideo(product.videoUrl);

  const [editing, setEditing] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState(product.imageUrl ?? "");
  const [videoUrlDraft, setVideoUrlDraft] = useState(product.videoUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: imageUrlDraft.trim() || null,
          videoUrl: videoUrlDraft.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      onUpdate({
        imageUrl: imageUrlDraft.trim() || null,
        videoUrl: videoUrlDraft.trim() || null,
      });
      setEditing(false);
    } catch {
      setSaveError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setImageUrlDraft(product.imageUrl ?? "");
    setVideoUrlDraft(product.videoUrl ?? "");
    setSaveError(null);
    setEditing(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="relative bg-gray-50 rounded-t-3xl aspect-video flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain p-4"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <Package size={48} className="text-gray-200" />
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center text-gray-600 hover:bg-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", BRAND_COLORS[product.brand] ?? BRAND_COLORS.other)}>
                  {brandLabel(product.brand)}
                </span>
                <span className="text-xs text-gray-400 capitalize">{product.category}</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">SKU: {product.sku}</p>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 flex-shrink-0 mt-1"
                title="Modifier les médias"
              >
                <Pencil size={13} /> Médias
              </button>
            )}
          </div>

          {/* Price */}
          {product.unitPrice && (
            <p className="text-xl font-bold text-gray-900">
              €{parseFloat(product.unitPrice).toFixed(2)}
              <span className="text-sm font-normal text-gray-400 ml-1">/ unité</span>
            </p>
          )}

          {/* Description */}
          {product.description && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</p>
              <p className="text-sm text-gray-700 leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Media edit form */}
          {editing && (
            <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Modifier les médias</p>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Lien image</label>
                <input
                  type="url"
                  value={imageUrlDraft}
                  onChange={(e) => setImageUrlDraft(e.target.value)}
                  placeholder="https://…"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Lien vidéo</label>
                <input
                  type="url"
                  value={videoUrlDraft}
                  onChange={(e) => setVideoUrlDraft(e.target.value)}
                  placeholder="YouTube, Vimeo ou lien direct…"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-gray-400 mt-1">YouTube, Vimeo, ou fichier .mp4 — laissez vide pour supprimer</p>
              </div>
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={handleCancelEdit} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-brand-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Enregistrer
                </button>
              </div>
            </div>
          )}

          {/* Video */}
          {product.videoUrl && !editing && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vidéo</p>
              {embedUrl ? (
                <div className="space-y-2">
                  <div className="rounded-xl overflow-hidden aspect-video">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <a
                    href={product.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600"
                  >
                    <ExternalLink size={12} /> Ouvrir dans un nouvel onglet
                  </a>
                </div>
              ) : directVideo ? (
                <video
                  src={product.videoUrl}
                  controls
                  className="w-full rounded-xl"
                  style={{ maxHeight: 240 }}
                />
              ) : (
                <a
                  href={product.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-800"
                >
                  <Play size={14} /> Voir la vidéo ↗
                </a>
              )}
            </div>
          )}

          {/* Product page link */}
          {product.productUrl && (
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-brand-600 font-medium hover:underline"
            >
              <ExternalLink size={14} /> Page produit ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
