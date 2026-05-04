import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || ''; 

if (!supabaseKey) {
    console.error('SUPABASE_SERVICE_ROLE is required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdjustments() {
    const ids = ['ADJ-050988-03', 'ADJ-077913-12', 'ADJ-091230-24'];
    const { data, error } = await supabase.from('keuangan').select('*').in('id', ids);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log('--- Keuangan Records ---');
    data.forEach(f => {
        console.log(`ID: ${f.id} | Kategori: "${f.kategori}" | Tipe: ${f.tipe} | Nominal: ${f.nominal}`);
    });

    // Also check the transaction state
    const { data: trx } = await supabase.from('transaksi').select('*').eq('id', 'TRX00023').single();
    console.log('\n--- Transaction TRX00023 ---');
    console.log(`Total Deal: ${trx.total_deal}`);
    console.log(`Total Paid: ${trx.total_paid}`);
    console.log(`History Bayar Count: ${trx.history_bayar?.length}`);
    trx.history_bayar?.forEach(h => {
        if (h.id.startsWith('ADJ')) {
            console.log(`Hist Item ID: ${h.id} | Nom: ${h.nominal} | Cat: "${h.category}"`);
        }
    });
}

checkAdjustments();
