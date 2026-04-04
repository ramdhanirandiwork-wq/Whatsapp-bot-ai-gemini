// ==========================================
// 🖼️ IMAGE SYSTEM (ON DEMAND)
// ==========================================

export function getImageUrl(query: string): string {
  const q = encodeURIComponent(query.replace("gambarkan", ""));
  return `https://source.unsplash.com/600x400/?${q}`;
}
