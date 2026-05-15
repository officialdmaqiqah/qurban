import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function globalSearch() {
    const searchStr = 'TRX00030';
    const tables = ['transaksi', 'keuangan', 'profiles', 'master_data'];
    
    console.log(`=== SEARCHING FOR '${searchStr}' ACROSS TABLES ===`);
    
    for (const table of tables) {
        console.log(`Checking table: ${table}...`);
        
        // Cek apakah kolom ID mengandung kata itu
        const { data: d1 } = await supabase.from(table).select('id').ilike('id', `%${searchStr}%`);
        if (d1?.length > 0) console.log(`  [MATCH] Found in ID column of ${table}!`);

        // Cek apakah ada kolom 'keterangan' atau 'val'
        const { data: d2 } = await supabase.from(table).select('*').limit(1);
        if (d2?.[0]) {
            const cols = Object.keys(d2[0]);
            for (const col of cols) {
                if (typeof d2[0][col] === 'string') {
                    const { data: d3 } = await supabase.from(table).select(col).ilike(col, `%${searchStr}%`);
                    if (d3?.length > 0) console.log(`  [MATCH] Found in column '${col}' of ${table}!`);
                }
            }
        }
    }
}

globalSearch();
