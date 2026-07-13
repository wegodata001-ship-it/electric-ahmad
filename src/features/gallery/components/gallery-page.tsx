"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { galleryService } from "@/features/gallery/services/gallery.service";
import type { GalleryItem } from "@/types";
import { formatDate } from "@/utils/format";
import { motion } from "framer-motion";

export function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  useEffect(() => {
    galleryService.getAll().then(setItems);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">גלריה</h1>
        <p className="text-sm text-gray-500 mt-1">{items.length} פריטים</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.02 }}
            className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
            onClick={() => setSelected(item)}
          >
            <Image src={item.thumbnailUrl} alt={item.title} fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 right-0 left-0 p-3">
                <p className="text-sm font-medium text-white truncate">{item.title}</p>
                <p className="text-xs text-white/70">{item.projectName.split(" - ")[0]}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-video rounded-2xl overflow-hidden">
              <Image src={selected.url} alt={selected.title} fill className="object-contain" unoptimized />
            </div>
            <div className="mt-4 text-center">
              <h3 className="text-lg font-semibold text-white">{selected.title}</h3>
              <p className="text-sm text-white/70 mt-1">
                {selected.projectName} · {selected.uploadedBy} · {formatDate(selected.uploadedAt)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
