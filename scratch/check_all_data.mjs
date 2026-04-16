import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);

if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    
    async function checkAll() {
        const tables = ['stok_kambing', 'transaksi', 'keuangan', 'profiles'];
        console.log('--- Global Database Check ---');
        for (const t of tables) {
            const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
            console.log(`${t}: ${count || 0} rows`);
        }
    }
    
    checkAll();
}
