import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function peek() {
    // Ambil 1 baris saja tapi semua kolom
    const { data, error } = await supabase.from('transaksi').select('*').limit(1);
    if (data && data.length > 0) {
        console.log("=== COLUMN NAMES IN 'transaksi' ===");
        console.log(Object.keys(data[0]));
        console.log("\nSample Row Data:");
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log("No data found in 'transaksi' or error:", error);
    }
}
peek();
