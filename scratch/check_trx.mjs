
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkFins() {
    const trxIds = process.argv.slice(2);
    if (trxIds.length === 0) {
        console.error("Please provide TRX IDs as arguments.");
        process.exit(1);
    }

    for (const trxId of trxIds) {
        const { data: fin } = await supabase.from('keuangan').select('*').or(`related_trx_id.eq.${trxId},keterangan.ilike.%${trxId}%`);
        console.log(`Keuangan for ${trxId}:`, fin);

        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
        console.log(`Transaksi ${trxId}:`, trx);
        console.log('-------------------');
    }
}

checkFins();
