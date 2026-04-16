import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);

if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    
    async function checkImages() {
        const { data, error } = await supabase.from('stok_kambing').select('no_tali, foto_thumb, foto_fisik').eq('status_transaksi', 'Tersedia');
        
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        console.log('--- Goat Image Data ---');
        data.forEach(g => {
            console.log(`Tag #${g.no_tali}:`);
            console.log(`  foto_thumb: ${g.foto_thumb}`);
            console.log(`  foto_fisik: ${g.foto_fisik}`);
        });
    }
    
    checkImages();
}
