
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function cleanStatuses() {
    console.log("Fetching all goats for status cleanup...");
    const { data: goats, error } = await supabase.from('stok_kambing').select('id, status_kesehatan, status_fisik, status_transaksi, no_tali, batch');
    
    if (error) {
        console.error(error);
        return;
    }

    console.log(`Analyzing ${goats.length} goats...`);
    let count = 0;
    
    for (const g of goats) {
        const cleanKes = (g.status_kesehatan || '').trim();
        const cleanFis = (g.status_fisik || '').trim();
        const cleanTrx = (g.status_transaksi || '').trim();
        
        let needsUpdate = false;
        const updates = {};
        
        // Standardize Casing to Title Case (Sehat, Ada, Tersedia, Terdistribusi, Mati, Sakit, Perawatan, Hilang, Disembelih)
        const standardize = (val) => {
            if (!val) return val;
            const lower = val.toLowerCase();
            if (lower === 'sehat') return 'Sehat';
            if (lower === 'ada') return 'Ada';
            if (lower === 'tersedia') return 'Tersedia';
            if (lower === 'terdistribusi') return 'Terdistribusi';
            if (lower === 'terjual') return 'Terjual';
            if (lower === 'mati') return 'Mati';
            if (lower === 'sakit') return 'Sakit';
            if (lower === 'perawatan') return 'Perawatan';
            if (lower === 'hilang') return 'Hilang';
            if (lower === 'disembelih') return 'Disembelih';
            return val; // Keep others as is but trimmed
        };

        const sKes = standardize(cleanKes);
        const sFis = standardize(cleanFis);
        const sTrx = standardize(cleanTrx);

        if (sKes !== g.status_kesehatan) { updates.status_kesehatan = sKes; needsUpdate = true; }
        if (sFis !== g.status_fisik) { updates.status_fisik = sFis; needsUpdate = true; }
        if (sTrx !== g.status_transaksi) { updates.status_transaksi = sTrx; needsUpdate = true; }

        if (needsUpdate) {
            console.log(`Updating No ${g.no_tali} (${g.batch}):`, updates);
            const { error: upErr } = await supabase.from('stok_kambing').update(updates).eq('id', g.id);
            if (upErr) console.error(`Failed to update ${g.id}:`, upErr);
            else count++;
        }
    }
    
    console.log(`Cleaned up ${count} records.`);
}

cleanStatuses();
