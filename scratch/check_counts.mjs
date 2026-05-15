
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    console.log('Checking table counts...');
    const tables = ['transaksi', 'keuangan', 'stok_kambing', 'master_data'];
    for (const table of tables) {
        const { data, error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) console.error(`Error for ${table}:`, error.message);
        else console.log(`${table}: ${count} rows`);
    }
}

checkCounts();
