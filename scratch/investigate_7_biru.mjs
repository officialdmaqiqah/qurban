import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
    const { data: goats, error: gErr } = await supabase
        .from('stok_kambing')
        .select('*')
        .eq('no_tali', '7')
        .ilike('warna_tali', 'biru');

    if (gErr) {
        console.error('Error fetching goat:', gErr);
        return;
    }

    if (!goats || goats.length === 0) {
        console.log('Goat 7 Biru not found.');
        return;
    }

    const goat = goats[0];
    console.log('Goat Data:', JSON.stringify(goat, null, 2));

    if (goat.transaction_id) {
        const { data: trx, error: tErr } = await supabase
            .from('transaksi')
            .select('*')
            .eq('id', goat.transaction_id)
            .single();

        if (tErr) {
            console.error('Error fetching transaction:', tErr);
        } else {
            console.log('Transaction Data:', JSON.stringify(trx, null, 2));
            
            const itemIndex = trx.items.findIndex(i => i.goatId === goat.id);
            const itemInTrx = trx.items[itemIndex];
            
            const hDeal = parseFloat(itemInTrx.hargaDeal) || 0;
            const hNota = parseFloat(goat.harga_nota) || 0;
            const hSaving = parseFloat(goat.saving) || 0;
            const komisiVal = (trx.komisi && trx.komisi.berhak) ? parseFloat(trx.komisi.nominal) : 0;
            const komisiRow = itemIndex === 0 ? komisiVal : 0;
            
            const profitNet = hDeal - hNota - hSaving - komisiRow;
            
            console.log('\nCalculation for Profit Net / Ekor:');
            console.log(`hDeal (Harga di Trx): ${hDeal}`);
            console.log(`hNota (Harga Beli): ${hNota}`);
            console.log(`hSaving (Dana Saving): ${hSaving}`);
            console.log(`komisiRow (Komisi di baris ini): ${komisiRow} (Total Komisi Trx: ${komisiVal}, Item Index: ${itemIndex})`);
            console.log(`Formula: hDeal - hNota - hSaving - komisiRow`);
            console.log(`Result: ${hDeal} - ${hNota} - ${hSaving} - ${komisiRow} = ${profitNet}`);
        }
    } else {
        console.log('Goat is not sold yet.');
    }
}

investigate();
