import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function findThem() {
    console.log("=== SEARCHING FOR THE MYSTERIOUS IDS ===");
    
    // Cari semua transaksi yang ID-nya mirip
    const { data, error } = await supabase.from('transaksi').select('id, customer:profiles(nama), total_deal, total_paid').ilike('id', '%TRX000%');
    
    if (error) {
        console.error("Search Error:", error);
    } else {
        console.log(`Found ${data.length} transactions containing 'TRX000'.`);
        data.forEach(t => {
            console.log(`ID: [${t.id}] | Name: ${t.customer?.nama} | Deal: ${t.total_deal} | Paid: ${t.total_paid}`);
        });
    }
}

findThem();
