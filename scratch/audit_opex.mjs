import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditOpex() {
    const startSeason = new Date('2026-01-01T00:00:00');
    const endSeason = new Date('2026-12-31T23:59:59');

    const { data: fin, error } = await supabase.from('keuangan').select('*');
    if (error) { console.error(error); return; }

    console.log('| Tanggal | Kategori | Nominal | Keterangan |');
    console.log('|---|-|---|---|');

    let totalOpex = 0;
    const items = [];

    fin.forEach(f => {
        const dt = new Date(f.tanggal);
        if (dt < startSeason || dt > endSeason) return;

        const katLine = (f.kategori || '').toLowerCase().trim();
        const nom = parseFloat(f.nominal) || 0;
        const channel = (f.channel || '').toLowerCase();

        // Check if it's OPEX based on dashboard.js logic
        if (f.tipe === 'pengeluaran' && !channel.includes('non-kas')) {
            const isPurchasing = katLine.includes('bayar supplier') || katLine.includes('pelunasan supplier') || katLine.includes('beli kambing');
            
            if (!isPurchasing) {
                totalOpex += nom;
                items.push({
                    tgl: f.tanggal,
                    kat: f.kategori,
                    nom: nom,
                    ket: f.keterangan || '-'
                });
            }
        }
    });

    items.sort((a,b) => new Date(a.tgl) - new Date(b.tgl));
    items.forEach(i => {
        console.log(`| ${i.tgl} | ${i.kat} | ${i.nom.toLocaleString('id-ID')} | ${i.ket} |`);
    });

    console.log(`\n**TOTAL BIAYA OPERASIONAL: Rp ${totalOpex.toLocaleString('id-ID')}**`);
}

auditOpex();
