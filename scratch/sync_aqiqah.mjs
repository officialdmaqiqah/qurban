import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function syncAqiqah() {
    const ids = ['24', '32', '03', '12'];
    console.log("=== SYNCING AQIQAH GOATS TO DISTRIBUTED ===");
    
    for (const noTali of ids) {
        console.log(`Processing No Tali: ${noTali}...`);
        
        // Update status menjadi Terdistribusi (karena sudah disembelih aqiqah)
        const { data, error } = await supabase.from('stok_kambing')
            .update({
                status_fisik: 'Terdistribusi',
                status_transaksi: 'Terdistribusi',
                status_kesehatan: 'Sehat', // Tetap sehat karena disembelih normal
                updated_at: new Date().toISOString()
            })
            .eq('no_tali', noTali);
            
        if (error) {
            console.error(`  [ERROR] ${noTali}:`, error);
        } else {
            console.log(`  [SUCCESS] ${noTali} is now DISTRIBUTED.`);
        }
    }
}

syncAqiqah();
