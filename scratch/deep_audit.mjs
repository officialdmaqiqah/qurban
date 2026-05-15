import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function inspectData() {
    const ids = ['TRX00030', 'TRX00031', 'TRX00023'];
    console.log("=== INSPECTING DATABASE DATA ===");
    
    for (const id of ids) {
        // Cari di tabel transaksi
        const { data: trx, error } = await supabase.from('transaksi').select('id, total_deal, total_paid, total_overpaid, history_bayar').eq('id', id).single();
        
        if (error) {
            console.log(`[${id}] ERROR: ${error.message}`);
            continue;
        }

        console.log(`\n--- ${id} ---`);
        console.log(`Deal      : ${trx.total_deal}`);
        console.log(`Paid      : ${trx.total_paid}`);
        console.log(`Overpaid  : ${trx.total_overpaid}`);
        console.log(`History   : ${(trx.history_bayar || []).length} items`);
        
        // Cari di tabel keuangan yang terkait ID ini
        const { data: fins } = await supabase.from('keuangan').select('id, nominal, tipe, kategori, keterangan').eq('related_trx_id', id);
        console.log(`Ledger Docs: ${fins?.length || 0} items found`);
        fins?.forEach(f => {
            console.log(`  - ${f.id} | ${f.tipe} | ${f.nominal} | ${f.kategori} | ${f.keterangan}`);
        });

        // Cari di tabel keuangan yang MUNGKIN terkait (cari ID di keterangan)
        const { data: orphans } = await supabase.from('keuangan').select('id, nominal, tipe, kategori, keterangan').is('related_trx_id', null).ilike('keterangan', `%${id}%`);
        if (orphans?.length > 0) {
            console.log(`Orphan Docs (Found via Keterangan): ${orphans.length}`);
            orphans.forEach(f => {
                console.log(`  ! ${f.id} | ${f.tipe} | ${f.nominal} | ${f.kategori} | ${f.keterangan}`);
            });
        }
    }
}

inspectData();
