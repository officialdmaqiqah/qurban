import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function cleanupDuplicates() {
    const ids = ['24', '32', '03', '12'];
    console.log("=== CLEANING UP DUPLICATE/GHOST RECORDS ===");
    
    for (const noTali of ids) {
        console.log(`Checking No Tali: ${noTali}...`);
        
        // Cari semua record dengan no_tali ini
        const { data, error } = await supabase.from('stok_kambing')
            .select('id, no_tali, status_fisik, status_transaksi')
            .eq('no_tali', noTali);
            
        if (data && data.length > 1) {
            console.log(`  Found ${data.length} records for ${noTali}. Cleaning up...`);
            
            // Simpan yang statusnya 'Terdistribusi' atau 'Disembelih'
            // Hapus yang statusnya masih 'Ada' atau 'Tersedia'
            for (const record of data) {
                if (record.status_fisik === 'Ada' || record.status_transaksi === 'Tersedia') {
                    console.log(`  [DELETING GHOST] ID: ${record.id} (Status: ${record.status_fisik}/${record.status_transaksi})`);
                    const { error: delError } = await supabase.from('stok_kambing')
                        .delete()
                        .eq('id', record.id);
                    if (delError) console.error("    Delete Error:", delError);
                } else {
                    console.log(`  [KEEPING REAL] ID: ${record.id} (Status: ${record.status_fisik}/${record.status_transaksi})`);
                }
            }
        } else if (data && data.length === 1) {
             console.log(`  Only 1 record found. Status: ${data[0].status_fisik}. Checking if it needs update...`);
             if (data[0].status_fisik === 'Ada' || data[0].status_transaksi === 'Tersedia') {
                 console.log(`  [UPDATING] Forcing ${noTali} to Terdistribusi/Disembelih to match Master Data...`);
                 await supabase.from('stok_kambing')
                    .update({ status_fisik: 'Disembelih', status_transaksi: 'Terdistribusi' })
                    .eq('id', data[0].id);
             }
        } else {
            console.log(`  No records found for ${noTali}.`);
        }
    }
    console.log("=== CLEANUP FINISHED ===");
}

cleanupDuplicates();
