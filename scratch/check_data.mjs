import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Extract config from src/supabase.js if possible, or just look at it
const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);

if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    
    async function checkData() {
        // Check all goats
        const { count: total, error: e1 } = await supabase.from('stok_kambing').select('*', { count: 'exact', head: true });
        // Check available goats
        const { count: available, error: e2 } = await supabase.from('stok_kambing').select('*', { count: 'exact', head: true }).eq('status_transaksi', 'Tersedia');
        
        console.log('--- Database Check ---');
        console.log('Total Gots:', total);
        console.log('Available Goats (status_transaksi = Tersedia):', available);
        
        if (available === 0 && total > 0) {
            console.log('\nINFO: Database has goats, but NONE are marked as "Tersedia". This is why the etalase is empty.');
        } else if (total === 0) {
            console.log('\nINFO: Database is completely empty.');
        }
    }
    
    checkData();
} else {
    console.log('Could not find Supabase config in src/supabase.js');
}
