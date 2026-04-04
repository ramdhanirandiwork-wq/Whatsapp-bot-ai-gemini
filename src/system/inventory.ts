// ==========================================
// 🔥 SYSTEM: STOCK OPNAME TERMINAL LAMA
// ==========================================

export function generateReport(text: string): string {
  const lower = text.toLowerCase();

  const isValid =
    lower.includes("chili") ||
    lower.includes("parsley") ||
    lower.includes("kompan");

  if (!isValid) {
    return `
\`\`\`
STOCK LAPORAN KAYAME FOOD
Silakan input Laporan Hari ini:
\`\`\`
`;
  }

  let chili = lower.includes("chili") ? 0.2 : 0;
  let parsley = lower.includes("parsley") ? 0 : 0;
  let kompan = lower.includes("kompan") ? 0.3 : 0;

  const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const tanggal = `📅 ${hari[d.getDay()]}, ${d.toLocaleDateString("id-ID")}`;

  let list: string[] = [];

  list.push("1. [ ] Dimsum: 600 Pcs");
  list.push("2. [ ] Saus Botol 🧴: 4 Botol");
  list.push("3. [ ] Bolognes 🍅: 2 Kantong");
  list.push("4. [ ] Tar-tar 🥣: 1 Kantong");

  let kompanNeed = (kompan < 0.5) ? "1 Kompan" : "";
  list.push(`5. [ ] Saus Kompan 🛢️: ${kompanNeed}`);
  list.push("");

  let no = 6;

  if (chili < 0.5) {
    list.push(`${no++}. [ ] Chili Oil: ${0.5 - chili} Pack`);
  }

  if (parsley < 1) {
    list.push(`${no++}. [ ] Parsley: ${1 - parsley} Pack`);
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
