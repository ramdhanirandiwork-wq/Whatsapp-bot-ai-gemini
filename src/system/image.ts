// ==========================================
// 🖼️ IMAGE FETCH SYSTEM (UNSPLASH)
// ==========================================

export function getImageUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://source.unsplash.com/600x400/?${q}`;
}
