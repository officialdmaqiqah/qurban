import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
    console.log("Checking connection to:", supabaseUrl);
    
    const { data: fin, error: finError } = await supabase.from('keuangan').select('*');
    if (finError) {
        console.error("Error fetching keuangan:", finError);
    } else {
        console.log("Fetched keuangan rows:", fin?.length || 0);
    }

    const { data: goats, error: goatError } = await supabase.from('stok_kambing').select('id').limit(5);
    if (goatError) {
        console.error("Error fetching stok_kambing:", goatError);
    } else {
        console.log("Fetched stok_kambing sample rows:", goats?.length || 0);
    }

    if (!fin || fin.length === 0) {
        console.log("No financial data found. Check permissions or table names.");
        return;
    }

    // ... (rest of the analysis logic)
}

analyze();
