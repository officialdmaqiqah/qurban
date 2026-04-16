import fs from 'fs';
import path from 'path';

const files = [
  'tes_laporan.html', 'terima_pelunasan.html', 'stok_opname.html',
  'pengaturan.html', 'laporan.html', 'keuangan.html', 'komisi.html',
  'kesehatan.html', 'kambing_terjual.html', 'kambing_masuk.html',
  'kambing.html', 'hutang_supplier.html', 'distribusi.html',
  'deposit_agen.html', 'dashboard.html', 'cek_laporan.html'
];

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Force bust cache version on layout.js
  content = content.replace(/src="src\/layout\.js(\?v=[0-9.]+)?"/g, 'src="src/layout.js?v=4.0"');

  // 2. Remove the ID so cached layout.js cannot find it, and natively set the logo text
  content = content.replace(/<div class="sidebar-header" id="sidebarHeaderWrapper">[\s\S]*?<\/div>/g, 
    `<div class="sidebar-header">
    <div class="sidebar-logo">
        <span style="font-weight: 600;">Daarul Mahabbah Qurban</span>
    </div>
</div>`);

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Processed:', file);
}
