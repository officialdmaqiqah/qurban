
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugTrxSearch() {
    // 1. Get a sample goat from a trip
    const { data: md } = await supabase.from('master_data').select('val').eq('key', 'TRIPS').single();
    const trips = md?.val || [];
    if (trips.length === 0) return console.log('No trips found');

    const sampleGoatId = trips[0].items[0].goatId;
    console.log('Searching for GoatID:', sampleGoatId, 'Type:', typeof sampleGoatId);

    // 2. Try direct match in transaksi
    const { data: trxAll } = await supabase.from('transaksi').select('id, items').limit(5);
    console.log('Sample Transaksi Items Structure:');
    if (trxAll && trxAll.length > 0) {
        console.log(JSON.stringify(trxAll[0].items, null, 2));
    }

    // 3. Try searching with contains
    const { data: trxFound, error: err } = await supabase.from('transaksi')
        .select('id')
        .contains('items', [{ goatId: sampleGoatId }])
        .maybeSingle();

    if (err) console.error('Query Error:', err);
    console.log('Found with contains:', trxFound ? trxFound.id : 'NOT FOUND');

    // 4. Try searching with ilike or text search if it's a JSON column
    // (Note: Supabase contains is usually the way for JSONB)
}

debugTrxSearch();
