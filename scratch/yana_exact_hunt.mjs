import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findYanaExact() {
    console.log("🔍 MENCARI PEMBAYARAN YANA (PAY-1778819459130)...");
    
    // 1. Cek Catatan Keuangan Tersebut
    const { data: pay } = await supabase.from('keuangan').select('*').eq('id', 'PAY-1778819459130').single();
    if (pay) {
        console.log(`✅ KETEMU PEMBAYARAN: ${pay.nominal} | Ket: ${pay.keterangan} | Related: ${pay.related_trx_id}`);
    } else {
        console.log("❌ PAY-1778819459130 tidak ditemukan.");
    }

    // 2. Cari Transaksi dengan Deal 2.900.000
    const { data: trxs } = await supabase.from('transaksi').select('*').eq('total_deal', 2900000);
    console.log(`\n🔍 DITEMUKAN ${trxs?.length || 0} ORDER DENGAN HARGA 2.900.000:`);
    (trxs || []).forEach(t => {
        console.log(`  - ID: ${t.id} | Nama: ${t.customer?.nama} | Paid: ${t.total_paid}`);
    });
}
findYanaExact();
