
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ'; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
    console.log('--- Searching for TRX00019 variants ---');

    const { data, error } = await supabase.from('transaksi').select('id, customer, total_paid, total_overpaid, total_deal, history_bayar').ilike('id', '%TRX00019%');
    
    if (error) {
        console.error('Error searching:', error.message);
        return;
    }

    if (data.length === 0) {
        console.log('No records found with ID containing TRX00019.');
        // List last 10 transactions to see naming convention
        const { data: lastTrxs } = await supabase.from('transaksi').select('id, tgl_trx').order('tgl_trx', { ascending: false }).limit(10);
        console.log('Last 10 transactions:', lastTrxs);
    } else {
        console.log('Found records:', JSON.stringify(data, null, 2));
        
        // Repair the first one found
        const trx = data[0];
        const history = trx.history_bayar || [];
        const newTotalPaid = history.reduce((sum, h) => sum + (parseFloat(h.nominal) || 0), 0);
        const newTotalOverpaid = Math.max(0, newTotalPaid - (trx.total_deal || 0));

        console.log('Repairing...', { id: trx.id, newTotalPaid, newTotalOverpaid });
        const { error: updateError } = await supabase.from('transaksi').update({
            total_paid: newTotalPaid,
            total_overpaid: newTotalOverpaid,
            updated_at: new Date().toISOString()
        }).eq('id', trx.id);
        
        if (updateError) console.error('Repair failed:', updateError.message);
        else console.log('Repair successful!');
    }
}

search();
