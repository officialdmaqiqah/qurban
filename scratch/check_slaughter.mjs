import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Master Data ---');
    const { data: md } = await supabase.from('master_data').select('*');
    console.log('MD Keys:', md.map(m => m.key));
    
    const tripsRow = md.find(m => m.key === 'TRIPS');
    if (tripsRow) {
        const trips = tripsRow.val || [];
        console.log('Total Trips in TRIPS key:', trips.length);
        const smb = trips.filter(t => t.id.startsWith('SMB-'));
        console.log('Slaughter Trips:', JSON.stringify(smb, null, 2));
    } else {
        console.log('TRIPS key not found in master_data');
    }

    console.log('--- Stok Kambing (Disembelih) ---');
    const { data: goats } = await supabase.from('stok_kambing').select('id, no_tali, status_transaksi, status_fisik').eq('status_fisik', 'Disembelih');
    console.log('Goats with status_fisik=Disembelih:', goats);
}

checkData();
