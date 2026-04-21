
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAndFixPayments() {
    const payIds = ['PAY-368651', 'PAY-1776765549944', 'PAY-196576'];
    const trxId = 'TRX00001';

    console.log(`Checking payments: ${payIds.join(', ')}...`);
    
    // 1. Fetch the payments from Keuangan
    const { data: fins, error: fErr } = await supabase.from('keuangan').select('*').in('id', payIds);
    if (fErr) return console.error('Error fetching Keuangan:', fErr);
    
    console.log(`Found ${fins.length} records in Keuangan.`);
    fins.forEach(f => {
        console.log(`- ID: ${f.id} | Nominal: ${f.nominal} | Related: ${f.related_trx_id} | Tgl: ${f.tanggal}`);
    });

    // 2. Fetch TRX00001
    const { data: trx, error: tErr } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
    if (tErr) return console.error('Error fetching TRX:', tErr);
    
    console.log(`TRX00001 Current Total Paid: ${trx.total_paid}`);
    console.log(`Current History:`, JSON.stringify(trx.history_bayar, null, 2));

    // Note: Since I'm using publishable key, this script might fail if RLS is on.
    // However, I will proceed to provide instructions to the user if it fails.
}

checkAndFixPayments();
