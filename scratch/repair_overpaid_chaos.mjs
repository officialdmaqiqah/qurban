
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function repairChaos() {
    console.log("Starting MASS REPAIR for Overpaid Transactions...");

    // 1. Fetch all transactions
    const { data: trxs, error: tErr } = await supabase.from('transaksi').select('*');
    if (tErr) {
        console.error("Error fetching transactions:", tErr);
        return;
    }

    // 2. Fetch all financial records with related_trx_id
    const { data: fins, error: fErr } = await supabase.from('keuangan').select('*').not('related_trx_id', 'is', null);
    if (fErr) {
        console.error("Error fetching keuangan:", fErr);
        return;
    }

    let fixCount = 0;

    for (const trx of trxs) {
        // Filter financial records for this transaction
        const related = fins.filter(f => f.related_trx_id === trx.id);
        
        // Re-calculate Total Paid
        const newTotalPaid = related.reduce((sum, f) => {
            const nom = parseFloat(f.nominal) || 0;
            if (f.tipe === 'pemasukan') return sum + nom;
            if (f.kategori === 'Pengembalian Dana') return sum - nom; // Refund reduces paid amount
            return sum;
        }, 0);

        const deal = parseFloat(trx.total_deal) || 0;
        const newTotalOverpaid = Math.max(0, newTotalPaid - deal);

        // Check if data is actually different
        const isPaidDiff = Math.abs(newTotalPaid - (trx.total_paid || 0)) > 1;
        const isOverDiff = Math.abs(newTotalOverpaid - (trx.total_overpaid || 0)) > 1;

        if (isPaidDiff || isOverDiff) {
            console.log(`Fixing ${trx.id}: Paid ${trx.total_paid} -> ${newTotalPaid}, Overpaid ${trx.total_overpaid} -> ${newTotalOverpaid}`);
            
            // Build history_bayar for consistency
            const newHistory = related.map(f => ({
                payId: f.id,
                tgl: f.tanggal,
                nominal: f.tipe === 'pengeluaran' ? -Math.abs(parseFloat(f.nominal)) : Math.abs(parseFloat(f.nominal)),
                channel: f.channel
            })).sort((a,b) => new Date(a.tgl) - new Date(b.tgl));

            const { error: upErr } = await supabase.from('transaksi').update({
                total_paid: newTotalPaid,
                total_overpaid: newTotalOverpaid,
                history_bayar: newHistory,
                updated_at: new Date().toISOString()
            }).eq('id', trx.id);

            if (!upErr) fixCount++;
            else console.error(`Failed to update ${trx.id}:`, upErr);
        }
    }

    console.log(`\nDONE! Repaired ${fixCount} transactions.`);
}

repairChaos();
