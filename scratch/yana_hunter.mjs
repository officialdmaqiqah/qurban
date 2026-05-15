import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findYana() {
    console.log("🔍 BERBURU DATA YANA...");
    
    // 1. Cari di tabel transaksi
    const { data: trxs } = await supabase.from('transaksi').select('*');
    const yanaTrxs = (trxs || []).filter(t => (t.customer?.nama || '').toLowerCase().includes('yana'));
    
    if (yanaTrxs.length === 0) {
        console.log("❌ Tidak ada transaksi atas nama Yana.");
        return;
    }

    yanaTrxs.forEach(t => {
        console.log(`\n[TRX] ID: ${t.id} | Nama: ${t.customer?.nama} | Deal: ${t.total_deal} | Paid: ${t.total_paid} | Overpaid: ${t.total_overpaid}`);
    });

    // 2. Cari di tabel keuangan
    const { data: fins } = await supabase.from('keuangan').select('*');
    const yanaFins = (fins || []).filter(f => 
        (f.keterangan || '').toLowerCase().includes('yana') || 
        (f.agen_name || '').toLowerCase().includes('yana')
    );

    console.log(`\n🔍 DITEMUKAN ${yanaFins.length} CATATAN KEUANGAN DENGAN KATA 'YANA':`);
    yanaFins.forEach(f => {
        console.log(`  - [${f.tanggal}] ${f.kategori}: ${f.nominal} (${f.tipe}) | Ket: ${f.keterangan} | RelatedID: ${f.related_trx_id}`);
    });
}
findYana();
