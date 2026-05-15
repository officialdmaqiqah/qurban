import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function list() {
    const { data, error } = await supabase.from('transaksi').select('id, total_deal, total_paid').limit(10);
    console.log("TRX Samples:", data || error);
    
    const { data: fins } = await supabase.from('keuangan').select('id, kategori, nominal').limit(10);
    console.log("Fin Samples:", fins);
}
list();
