
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function searchFuzzy() {
    console.log('Searching for ID like %19% in transaksi...');
    const { data, error } = await supabase.from('transaksi').select('id, agen, customer').ilike('id', '%19%');
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log('Found:', data.length);
    data.forEach(d => console.log(JSON.stringify(d)));
}

searchFuzzy();
