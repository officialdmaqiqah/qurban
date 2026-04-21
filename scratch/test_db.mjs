
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const { count, error } = await supabase.from('transaksi').select('*', { count: 'exact', head: true });
    if (error) console.error(error);
    else console.log('Total transactions:', count);
}

test();
