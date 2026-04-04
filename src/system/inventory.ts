// ==========================================
// 📦 STOCK OPNAME TERMINAL LAMA
// ==========================================

export function generateReport(text: string): string {
  const lower = text.toLowerCase();

  // ❌ kalau bukan input stok
  if (!lower.match(/\d/)) {
    return `
\`\`\`
STOCK LAPORAN KAYAME FOOD
Silakan input Laporan Hari ini:
\`\`\`
`;
  }

  const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const d = new Date();
  d.setDate(d.getDate() + 1);

  const tanggal = `📅 ${hari[d.getDay()]}, ${d.toLocaleDateString("id-ID")}`;

  const chili = extract(lower, "chili");
  const parsley = extract(lower, "parsley");
  const kompan = extract(lower, "kompan");

  let list: string[] = [];

  list.push("1. [ ] Dimsum: 600 Pcs");
  list.push("2. [ ] Saus Botol 🧴: 4 Botol");
  list.push("3. [ ] Bolognes 🍅: 2 Kantong");
  list.push("4. [ ] Tar-tar 🥣: 1 Kantong");

  const kompanNeed = kompan < 0.5 ? "1 Kompan" : "";
  list.push(`5. [ ] Saus Kompan 🛢️: ${kompanNeed}`);
  list.push("");

  let no = 6;

  if (chili < 0.5) {
    list.push(`${no++}. [ ] Chili Oil: ${(0.5 - chili).toFixed(2)} Pack`);
  }

  if (parsley < 1) {
    list.push(`${no++}. [ ] Parsley: ${(1 - parsley).toFixed(2)} Pack`);
  }

  return `
\`\`\`
${tanggal}
*DAFTAR CHECKLIST YANG HARUS DI BAWA TERMINAL LAMA*
______________________________
${list.join("\n")}

*INFO STOK DI LAPAK TERMINAL LAMA*
__________________________________________
• Saus Kompan 🛢️: ${kompan}
• Chili Oil: ${chili}
• Parsley: ${parsley}
\`\`\`
`;
}

function extract(text: string, key: string): number {
  const r = new RegExp(`${key}\\s*(\\d+(\\.\\d+)?)`);
  const m = text.match(r);
  return m ? parseFloat(m[1]) : 0;
}
