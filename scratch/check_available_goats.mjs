import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);

if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    
    async function checkData() {
        const { data, error } = await supabase
            .from('stok_kambing')
            .select('no_tali, foto_thumb, foto_fisik, harga_kandang')
            .eq('status_transaksi', 'Tersedia');
        
        if (error) {
            console.error(error);
            return;
        }
        
        console.log('--- AVAILABLE GOATS DATA ---');
        data.forEach(g => {
            console.log(`Tag #${g.no_tali}:`);
            console.log(`  Thumb: ${g.foto_thumb}`);
            console.log(`  Fisik: ${g.foto_fisik}`);
            console.log(`  Harga: ${g.harga_kandang}`);
        });
    }
    
    checkData();
}
