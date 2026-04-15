const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    try {
        console.log('Memulai migrasi kategori...');
        
        // 1. Fetch current data
        const { data: rows, error: fetchErr } = await supabase.from('keuangan').select('kategori, tipe');
        if (fetchErr) throw fetchErr;
        
        if (!rows || rows.length === 0) {
            console.log('Tidak ada data keuangan di database.');
        }

        // 2. Collect unique values from existing records
        const uniqueIn = rows ? [...new Set(rows.filter(x => x.tipe === 'pemasukan').map(x => x.kategori))].filter(Boolean) : [];
        const uniqueOut = rows ? [...new Set(rows.filter(x => x.tipe === 'pengeluaran').map(x => x.kategori))].filter(Boolean) : [];

        // 3. Official Default lists
        const defIn = ['Modal Awal','Terima Pelunasan','Penjualan Sapi','Jual Kambing','Kompensasi Supplier','Penerimaan Lainnya'];
        const defOut = ['Beli Kambing','Beban Pakan','Beban Operasional Kandang','Gaji & Bonus','Listrik & Air','Transportasi','Marketing / Iklan','Bayar Supplier','Pelunasan Supplier','Bagi Hasil (Investor)','Prive / Tarik Tunai','Biaya Lain-lain','Kerugian (Mati/Hilang)'];

        // 4. Merge (Remove "Lainnya (Tulis Sendiri)" if it exists in data to avoid duplicates with the system option)
        const finalIn = [...new Set([...defIn, ...uniqueIn])].filter(x => x !== 'Lainnya (Tulis Sendiri)');
        const finalOut = [...new Set([...defOut, ...uniqueOut])].filter(x => x !== 'Lainnya (Tulis Sendiri)');

        // 5. Save to master_data
        const { error: upsertErr } = await supabase.from('master_data').upsert([
            { id: 'ID-KAT-KEU-IN', key: 'KAT_KEU_IN', val: finalIn },
            { id: 'ID-KAT-KEU-OUT', key: 'KAT_KEU_OUT', val: finalOut }
        ], { onConflict: 'key' });

        if (upsertErr) throw upsertErr;

        console.log('Migrasi Kategori Berhasil!');
        console.log('Pemasukan:', finalIn);
        console.log('Pengeluaran:', finalOut);
    } catch (e) {
        console.error('Migration Failed:', e);
    }
}

migrate();
