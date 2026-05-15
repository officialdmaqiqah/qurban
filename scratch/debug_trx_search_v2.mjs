
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugTrxSearch() {
    // 1. Get a goat that is distributed
    const { data: goats } = await supabase.from('stok_kambing')
        .select('id, no_tali')
        .eq('status_transaksi', 'Terdistribusi')
        .limit(1);
    
    if (!goats || goats.length === 0) return console.log('No distributed goats found in DB');

    const sampleGoatId = goats[0].id;
    console.log('Searching for GoatID:', sampleGoatId, '(', goats[0].no_tali, ')');

    // 2. Sample transaction
    const { data: trxAll } = await supabase.from('transaksi').select('id, items').limit(1);
    if (trxAll && trxAll.length > 0) {
        console.log('Sample Items from Trx:', trxAll[0].id);
        console.log(JSON.stringify(trxAll[0].items[0], null, 2));
    }

    // 3. Search for the specific goat
    const { data: trxFound, error: err } = await supabase.from('transaksi')
        .select('id, items')
        .contains('items', [{ goatId: sampleGoatId }])
        .maybeSingle();

    if (err) console.error('Query Error:', err);
    if (trxFound) {
        console.log('Found with contains:', trxFound.id);
    } else {
        console.log('NOT FOUND with contains. Trying manual scan...');
        const { data: allTrx } = await supabase.from('transaksi').select('id, items').limit(100);
        const match = allTrx.find(t => t.items && t.items.some(i => i.goatId === sampleGoatId));
        if (match) {
            console.log('Manual scan found it in:', match.id);
            const item = match.items.find(i => i.goatId === sampleGoatId);
            console.log('Actual Item Object:', JSON.stringify(item, null, 2));
            console.log('Key "goatId" exists?', 'goatId' in item);
            console.log('Type of goatId in DB:', typeof item.goatId);
        } else {
            console.log('Manual scan also failed to find goat in last 100 transactions.');
        }
    }
}

debugTrxSearch();
