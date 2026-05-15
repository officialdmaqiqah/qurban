
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTables() {
    const { data: goats, error: e1 } = await supabase.from('stok_kambing').select('*', { count: 'exact', head: true });
    const { data: trx, error: e2 } = await supabase.from('transaksi').select('*', { count: 'exact', head: true });
    const { data: md, error: e3 } = await supabase.from('master_data').select('*', { count: 'exact', head: true });

    console.log('Stok Kambing Count:', goats ? 'head only' : 'error', e1 ? e1.message : 'ok');
    console.log('Transaksi Count:', trx ? 'head only' : 'error', e2 ? e2.message : 'ok');
    console.log('Master Data Count:', md ? 'head only' : 'error', e3 ? e3.message : 'ok');
}

checkTables();
