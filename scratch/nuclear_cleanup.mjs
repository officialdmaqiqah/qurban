import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function nuclearCleanup() {
    const ids = ['TRX00030', 'TRX00031', 'TRX00023'];
    console.log("=== NUCLEAR CLEANUP STARTING ===");
    
    for (const id of ids) {
        console.log(`\nCleaning ${id}...`);
        
        // 1. Ambil SEMUA baris untuk ID ini (menyebutkan kolom agar tidak terblokir RLS)
        const { data, error } = await supabase.from('transaksi').select('id, total_deal, total_paid').eq('id', id);
        
        if (error) {
            console.error(`Error fetching ${id}:`, error.message);
            continue;
        }

        if (!data || data.length === 0) {
            console.log(`${id} not found.`);
            continue;
        }

        console.log(`Found ${data.length} rows for ${id}. Force-fixing ALL of them to LUNAS...`);

        // 2. Update SEMUA baris tersebut agar total_paid = total_deal
        for (const row of data) {
            const { error: upErr } = await supabase.from('transaksi').update({
                total_paid: row.total_deal,
                total_overpaid: 0,
                updated_at: new Date().toISOString()
            }).eq('id', id); // Kita pakai eq('id', id) agar semua yang kembar kena update sekaligus

            if (upErr) console.error(`  Failed to update a row of ${id}:`, upErr.message);
            else console.log(`  Row updated successfully.`);
        }
    }
    console.log("\n=== NUCLEAR CLEANUP FINISHED ===");
}

nuclearCleanup();
