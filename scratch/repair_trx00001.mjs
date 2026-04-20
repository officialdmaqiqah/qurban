
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ'; // We'll try with this
const supabase = createClient(supabaseUrl, supabaseKey);

async function repair() {
    console.log('--- Repairing TRX00001 ---');

    const goatsToRestore = [
        {
            id: 'REPAIRED-30',
            no_tali: '30',
            batch: 'BT002',
            warna_tali: '?',
            status_transaksi: 'Terjual',
            status_kesehatan: 'Sehat',
            status_fisik: 'Ada',
            harga_kandang: 3700000,
            transaction_id: 'TRX00001'
        },
        {
            id: 'REPAIRED-33',
            no_tali: '33',
            batch: 'BT002',
            warna_tali: '?',
            status_transaksi: 'Terjual',
            status_kesehatan: 'Sehat',
            status_fisik: 'Ada',
            harga_kandang: 3300000,
            transaction_id: 'TRX00001'
        }
    ];

    for (const g of goatsToRestore) {
        console.log(`Inserting goat #${g.no_tali}...`);
        const { error } = await supabase.from('stok_kambing').upsert(g);
        if (error) console.error(`Error inserting ${g.no_tali}:`, error.message);
        else console.log(`Success inserting ${g.no_tali}`);
    }

    console.log('Updating TRX00001 items...');
    // We can't easily update JSONB via partial upsert with publishable key if RLS is tight,
    // but we can try to find the record and update it.
    
    // Note: Items update will likely be done via the UI by the user after I fix the code,
    // because I can't easily fetch full TRX00001 here due to RLS.
    // However, recreating the goats is the BIGGEST part.
}

repair();
