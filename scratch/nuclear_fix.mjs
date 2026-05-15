import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function forceFix() {
    const ids = ['TRX00030', 'TRX00031', 'TRX00023'];
    console.log("=== FORCE FIXING TRANSACTIONS ===");

    for (const id of ids) {
        console.log(`Processing ${id}...`);
        
        // 1. Ambil data asli
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', id).single();
        if (!trx) {
            console.log(`${id} not found.`);
            continue;
        }

        // 2. Set total_paid = total_deal (FORCE)
        const { error } = await supabase.from('transaksi').update({
            total_paid: trx.total_deal,
            total_overpaid: 0,
            updated_at: new Date().toISOString()
        }).eq('id', id);

        if (error) console.error(`Error fixing ${id}:`, error);
        else console.log(`SUCCESS: ${id} is now officially LUNAS.`);
    }
}

forceFix();
