import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRawData() {
    console.log('--- CEK RAW DATA KEUANGAN (ADJ-788074-32) ---');
    const { data: fin } = await supabase
        .from('keuangan')
        .select('*')
        .eq('id', 'ADJ-788074-32')
        .single();
    
    if (fin) {
        console.log('ID:', fin.id);
        console.log('Keterangan:', fin.keterangan);
        console.log('Nominal (Raw):', fin.nominal, typeof fin.nominal);
        console.log('Parsed Nominal:', parseFloat(fin.nominal));
        console.log('Cleaned Nominal:', parseFloat(String(fin.nominal).replace(/\./g, '')));
    } else {
        console.log('Data ADJ-788074-32 tidak ditemukan!');
    }

    console.log('\n--- CEK TRANSAKSI TRX00030 ---');
    const { data: trx } = await supabase
        .from('transaksi')
        .select('*')
        .eq('id', 'TRX00030')
        .single();
    
    if (trx) {
        console.log('ID:', trx.id);
        console.log('Total Deal:', trx.total_deal, typeof trx.total_deal);
        console.log('Total Paid:', trx.total_paid, typeof trx.total_paid);
        console.log('History Bayar:', JSON.stringify(trx.history_bayar, null, 2));
    }
}

checkRawData();
