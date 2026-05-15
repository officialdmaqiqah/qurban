import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function findDuplicates() {
    const ids = ['TRX00030', 'TRX00031', 'TRX00023'];
    console.log("=== SCANNING FOR DUPLICATE TRANSACTION IDS ===");
    
    for (const id of ids) {
        const { data, error } = await supabase.from('transaksi').select('*').eq('id', id);
        
        if (data && data.length > 1) {
            console.log(`\n⚠️ ALERT: ID [${id}] has ${data.length} duplicates!`);
            data.forEach((t, idx) => {
                console.log(`  Row ${idx+1}: Created: ${t.created_at} | Deal: ${t.total_deal} | Paid: ${t.total_paid} | UUID: ${t.id_uuid || 'N/A'}`);
            });
        } else if (data && data.length === 1) {
            console.log(`[${id}] is unique (1 row).`);
        } else {
            console.log(`[${id}] not found.`);
        }
    }
}

findDuplicates();
