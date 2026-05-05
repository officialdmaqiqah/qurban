import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

async function trackOpex() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all pengeluaran for that channel
    const { data, error } = await supabase
        .from('keuangan')
        .select('*')
        .eq('tipe', 'pengeluaran')
        .ilike('channel', '%Mandiri%1690004605256%');

    if (error) {
        console.error("Error:", error);
        return;
    }

    const filtered = data.filter(f => {
        const kl = (f.kategori || '').toLowerCase();
        const isEx = kl.includes('bayar supplier') || kl.includes('pelunasan supplier') || kl.includes('komisi') || 
                     kl.includes('bagi hasil') || kl.includes('mutasi') || kl.includes('titipan') || kl.includes('beli kambing') ||
                     kl.includes('pengembalian dana') || kl.includes('refund') || kl.includes('penarikan') || kl.includes('modal') || kl.includes('prive') || kl.includes('investasi');
        return !isEx;
    });

    console.log("=== Opex Transactions for Mandiri 1690004605256 ===");
    filtered.forEach(f => {
        console.log(`[${f.id}] ${f.tanggal} - ${f.kategori}: Rp ${f.nominal.toLocaleString('id-ID')} (${f.keterangan || '-'})`);
    });

    const total = filtered.reduce((s, f) => s + f.nominal, 0);
    console.log(`\nTOTAL: Rp ${total.toLocaleString('id-ID')}`);
}

trackOpex();
