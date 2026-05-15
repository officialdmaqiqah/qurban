import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function checkEverything() {
    console.log("=== CHECKING SCHEMA ===");
    
    // Check master_data keys
    const { data: md } = await supabase.from('master_data').select('key');
    console.log("Master Data Keys:", md?.map(m => m.key));

    // Check a few rows from transaksi without filter
    const { data: trxs } = await supabase.from('transaksi').select('id').limit(5);
    console.log("Sample IDs in transaksi:", trxs?.map(t => t.id));

    // Check if there is a 'temp_transaksi' or similar
    const { data: tables, error: tableErr } = await supabase.rpc('get_tables'); // If RPC exists
    if (tableErr) {
        // Fallback: try to guess common names
        const names = ['transaksi', 'keuangan', 'profiles', 'orders', 'sales', 'pembayaran'];
        for (const name of names) {
            const { error } = await supabase.from(name).select('count').limit(1);
            console.log(`Table ${name}: ${error ? 'NOT FOUND or NO ACCESS' : 'EXISTS'}`);
        }
    }
}

checkEverything();
