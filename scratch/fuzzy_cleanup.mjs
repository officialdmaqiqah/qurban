import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function fuzzyCleanup() {
    const ids = ['TRX00030', 'TRX00031', 'TRX00023'];
    console.log("=== FUZZY CLEANUP STARTING ===");
    
    for (const id of ids) {
        console.log(`\nSearching for something like [${id}]...`);
        
        // Pakai ILIKE untuk mencari yang mirip (termasuk yang ada spasinya)
        const { data, error } = await supabase.from('transaksi').select('id, total_deal, total_paid').ilike('id', `%${id}%`);
        
        if (error) {
            console.error(`  Error: ${error.message}`);
            continue;
        }

        if (!data || data.length === 0) {
            console.log(`  No rows found even with fuzzy search.`);
            continue;
        }

        console.log(`  Found ${data.length} rows!`);
        for (const row of data) {
            console.log(`  Actual ID in DB: [${row.id}]`);
            const { error: upErr } = await supabase.from('transaksi').update({
                total_paid: row.total_deal,
                total_overpaid: 0,
                updated_at: new Date().toISOString()
            }).eq('id', row.id); // Pakai ID asli yang ditemukan dari DB

            if (upErr) console.error(`    Update failed for [${row.id}]:`, upErr.message);
            else console.log(`    SUCCESS: [${row.id}] updated to LUNAS.`);
        }
    }
    console.log("\n=== FUZZY CLEANUP FINISHED ===");
}

fuzzyCleanup();
