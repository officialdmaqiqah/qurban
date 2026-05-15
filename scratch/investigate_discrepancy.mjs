import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate(trxId) {
    console.log(`\n=== INVESTIGATING ${trxId} ===`);
    
    // 1. Login
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@qurban.com',
        password: 'admin123'
    });

    if (authError) {
        console.error("Login failed:", authError.message);
        return;
    }
    console.log("Logged in as admin.");

    // 2. Get Transaction Data
    const { data: trx, error: errT } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
    if (errT) { console.error("Error fetching trx:", errT.message); return; }
    
    console.log(`Customer: ${trx.customer?.nama}`);
    console.log(`Total Deal: ${trx.total_deal}`);
    console.log(`Total Paid (in DB): ${trx.total_paid}`);
    console.log(`Total Overpaid (in DB): ${trx.total_overpaid}`);
    
    // 3. Get Financial Records (Deep Search)
    // Search by ID or by customer name in description/category
    const customerName = trx.customer?.nama || '';
    const { data: fins, error: errF } = await supabase.from('keuangan').select('*');
    
    if (errF) { console.error("Error fetching financial data:", errF.message); return; }

    const matchedFins = fins.filter(f => {
        const fDesc = (f.keterangan || '').toLowerCase();
        const fCat = (f.kategori || '').toLowerCase();
        const fId = (f.related_trx_id || '').toUpperCase();
        const tId = trxId.toUpperCase();
        
        return fId === tId || fDesc.includes(tId.toLowerCase()) || (customerName && fDesc.includes(customerName.toLowerCase()));
    });

    console.log(`\nMatched Financial Records (${matchedFins.length}):`);
    matchedFins.forEach(f => {
        console.log(`- [${f.id}] ${f.tanggal} | ${f.kategori} | ${f.tipe} | Nom: ${f.nominal} | Ket: ${f.keterangan}`);
    });

    // 4. Audit History Bayar
    console.log(`\nHistory Bayar JSON in Transaction Table:`);
    console.log(JSON.stringify(trx.history_bayar, null, 2));

    const calculatedTotal = (trx.history_bayar || []).reduce((sum, h) => {
        const cat = (h.category || '').toLowerCase();
        if (h.tipe === 'pemasukan') {
            const fDesc = (h.keterangan || '').toLowerCase();
            if (cat === 'titipan dana agen' || cat.includes('komisi') || cat.includes('karkas') || 
                cat.includes('sulam') || cat.includes('tumbal') || 
                fDesc.includes('sulam') || fDesc.includes('tumbal')) return sum;
            
            return sum + h.nominal;
        } else {
            if (cat.includes('refund') || cat.includes('pengembalian') || cat.includes('kelebihan')) {
                return sum - Math.abs(h.nominal); 
            }
            return sum;
        }
    }, 0);

    console.log(`\nCalculated Total from History: ${calculatedTotal}`);
    console.log(`Discrepancy: ${calculatedTotal - trx.total_deal}`);
}

async function run() {
    await investigate('TRX00031');
    await investigate('TRX00019');
}

run();
