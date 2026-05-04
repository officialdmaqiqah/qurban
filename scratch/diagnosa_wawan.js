/**
 * DIAGNOSTIC SCRIPT: WAWAN ACTIVITY CHECK
 * Copy and paste this into your Browser Console (F12 -> Console) 
 * while logged into the DMQ Dashboard.
 */

async function trackWawanActivity() {
    console.log("%c🔍 Memulai Pelacakan Aktivitas Wawan...", "color: #a855f7; font-weight: bold; font-size: 14px;");
    
    const wawanId = '30348fa8-b8f3-4503-a2f7-b87191633738';
    const wawanEmail = 'WSE82';
    
    try {
        // 1. Cek Transaksi yang dikelola Wawan
        console.log("\n--- [1] Mencari Transaksi ---");
        const { data: trxs, error: tErr } = await supabase
            .from('transaksi')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(100);
            
        if (tErr) throw tErr;
        
        const wawanTrxs = trxs.filter(t => 
            JSON.stringify(t.agen || {}).toLowerCase().includes('wawan') ||
            JSON.stringify(t.agen || {}).toLowerCase().includes('wse82')
        );
        
        if (wawanTrxs.length > 0) {
            console.table(wawanTrxs.map(t => ({
                ID: t.id,
                Tanggal: t.tgl_trx,
                Konsumen: t.customer?.nama,
                Status: t.total_paid >= t.total_deal ? 'LUNAS' : 'PIUTANG',
                Update_Terakhir: new Date(t.updated_at).toLocaleString('id-ID')
            })));
        } else {
            console.log("❌ Tidak ditemukan transaksi atas nama Wawan dalam 100 data terakhir.");
        }

        // 2. Cek Input Keuangan oleh Wawan
        console.log("\n--- [2] Mencari Input Keuangan ---");
        const { data: fins, error: fErr } = await supabase
            .from('keuangan')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
            
        if (fErr) throw fErr;
        
        const wawanFins = fins.filter(f => 
            (f.keterangan || '').toLowerCase().includes('wawan') ||
            (f.agen_name || '').toLowerCase().includes('wawan')
        );
        
        if (wawanFins.length > 0) {
            console.table(wawanFins.map(f => ({
                ID: f.id,
                Kategori: f.kategori,
                Nominal: f.nominal,
                Keterangan: f.keterangan,
                Tanggal_Input: new Date(f.created_at).toLocaleString('id-ID')
            })));
        } else {
            console.log("❌ Tidak ditemukan catatan keuangan atas nama Wawan dalam 100 data terakhir.");
        }

        // 3. Cek Permohonan Edit (edit_requests)
        console.log("\n--- [3] Mencari Permohonan Edit ---");
        const { data: reqs, error: rErr } = await supabase
            .from('edit_requests')
            .select('*')
            .or(`requester_id.eq.${wawanId},requester_email.eq.${wawanEmail},agen_name.ilike.%Wawan%`)
            .order('timestamp', { ascending: false });
            
        if (rErr) throw rErr;
        
        if (reqs.length > 0) {
            console.table(reqs.map(r => ({
                TRX_ID: r.trx_id,
                Status: r.status,
                Waktu: new Date(r.timestamp).toLocaleString('id-ID'),
                Detail: JSON.stringify(r.new_data).substring(0, 50) + "..."
            })));
        } else {
            console.log("❌ Wawan tidak pernah mengajukan permohonan edit data.");
        }

        console.log("\n%c✅ Pelacakan Selesai.", "color: #10b981; font-weight: bold;");
        
    } catch (e) {
        console.error("Gagal menjalankan diagnosa:", e);
    }
}

trackWawanActivity();
