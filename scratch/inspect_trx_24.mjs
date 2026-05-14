
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log("--- TRX00024 Data ---");
    const { data: trx } = await supabase.from('transaksi').select('*').eq('id', 'TRX00024').single();
    console.log(JSON.stringify(trx, null, 2));

    console.log("\n--- Keuangan Entries related to TRX00024 ---");
    const { data: fin } = await supabase.from('keuangan')
        .select('*')
        .or(`related_trx_id.eq.TRX00024,keterangan.ilike.%TRX00024%`);
    console.log(JSON.stringify(fin, null, 2));

    console.log("\n--- Deposit Entries for Marketing Bana ---");
    // Searching for 'Bana' in deposit related entries
    const { data: dep } = await supabase.from('keuangan')
        .select('*')
        .or(`kategori.eq.Titipan Dana Agen,keterangan.ilike.%Bana%`);
    console.log(JSON.stringify(dep, null, 2));
}

inspect();
