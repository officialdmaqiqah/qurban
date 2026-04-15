import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOpexBreakdown() {
    const start = new Date('2026-01-01T00:00:00');
    const end = new Date('2026-12-31T23:59:59');

    const { data: fin, error } = await supabase.from('keuangan').select('*');
    if (error) { console.error(error); return; }

    let totalOpex = 0;
    const opexList = [];

    fin.forEach(f => {
        const dt = new Date(f.tanggal);
        if (dt < start || dt > end) return;

        const nom = parseFloat(f.nominal || 0);
        if (f.tipe === 'pengeluaran') {
            // Logic from laporan.js:353 (Analytics) or 132 (Summary)
            // Laporan.js 132: kategori !== 'Bayar Supplier' && kategori !== 'Pelunasan Supplier' && kategori !== 'Kerugian (Mati/Hilang)'
            if (f.kategori !== 'Bayar Supplier' && f.kategori !== 'Pelunasan Supplier' && f.kategori !== 'Kerugian (Mati/Hilang)') {
                totalOpex += nom;
                opexList.push({
                    tgl: f.tanggal,
                    kat: f.kategori,
                    nom: nom,
                    ket: f.keterangan || '-'
                });
            }
        }
    });

    console.log('--- DATA BIAYA OPERASIONAL 2026 ---');
    opexList.sort((a,b) => new Date(a.tgl) - new Date(b.tgl));
    opexList.forEach(i => {
        console.log(`[${i.tgl}] ${i.kat}: Rp ${i.nom.toLocaleString('id-ID')} (${i.ket})`);
    });
    console.log('------------------------------------');
    console.log('TOTAL OPEX: Rp ' + totalOpex.toLocaleString('id-ID'));
}

checkOpexBreakdown();
