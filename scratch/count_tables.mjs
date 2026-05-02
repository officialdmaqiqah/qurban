import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    // Supabase doesn't have a direct way to list tables via JS client without RPC or querying system tables
    // But we can try to guess or use a common one
    const tables = ['profiles', 'master_data', 'transaksi', 'keuangan', 'stok_kambing', 'edit_requests'];
    for (const t of tables) {
        const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
        if (error) console.log(`Table ${t}: Error ${error.message}`);
        else console.log(`Table ${t}: ${count} rows`);
    }
}

listTables();
