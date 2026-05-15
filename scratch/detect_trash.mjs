import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function detectTrash() {
    console.log("=== DETECTING HIDDEN CHARACTERS IN IDS ===");
    
    // Ambil 50 data terakhir dari tabel transaksi (hanya kolom ID)
    const { data, error } = await supabase.from('transaksi').select('id').order('created_at', { ascending: false }).limit(50);
    
    if (data) {
        console.log("Last 50 IDs (with quotes to see spaces):");
        data.forEach(t => {
            console.log(`- "${t.id}"`);
        });
        
        // Cari yang mengandung TRX00030 secara manual di memori
        const target = 'TRX00030';
        const matches = data.filter(t => String(t.id).includes(target));
        if (matches.length > 0) {
            console.log(`\n[MATCH FOUND!] Data for ${target} exists as:`);
            matches.forEach(m => console.log(`=> "${m.id}"`));
        } else {
            console.log(`\n[NOT FOUND] ${target} is not in the last 50 records.`);
        }
    } else {
        console.log("Error or no data:", error);
    }
}

detectTrash();
