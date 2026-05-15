
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugQuery() {
    // 1. Ambil satu kambing terjual
    const { data: goats } = await supabase.from('stok_kambing').select('id, no_tali').eq('status_transaksi', 'Terjual').limit(1);
    if (!goats || goats.length === 0) {
        console.log('No terjual goats found');
        return;
    }
    const goatId = goats[0].id;
    console.log('Searching for goatId:', goatId);

    // 2. Cari transaksi yang mengandung goatId tersebut
    const { data: trx, error } = await supabase.from('transaksi')
        .select('*')
        .contains('items', [{ goatId: goatId }]);
    
    if (error) {
        console.error('Query Error:', error);
    } else {
        console.log('Found Trx:', trx.length);
        if (trx.length > 0) {
            console.log('Sample Trx ID:', trx[0].id);
        }
    }
}

debugQuery();
