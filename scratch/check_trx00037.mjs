import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: trx } = await supabase.from('transaksi').select('*').eq('id', 'TRX00037').single();
    const { data: fins } = await supabase.from('keuangan').select('*').eq('related_trx_id', 'TRX00037');

    console.log("TRX:", JSON.stringify({
        id: trx?.id,
        total_deal: trx?.total_deal,
        total_paid: trx?.total_paid,
        total_overpaid: trx?.total_overpaid,
        history_bayar: trx?.history_bayar
    }, null, 2));

    console.log("KEUANGAN:", JSON.stringify(fins, null, 2));
}

check();
