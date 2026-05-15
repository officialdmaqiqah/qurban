import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function auditGoats() {
    const ids = ['24', '32', '03', '12'];
    console.log("=== AUDITING GOATS IN DB ===");
    
    for (const noTali of ids) {
        const { data, error } = await supabase.from('stok_kambing')
            .select('no_tali, status_kesehatan, status_fisik, status_transaksi')
            .eq('no_tali', noTali);
        
        if (data && data.length > 0) {
            data.forEach(g => {
                console.log(`No Tali: ${g.no_tali}`);
                console.log(`  - Kesehatan: [${g.status_kesehatan}]`);
                console.log(`  - Fisik:     [${g.status_fisik}]`);
                console.log(`  - Transaksi: [${g.status_transaksi}]`);
            });
        } else {
            console.log(`No Tali: ${noTali} -> NOT FOUND`);
        }
    }
}

auditGoats();
