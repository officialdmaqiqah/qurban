
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ'; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
    console.log('--- Searching for Aziz in Keuangan ---');

    const { data: matchedKeu, error: errorKeu } = await supabase.from('keuangan')
        .select('*')
        .ilike('keterangan', '%Aziz%');
    
    if (errorKeu) {
        console.error('Error Keuangan:', errorKeu.message);
    } else {
        console.log('Matched Keuangan Records:', matchedKeu);
        const trxIds = [...new Set(matchedKeu.map(k => k.related_trx_id).filter(id => !!id))];
        console.log('Related Transaction IDs:', trxIds);

        if (trxIds.length > 0) {
            console.log('Attempting to fetch Transactions:', trxIds);
            const { data: trxs, error: errorTrx } = await supabase.from('transaksi')
                .select('*')
                .in('id', trxIds);
            
            if (errorTrx) console.error('Error Transaksi:', errorTrx.message);
            else {
                console.log('Found Transactions:', JSON.stringify(trxs, null, 2));
                
                for (const trx of trxs) {
                    const history = trx.history_bayar || [];
                    const newTotalPaid = history.reduce((sum, h) => sum + (parseFloat(h.nominal) || 0), 0);
                    const newTotalOverpaid = Math.max(0, newTotalPaid - (trx.total_deal || 0));

                    if (newTotalPaid !== trx.total_paid || newTotalOverpaid !== trx.total_overpaid) {
                        console.log(`Repairing ${trx.id}...`);
                        await supabase.from('transaksi').update({
                            total_paid: newTotalPaid,
                            total_overpaid: newTotalOverpaid,
                            updated_at: new Date().toISOString()
                        }).eq('id', trx.id);
                    } else {
                        console.log(`${trx.id} is already synchronized.`);
                    }
                }
            }
        }
    }
}

search();
