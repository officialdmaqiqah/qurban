import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("--- CHECKING TRANSAKSI COUNT ---");
    const { count, error } = await supabase
        .from('transaksi')
        .select('*', { count: 'exact', head: true });
    
    if (error) console.error(error);
    else console.log("Total Transactions:", count);

    console.log("\n--- SEARCHING ALL TRANSACTIONS FOR 'YOYOK' (Paginated) ---");
    // We'll try to find any row where 'agen' contains 'yoyok'
    // Since we can't easily use ilike on jsonb root in a simple way without knowing the operator support,
    // we'll fetch in batches or use a more clever query.
    
    const { data, error: e2 } = await supabase
        .from('transaksi')
        .select('id, agen')
        .ilike('agen->>nama', '%yoyok%');
    
    if (e2) {
        console.log("Error searching with ->> operator:", e2.message);
        // Fallback: try search in the whole record if it was a string before
        const { data: d3, error: e3 } = await supabase
            .from('transaksi')
            .select('id, agen')
            .ilike('agen', '%yoyok%');
        if (e3) console.log("Error 3:", e3.message);
        else console.log(`Found ${d3?.length || 0} rows with 'yoyok' as string`);
    } else {
        console.log(`Found ${data?.length || 0} rows matching 'yoyok' in agen->>nama`);
        if (data && data.length > 0) console.log(JSON.stringify(data[0]));
    }
}

check();
