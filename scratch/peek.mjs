
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function peek() {
    console.log('Peeking at transaksi table...');
    const { data, error } = await supabase.from('transaksi').select('id, tgl_trx').limit(5);
    if (error) console.error(error);
    else console.log('Sample IDs:', data.map(d => d.id));
}

peek();
