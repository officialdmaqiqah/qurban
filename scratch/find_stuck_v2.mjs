import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findStuck() {
    const { data: goats } = await supabase.from('stok_kambing').select('*');
    const { data: tripsMd } = await supabase.from('master_data').select('val').eq('key', 'TRIPS').single();
    const trips = tripsMd?.val || [];
    
    const goatIdsInTrips = new Set();
    trips.forEach(t => t.items.forEach(i => goatIdsInTrips.add(i.goatId)));
    
    const stuck = goats.filter(k => (k.status_transaksi === 'Terdistribusi' || k.status_fisik === 'Disembelih') && !goatIdsInTrips.has(k.id));
    
    console.log('Stuck Goats found:', stuck.map(k => ({ id: k.id, no_tali: k.no_tali, warna: k.warna_tali })));
}

findStuck();
