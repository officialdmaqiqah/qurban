import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    const ids = ['TRX00031', 'TRX00030', 'TRX00023'];
    
    console.log('--- PENGECEKAN TRANSAKSI ---');
    const { data: trxs, error: trxErr } = await supabase
        .from('transaksi')
        .select('id, total_deal, total_paid, total_overpaid, is_pelunasan, history_bayar')
        .in('id', ids);
    
    if (trxErr) console.error('Error fetching trxs:', trxErr);
    else console.table(trxs);

    console.log('\n--- PENGECEKAN CATATAN KEUANGAN ---');
    const { data: fins, error: finErr } = await supabase
        .from('keuangan')
        .select('id, keterangan, nominal, tipe, kategori, related_trx_id')
        .order('created_at', { ascending: false })
        .limit(20);
    
    if (finErr) console.error('Error fetching fins:', finErr);
    else console.table(fins);

    // Cari spesifik ADJ-788074-32
    console.log('\n--- PENGECEKAN SPESIFIK ADJ-788074-32 ---');
    const { data: specific } = await supabase
        .from('keuangan')
        .select('*')
        .eq('id', 'ADJ-788074-32');
    console.table(specific);
}

debug();
