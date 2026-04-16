import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);

if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    
    async function checkSpecificGoats() {
        const { data, error } = await supabase
            .from('stok_kambing')
            .select('no_tali, foto_thumb, foto_fisik, harga_kandang, berat')
            .in('no_tali', ['04', '09']);
        
        if (error) {
            console.error(error);
            return;
        }
        
        console.log('--- DATA PERBANDINGAN #04 vs #09 ---');
        data.forEach(g => {
            console.log(`Tag #${g.no_tali}:`);
            console.log(`  Foto: ${g.foto_thumb || g.foto_fisik}`);
            console.log(`  Berat: ${g.berat}`);
            console.log(`  Harga: ${g.harga_kandang}`);
        });
    }
    
    checkSpecificGoats();
}
