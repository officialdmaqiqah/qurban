import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function repair() {
    try {
        console.log("Fetching KMS-977526 record...");
        const { data: kms, error: errKms } = await supabase.from('keuangan').select('*').eq('id', 'KMS-977526').single();
        
        if (errKms) {
            console.error("Error fetching KMS record:", errKms);
        } else {
            console.log("Found KMS record:", kms);
        }

        console.log("Fetching TRX00037 record...");
        const { data: trx, error: errTrx } = await supabase.from('transaksi').select('*').eq('id', 'TRX00037').single();
        
        if (errTrx) {
            console.error("Error fetching TRX record:", errTrx);
            return;
        }
        
        console.log("Current TRX komisi:", trx.komisi);

        const updatedKomisi = {
            ...trx.komisi,
            status: 'lunas',
            tglBayar: '2026-04-28',
            isUpfront: kms ? !!kms.keterangan?.includes('Upfront') : false,
            buktiUrl: kms ? kms.bukti_url : null
        };

        console.log("Updating to:", updatedKomisi);

        const { error: updateErr } = await supabase.from('transaksi').update({ komisi: updatedKomisi }).eq('id', 'TRX00037');

        if (updateErr) {
            console.error("Error updating TRX:", updateErr);
        } else {
            console.log("Successfully updated TRX00037!");
        }

    } catch (e) {
        console.error("Exception:", e);
    }
}

repair();
