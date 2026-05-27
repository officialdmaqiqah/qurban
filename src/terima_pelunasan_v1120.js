import { supabase } from './supabase.js';

// Helpers
export const formatTgl = (iso) => {
    if (!iso) return '-';
    const p = iso.split('-');
    return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
};

const GDRIVE_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwVd01SmNkuoUwinekKbDAh3meqs8ZsbR-OZoCBPUcHZ3_jcBQST6p5vrSVJULt_t8/exec';

export async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let width = img.width;
                let height = img.height;
                const max = 800;
                if (width > height) { if (width > max) { height *= max / width; width = max; } } 
                else { if (height > max) { width *= max / height; height = max; } }
                canvas.width = width; canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
            };
        };
    });
}

export async function uploadToGDrive(base64, folderName) {
    try {
        const response = await fetch(GDRIVE_PROXY_URL, {
            method: 'POST',
            body: JSON.stringify({ base64, mimeType: "image/jpeg", fileName: "pay_" + Date.now(), folderName })
        });
        const result = await response.json();
        return result.success ? result.url : null;
    } catch (e) { console.error('GDrive failed:', e); return null; }
}

export const getTrxData = async () => { const { data } = await supabase.from('transaksi').select('*'); return data || []; };
export const getBankAccounts = async () => { 
    const { data } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single(); 
    return data?.val || [];
};

export const syncOneTrx = async (trxId) => {
    try {
        window.showToast(`Sedang memperbaiki saldo ${trxId}...`, "info");
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
        if (!trx) return window.showAlert("Order tidak ditemukan", "danger");

        const { data: allFins } = await supabase.from('keuangan').select('*').or(`related_trx_id.eq.${trxId},keterangan.ilike.%${trxId}%`);
        
        const rawName = (trx.customer?.nama || '').toLowerCase().trim();
        
        const history = (allFins || []).filter(f => {
            const fId = (f.related_trx_id || '').toUpperCase();
            const fDesc = (f.keterangan || '').toLowerCase();
            const fCat = (f.kategori || '').toLowerCase();
            
            // EXCLUDE non-payment categories (garbage/deposit)
            const isGarbage = fCat.includes('sulam') || fCat.includes('tumbal') || 
                              fDesc.includes('sulam') || fDesc.includes('tumbal') ||
                              fCat.includes('komisi') || fCat.includes('karkas') ||
                              fCat.includes('titipan') || fCat.includes('tabungan') ||
                              fCat.includes('operasional') || fCat.includes('biaya') ||
                              (f.tipe === 'pemasukan' && fCat.includes('kelebihan'));
            if (isGarbage) return false;

            let reason = "";
            if (fId === trxId.toUpperCase()) reason = "ID MATCH (PASTI)";
            else if (fDesc.includes(trxId.toLowerCase())) reason = "ID DI KETERANGAN";
            else if (rawName.length >= 8 && fDesc.includes(rawName)) {
                const otherTrxMatch = fDesc.match(/trx\d+/g);
                if (otherTrxMatch && !otherTrxMatch.includes(trxId.toLowerCase())) return false;
                reason = "NAMA LENGKAP (STRICT)";
            }
            
            if (reason) {
                f._matchReason = reason;
                return true;
            }
            return false;
        }).map(f => ({
            id: f.id, tgl: f.tanggal,
            nominal: f.tipe === 'pengeluaran' ? -Math.abs(f.nominal) : Math.abs(f.nominal),
            category: f.kategori, tipe: f.tipe, channel: f.channel, keterangan: f.keterangan || '',
            reason: f._matchReason
        }));

        let total = history.reduce((sum, h) => {
            const cat = (h.category || '').toLowerCase();
            const fDesc = (h.keterangan || '').toLowerCase();
            
            const isGarbage = cat.includes('sulam') || cat.includes('tumbal') || 
                              fDesc.includes('sulam') || fDesc.includes('tumbal') ||
                              cat.includes('komisi') || cat.includes('karkas') ||
                              cat.includes('titipan') || cat.includes('tabungan') ||
                              cat.includes('operasional') || cat.includes('biaya') ||
                              (h.tipe === 'pemasukan' && cat.includes('kelebihan'));

            if (h.tipe === 'pemasukan') {
                if (isGarbage) return sum;
                return sum + h.nominal;
            } else {
                const isRefund = cat.includes('refund') || cat.includes('pengembalian') || cat.includes('kelebihan') ||
                                 fDesc.includes('refund') || fDesc.includes('pengembalian') || fDesc.includes('kelebihan');
                if (isRefund) return sum + h.nominal; 
                return sum;
            }
        }, 0);

        const finalPaid = Math.min(total, trx.total_deal || 0);
        const finalOverpaid = Math.max(0, total - (trx.total_deal || 0));

        await supabase.from('transaksi').update({
            total_paid: finalPaid,
            total_overpaid: finalOverpaid,
            history_bayar: history
        }).eq('id', trxId);

        window.showAlert(`Saldo ${trxId} berhasil diperbaiki!`, "success", () => window.location.reload());
    } catch (err) {
        window.showAlert("Gagal: " + err.message, "danger");
    }
};

export const syncAllBalances = async () => {
    return new Promise((resolve) => {
        window.showConfirm(`🚀 <b>JALANKAN MEGA-SYNC v11.20?</b><br><br>Sistem akan menghitung ulang semua saldo dari nol (Sistem Anti-Ganda Aktif).`, async () => {
            try {
                window.showToast("Sinkronisasi sedang berjalan...", "info");
                const { data: trxs } = await supabase.from('transaksi').select('*');
                const { data: allFins } = await supabase.from('keuangan').select('*');
                
                for (const trx of trxs) {
                    const tId = trx.id.toUpperCase();
                    const rawName = (trx.customer?.nama || '').toLowerCase().trim();
                    const honorifics = ['haji', 'hj', 'pak', 'bpk', 'ibu', 'ny', 'tn', 'kak', 'bang', 'mas', 'mbak'];
                    const nameParts = rawName.split(' ').filter(p => p.length >= 3 && !honorifics.includes(p));
                    
                    const history = (allFins || []).filter(f => {
                        const fId = (f.related_trx_id || '').toUpperCase();
                        const fDesc = (f.keterangan || '').toLowerCase();
                        const fCat = (f.kategori || '').toLowerCase();
                        
                        // EXCLUDE non-payment categories (garbage/deposit)
                        const isGarbage = fCat.includes('sulam') || fCat.includes('tumbal') || 
                                          fDesc.includes('sulam') || fDesc.includes('tumbal') ||
                                          fCat.includes('komisi') || fCat.includes('karkas') ||
                                          fCat.includes('titipan') || fCat.includes('tabungan') ||
                                          fCat.includes('operasional') || fCat.includes('biaya') ||
                                          (f.tipe === 'pemasukan' && fCat.includes('kelebihan'));
                        if (isGarbage) return false;

                        let reason = "";
                        if (fId === tId) reason = "ID MATCH (PASTI)";
                        else if (fId && fId !== tId) return false;
                        else if (fDesc.includes(tId.toLowerCase())) reason = "ID DI KETERANGAN";
                        else if (rawName.length >= 5 && fDesc.includes(rawName)) {
                            // Cek apakah ada ID TRX lain yang disebut di keterangan
                            const otherTrxMatch = fDesc.match(/trx\d+/g);
                            if (otherTrxMatch && !otherTrxMatch.includes(tId.toLowerCase())) return false;
                            reason = "NAMA LENGKAP (STRICT)";
                        }
                        
                        if (reason) {
                            f._matchReason = reason;
                            return true;
                        }
                        return false;
                    }).map(f => ({
                        id: f.id, tgl: f.tanggal,
                        nominal: f.tipe === 'pengeluaran' ? -Math.abs(f.nominal) : Math.abs(f.nominal),
                        category: f.kategori, tipe: f.tipe, channel: f.channel, keterangan: f.keterangan || '',
                        reason: f._matchReason
                    }));

                    let total = history.reduce((sum, h) => {
                        const cat = (h.category || '').toLowerCase();
                        const fDesc = (h.keterangan || '').toLowerCase();
                        
                        // GLOBAL FILTER: Sulam, Tumbal, Komisi, Karkas, Titipan
                        const isGarbage = cat.includes('sulam') || cat.includes('tumbal') || 
                                          fDesc.includes('sulam') || fDesc.includes('tumbal') ||
                                          cat.includes('komisi') || cat.includes('karkas') ||
                                          cat.includes('titipan') || cat.includes('tabungan') ||
                                          cat.includes('operasional') || cat.includes('biaya') ||
                                          (h.tipe === 'pemasukan' && cat.includes('kelebihan'));

                        if (h.tipe === 'pemasukan') {
                            if (isGarbage) return sum;
                            return sum + h.nominal;
                        } else {
                            // Pengeluaran: Hitung sebagai pengurang saldo jika itu Refund/Kelebihan (Cek Kategori & Keterangan)
                            const isRefund = cat.includes('refund') || cat.includes('pengembalian') || cat.includes('kelebihan') ||
                                             fDesc.includes('refund') || fDesc.includes('pengembalian') || fDesc.includes('kelebihan');
                            
                            if (isRefund) {
                                return sum + h.nominal; 
                            }
                            return sum;
                        }
                    }, 0);

                    let finalPaid = Math.min(total, trx.total_deal || 0);
                    let finalOverpaid = Math.max(0, total - (trx.total_deal || 0));
                    await supabase.from('transaksi').update({
                        total_paid: finalPaid,
                        total_overpaid: finalOverpaid,
                        history_bayar: history
                    }).eq('id', trx.id);
                }
                window.showAlert("Sinkronisasi Selesai!", "success", () => {
                    if (window.location.reload) window.location.reload();
                    resolve();
                });
            } catch (err) {
                window.showAlert("Error: " + err.message, "danger");
                resolve();
            }
        });
    });
};

export const renderList = async () => {
    const selOrder = document.getElementById('selOrder');
    const listOrders = document.getElementById('listOrders');
    const tableBodyBelumLunas = document.getElementById('tableBodyBelumLunas');
    const tableBodyOverpaid = document.getElementById('tableBodyOverpaid');
    const badgeOverpaidCount = document.getElementById('badgeOverpaidCount');
    const inpSearchOrder = document.getElementById('inpSearchOrder');

    const trxs = await getTrxData();
    const keyword = (inpSearchOrder?.value || '').toLowerCase();
    
    // Get profile from session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const userRole = (profile?.role || '').toLowerCase().replace(/_/g, ' ').trim();
    const isAdmin = ['admin', 'office', 'staf', 'operator'].includes(userRole);
    const linkedAgenId = profile?.linked_agen_id;

    let filtered = isAdmin ? trxs : trxs.filter(t => t.agen?.id === linkedAgenId);
    if (keyword) {
        filtered = filtered.filter(t => 
            t.id.toLowerCase().includes(keyword) || 
            (t.customer?.nama || '').toLowerCase().includes(keyword) ||
            (t.agen?.nama || '').toLowerCase().includes(keyword)
        );
    }

    const belumLunas = filtered.filter(t => (Math.floor(t.total_deal || 0) - Math.floor(t.total_paid || 0)) > 1000).sort((a,b) => new Date(b.tgl_trx) - new Date(a.tgl_trx));
    const overpaid = filtered.filter(t => {
        const over1 = Math.floor(t.total_overpaid || 0);
        const over2 = Math.floor(t.total_paid || 0) - Math.floor(t.total_deal || 0);
        return over1 > 1000 || over2 > 1000;
    }).sort((a,b) => new Date(b.tgl_trx) - new Date(a.tgl_trx));

    // POPULATE DATALIST
    if (listOrders) {
        const sortedTrxs = [...filtered].sort((a,b) => b.id.localeCompare(a.id));
        let dropdownHtml = '';
        sortedTrxs.forEach(t => {
            const sisa = (t.total_deal || 0) - (t.total_paid || 0);
            const label = `${t.id} - ${t.customer?.nama || '-'} [Agen: ${t.agen?.nama || '-'}] (Sisa: ${window.formatRp(sisa)})`;
            dropdownHtml += `<option value="${t.id}">${label}</option>`;
        });
        listOrders.innerHTML = dropdownHtml;
    }

    // Special case for perbaiki_keuangan.html
    const perbaikiSelOrder = document.getElementById('selOrder');
    if (perbaikiSelOrder && perbaikiSelOrder.tagName === 'SELECT') {
        let options = '<option value="">-- Pilih Order --</option>';
        filtered.forEach(t => {
            const sisa = (t.total_deal || 0) - (t.total_paid || 0);
            const label = `${t.id} - ${t.customer?.nama || '-'} [Agen: ${t.agen?.nama || '-'}] (Sisa: ${window.formatRp(sisa)})`;
            options += `<option value="${t.id}">${label}</option>`;
        });
        perbaikiSelOrder.innerHTML = options;
    }

    if (tableBodyBelumLunas) {
        tableBodyBelumLunas.innerHTML = belumLunas.length === 0 ? '<tr><td colspan="5" style="text-align:center;">Semua lunas!</td></tr>' : '';
        belumLunas.forEach(t => tableBodyBelumLunas.appendChild(createOrderRow(t, 'belum')));
    }

    if (tableBodyOverpaid) {
        tableBodyOverpaid.innerHTML = overpaid.length === 0 ? '<tr><td colspan="4" style="text-align:center;">Tidak ada kelebihan bayar</td></tr>' : '';
        overpaid.forEach(t => tableBodyOverpaid.appendChild(createOrderRow(t, 'overpaid')));
    }
    
    // For perbaiki_keuangan.html specifically
    const bodyOverpaid = document.getElementById('bodyOverpaid');
    if (bodyOverpaid) {
        bodyOverpaid.innerHTML = overpaid.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:30px;">Tidak ada data kelebihan bayar.</td></tr>' : '';
        overpaid.forEach(t => {
            const tr = document.createElement('tr');
            const over = Math.max(t.total_overpaid || 0, (t.total_paid || 0) - (t.total_deal || 0));
            tr.innerHTML = `
                <td style="padding:12px; border-bottom:1px solid #eee;">${t.id}</td>
                <td style="padding:12px; border-bottom:1px solid #eee;">${t.customer?.nama || '-'}</td>
                <td style="padding:12px; border-bottom:1px solid #eee;">${window.formatRp(t.total_deal)}</td>
                <td style="padding:12px; border-bottom:1px solid #eee;">${window.formatRp(t.total_paid)}</td>
                <td style="padding:12px; border-bottom:1px solid #eee; font-weight:bold; color:#ef4444;">${window.formatRp(over)}</td>
            `;
            bodyOverpaid.appendChild(tr);
        });
    }

    if (badgeOverpaidCount) {
        badgeOverpaidCount.textContent = overpaid.length;
        badgeOverpaidCount.style.display = overpaid.length > 0 ? 'inline-block' : 'none';
    }
};

const createOrderRow = (t, type) => {
    const sisa = (t.total_deal || 0) - (t.total_paid || 0);
    const pct = Math.round(((t.total_paid || 0) / (t.total_deal || 1)) * 100);
    const tr = document.createElement('tr');
    tr.dataset.id = t.id;
    tr.style.cursor = 'pointer';
    
    const selOrder = document.getElementById('selOrder');

    if (type === 'belum') {
        tr.innerHTML = `
            <td data-label="ID ORDER" style="font-weight:700; color:var(--primary);">${t.id}</td>
            <td data-label="KONSUMEN" style="text-align:right;">
                <div style="font-weight:600;">${t.customer?.nama || '-'}</div>
                <div style="font-size:0.7rem; color:var(--primary);">Agen: ${t.agen?.nama || '-'}</div>
            </td>
            <td data-label="SISA TAGIHAN" style="font-weight:700; color:var(--warning);">${window.formatRp(sisa)}</td>
            <td data-label="PENYELESAIAN" style="text-align:right;">
                <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:4px;">Terbayar ${pct}%</div>
                <div style="background:rgba(0,0,0,0.1); height:6px; border-radius:4px; width:100px; margin-left:auto;">
                    <div style="width:${Math.min(100, pct)}%; height:100%; background:var(--success); border-radius:4px;"></div>
                </div>
            </td>
            <td data-label="AKSI"><button class="btn btn-sm">✔️</button></td>
        `;
        tr.onclick = () => {
            if (selOrder) {
                selOrder.value = t.id;
                selOrder.dispatchEvent(new Event('input'));
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
    } else {
        tr.innerHTML = `
            <td data-label="ID ORDER" style="font-weight:700; color:var(--primary);">${t.id}</td>
            <td data-label="KONSUMEN" style="text-align:right;">
                <div style="font-weight:600;">${t.customer?.nama || '-'}</div>
                <div style="font-size:0.7rem; color:var(--primary);">Agen: ${t.agen?.nama || '-'}</div>
            </td>
            <td data-label="KELEBIHAN" style="font-weight:700; color:var(--warning); cursor:pointer;" onclick="window.showAuditDetail('${t.id}')">
                ${window.formatRp(Math.max(t.total_overpaid || 0, (t.total_paid || 0) - (t.total_deal || 0)))}
            </td>
            <td data-label="AKSI"><button class="btn btn-sm">💸</button></td>
        `;
        tr.onclick = (e) => {
            if (e.target.closest('td').dataset.label === 'KELEBIHAN') return;
            if (window.openRefundModal) window.openRefundModal(t);
        };
    }
    return tr;
};

// Auto-run for non-module usage or simple script inclusion
if (typeof window !== 'undefined') {
    window.syncAllBalances = syncAllBalances;
    window.syncOneTrx = syncOneTrx;
    window.renderList = renderList;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Only run if we are on the terima_pelunasan page
    if (!document.getElementById('selOrder')) return;

    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; 

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const inpTglBayar = document.getElementById('inpTglBayar');
    if(inpTglBayar) inpTglBayar.value = window.getLocalDate();

    const renderStats = async () => {
        const { data: trxs } = await supabase.from('transaksi').select('total_deal, total_paid, agen');
        const userRole = (profile?.role || '').toLowerCase().replace(/_/g, ' ').trim();
        const isAdmin = ['admin', 'office', 'staf', 'operator'].includes(userRole);
        const linkedAgenId = profile?.linked_agen_id;
        let filtered = isAdmin ? trxs : trxs.filter(t => t.agen?.id === linkedAgenId);

        const belumLunas = filtered.filter(t => (t.total_deal - t.total_paid) > 1000);
        const totalSisa = belumLunas.reduce((s, t) => s + (t.total_deal - t.total_paid), 0);
        const totalPaid = filtered.reduce((s, t) => s + (t.total_paid || 0), 0);

        if (document.getElementById('statJmlBelumLunas')) document.getElementById('statJmlBelumLunas').textContent = belumLunas.length + ' Order';
        if (document.getElementById('statTotalSisa')) document.getElementById('statTotalSisa').textContent = window.formatRp(totalSisa);
        if (document.getElementById('statTotalPaid')) document.getElementById('statTotalPaid').textContent = window.formatRp(totalPaid);
    };

    const selOrder = document.getElementById('selOrder');
    if (selOrder) {
        selOrder.addEventListener('input', async () => {
            const val = selOrder.value.trim();
            if (!val) { 
                if (document.getElementById('boxInfoOrder')) document.getElementById('boxInfoOrder').style.display = 'none'; 
                if (document.getElementById('formBayar')) document.getElementById('formBayar').style.display = 'none'; 
                return; 
            }

            const { data: trx } = await supabase.from('transaksi').select('*').eq('id', val).single();
            if(!trx) { 
                if (document.getElementById('boxInfoOrder')) document.getElementById('boxInfoOrder').style.display = 'none'; 
                if (document.getElementById('formBayar')) document.getElementById('formBayar').style.display = 'none'; 
                return; 
            }

            const sisa = trx.total_deal - trx.total_paid;
            const gridInfoOrder = document.getElementById('gridInfoOrder');
            if (gridInfoOrder) {
                gridInfoOrder.innerHTML = `
                    <div class="info-card"><div class="label">Konsumen</div><div class="value">${trx.customer?.nama || '-'}</div></div>
                    <div class="info-card"><div class="label">Total Deal</div><div class="value">${window.formatRp(trx.total_deal)}</div></div>
                    <div class="info-card"><div class="label">Pernah Bayar</div><div class="value" style="cursor:pointer;" onclick="window.showAuditDetail('${trx.id}')">${window.formatRp(trx.total_paid)}</div></div>
                    <div class="info-card" style="background:rgba(245,158,11,0.05);"><div class="label" style="color:var(--warning);">SISA TAGIHAN</div><div class="value" style="color:var(--warning); font-size:1.5rem;">${window.formatRp(sisa)}</div></div>
                `;
                
                // Add Targeted Sync Button
                const syncBtnDiv = document.createElement('div');
                syncBtnDiv.style = "margin-top:10px; text-align:right;";
                syncBtnDiv.innerHTML = `<button class="btn btn-sm" style="background:rgba(59,130,246,0.1); color:var(--primary); border:1px solid var(--primary); font-size:0.65rem;" onclick="window.syncOneTrx('${trx.id}')">🔄 Sinkronkan Saldo Order Ini</button>`;
                gridInfoOrder.appendChild(syncBtnDiv);
            }
            
            const listHistoriPay = document.getElementById('listHistoriPay');
            if (listHistoriPay) {
                listHistoriPay.innerHTML = '';
                (trx.history_bayar || []).forEach(h => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.innerHTML = `<span>• ${formatTgl(h.tgl)}: ${window.formatRp(h.nominal)} (${h.channel || '-'})</span>`;
                    listHistoriPay.appendChild(div);
                });
            }
            if (document.getElementById('boxHistoriPay')) document.getElementById('boxHistoriPay').style.display = (trx.history_bayar?.length > 0) ? 'block' : 'none';
            if (document.getElementById('inpNominalBayar')) document.getElementById('inpNominalBayar').value = window.formatNum(sisa);
            if (document.getElementById('boxInfoOrder')) document.getElementById('boxInfoOrder').style.display = 'block'; 
            if (document.getElementById('formBayar')) document.getElementById('formBayar').style.display = 'block';

            // Refresh Saldo Titipan if channel is Saldo Titipan Agen
            const inpChannelBayar = document.getElementById('inpChannelBayar');
            if (inpChannelBayar && inpChannelBayar.value === 'Saldo Titipan Agen') {
                inpChannelBayar.dispatchEvent(new Event('change'));
            }
        });
    }

    const performSaveLunas = async (sendWA) => {
        const trxId = selOrder.value;
        const inpNominalBayar = document.getElementById('inpNominalBayar');
        const inpChannelBayar = document.getElementById('inpChannelBayar');
        const inpRekIdBayar = document.getElementById('inpRekIdBayar');
        const inpTglBayar = document.getElementById('inpTglBayar');
        const inpBuktiBayar = document.getElementById('inpBuktiBayar');

        const nominal = window.parseNum(inpNominalBayar.value);
        const chan = inpChannelBayar.value;
        const tgl = inpTglBayar.value;
        const payId = 'PAY-' + Date.now().toString().slice(-6);

        if (!trxId) return window.showAlert("Pilih Order terlebih dahulu!", "warning");
        if (nominal <= 0) return window.showAlert("Nominal tidak valid!", "warning");

        let finalChannel = chan;
        if(chan === 'Transfer Bank' && inpRekIdBayar.value) finalChannel = `TF ${inpRekIdBayar.options[inpRekIdBayar.selectedIndex].textContent}`;

        let buktiUrl = null;
        if(inpBuktiBayar?.files.length > 0) { 
            window.showToast("Mengupload bukti...", "info");
            const b64 = await compressImage(inpBuktiBayar.files[0]); 
            buktiUrl = await uploadToGDrive(b64, 'BUKTI_PAY'); 
        }

        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
        const sisa = trx.total_deal - trx.total_paid;
        const realPay = Math.min(nominal, sisa);
        const over = Math.max(0, nominal - sisa);

        const updatedHistory = [...(trx.history_bayar || []), { payId, tgl, nominal, channel: finalChannel, buktiUrl }];
        
        await supabase.from('transaksi').update({ 
            total_paid: trx.total_paid + realPay, 
            total_overpaid: (trx.total_overpaid || 0) + over, 
            history_bayar: updatedHistory 
        }).eq('id', trxId);

        const inserts = [{ 
            id: payId, 
            tipe: 'pemasukan', 
            tanggal: tgl, 
            kategori: 'Pelunasan Order', 
            nominal, 
            channel: finalChannel, 
            related_trx_id: trxId, 
            bukti_url: buktiUrl,
            keterangan: `Pelunasan ${trxId} - ${trx.customer?.nama}`
        }];

        if (finalChannel === 'Saldo Titipan Agen' && trx.agen?.nama) {
            const depId = 'DEP-' + Date.now().toString().slice(-6) + '-USE';
            inserts.push({
                id: depId,
                tipe: 'pengeluaran',
                tanggal: tgl,
                kategori: 'Pemakaian Titipan Agen',
                nominal,
                channel: 'Saldo Titipan Agen',
                agen_name: trx.agen.nama,
                related_trx_id: trxId,
                keterangan: `Pemakaian saldo otomatis untuk ${trxId} - ${trx.customer?.nama}`
            });
        }

        await supabase.from('keuangan').insert(inserts);

        window.showAlert('Pembayaran Berhasil!', 'success', () => { window.location.reload(); });
    };

    const btnSimpanBayar = document.getElementById('btnSimpanBayar');
    if (btnSimpanBayar) btnSimpanBayar.onclick = () => performSaveLunas(false);

    const inpChannelBayar = document.getElementById('inpChannelBayar');
    if (inpChannelBayar) {
        inpChannelBayar.addEventListener('change', async () => {
            const containerRekBayar = document.getElementById('containerRekBayar');
            const inpRekIdBayar = document.getElementById('inpRekIdBayar');
            const infoSaldoTitipan = document.getElementById('infoSaldoTitipan');
            const valSaldoTitipan = document.getElementById('valSaldoTitipan');
            
            // Hide by default
            if (infoSaldoTitipan) infoSaldoTitipan.style.display = 'none';

            if(inpChannelBayar.value === 'Transfer Bank') {
                const reks = await getBankAccounts();
                if (containerRekBayar) containerRekBayar.style.display = 'block';
                if (inpRekIdBayar) {
                    inpRekIdBayar.innerHTML = '<option value="">-- Pilih --</option>';
                    reks.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = `${r.bank} - ${r.norek} (${r.an})`; inpRekIdBayar.appendChild(o); });
                }
            } else if (inpChannelBayar.value === 'Saldo Titipan Agen') {
                if (containerRekBayar) containerRekBayar.style.display = 'none';
                
                const selOrder = document.getElementById('selOrder');
                const trxId = selOrder ? selOrder.value : '';
                if (trxId) {
                    if (valSaldoTitipan) valSaldoTitipan.textContent = 'Memuat...';
                    if (infoSaldoTitipan) infoSaldoTitipan.style.display = 'block';

                    const { data: trx } = await supabase.from('transaksi').select('agen').eq('id', trxId).single();
                    const agenName = trx?.agen?.nama || '';
                    if (agenName) {
                        const { data: fins } = await supabase.from('keuangan').select('nominal, tipe, kategori').eq('agen_name', agenName);
                        let saldo = 0;
                        (fins || []).forEach(f => {
                            const nom = parseFloat(f.nominal) || 0;
                            const isDepositIn = f.kategori === 'Titipan Dana Agen' && f.tipe === 'pemasukan';
                            const isDepositOut = ['Pemakaian Titipan Agen', 'Penarikan Titipan Agen'].includes(f.kategori) || (f.kategori === 'Titipan Dana Agen' && f.tipe === 'pengeluaran');
                            if (isDepositIn) saldo += nom;
                            else if (isDepositOut) saldo -= nom;
                        });
                        if (valSaldoTitipan) valSaldoTitipan.textContent = window.formatRp ? window.formatRp(saldo) : `Rp ${saldo.toLocaleString('id-ID')}`;
                    } else {
                        if (valSaldoTitipan) valSaldoTitipan.textContent = 'Rp 0 (Tanpa Agen)';
                    }
                } else {
                    window.showAlert ? window.showAlert('Pilih Order Terlebih Dahulu', 'warning') : alert('Pilih Order Terlebih Dahulu');
                    inpChannelBayar.value = 'Tunai';
                }
            } else {
                if (containerRekBayar) containerRekBayar.style.display = 'none';
            }
        });
    }

    const inpChannelRefund = document.getElementById('inpChannelRefund');
    if (inpChannelRefund) {
        inpChannelRefund.addEventListener('change', async () => {
            const containerRekRefund = document.getElementById('containerRekRefund');
            const inpRekIdRefund = document.getElementById('inpRekIdRefund');
            if (inpChannelRefund.value === 'Transfer Bank') {
                const reks = await window.getBankAccounts ? await window.getBankAccounts() : await getBankAccounts();
                if (containerRekRefund) containerRekRefund.style.display = 'block';
                if (inpRekIdRefund) {
                    inpRekIdRefund.innerHTML = '<option value="">-- Pilih Rekening --</option>';
                    reks.forEach(r => {
                        const o = document.createElement('option');
                        o.value = r.id;
                        o.textContent = `${r.bank} - ${r.norek} (${r.an})`;
                        inpRekIdRefund.appendChild(o);
                    });
                }
            } else {
                if (containerRekRefund) containerRekRefund.style.display = 'none';
            }
        });
    }

    window.openRefundModal = (trx) => {
        const modal = document.getElementById('modalRefundKelebihan');
        if (!modal) return;
        const surplus = Math.max(trx.total_overpaid || 0, (trx.total_paid || 0) - (trx.total_deal || 0));
        if (document.getElementById('refundTrxId')) document.getElementById('refundTrxId').textContent = trx.id;
        if (document.getElementById('refundKonsumen')) document.getElementById('refundKonsumen').textContent = trx.customer?.nama || '-';
        if (document.getElementById('refundNominal')) document.getElementById('refundNominal').textContent = window.formatRp(surplus);
        if (document.getElementById('inpNominalRefund')) document.getElementById('inpNominalRefund').value = window.formatNum(surplus);
        if (document.getElementById('inpTglRefund')) document.getElementById('inpTglRefund').value = window.getLocalDate();
        modal._trx = trx; modal.classList.add('active');
    };

    const btnSimpanRefund = document.getElementById('btnSimpanRefund');
    if (btnSimpanRefund) {
        btnSimpanRefund.addEventListener('click', async () => {
            const modal = document.getElementById('modalRefundKelebihan');
            const trx = modal._trx;
            const nominal = window.parseNum(document.getElementById('inpNominalRefund').value);
            const tgl = document.getElementById('inpTglRefund').value;
            const chan = document.getElementById('inpChannelRefund').value;
            const rekSelect = document.getElementById('inpRekIdRefund');
            const refId = 'REF-' + Date.now().toString().slice(-6);

            let finalChannel = chan;
            if (chan === 'Transfer Bank' && rekSelect && rekSelect.value) {
                finalChannel = `TF ${rekSelect.options[rekSelect.selectedIndex].textContent}`;
            }

            const oldOver = (trx.total_overpaid || 0);
            const oldPaid = (trx.total_paid || 0);

            const updatedHistory = [...(trx.history_bayar || []), { 
                payId: refId, 
                tgl, 
                nominal: -Math.abs(nominal), 
                channel: finalChannel, 
                category: 'Pengembalian Dana',
                reason: 'MANUAL REFUND'
            }];

            const deductOverpaid = Math.min(nominal, oldOver);
            const deductPaid = nominal - deductOverpaid;

            await supabase.from('transaksi').update({ 
                total_overpaid: Math.max(0, oldOver - deductOverpaid), 
                total_paid: Math.max(0, oldPaid - deductPaid),
                history_bayar: updatedHistory
            }).eq('id', trx.id);

            const inserts = [{ 
                id: refId, 
                tipe: 'pengeluaran', 
                tanggal: tgl, 
                kategori: 'Pengembalian Dana', 
                nominal, 
                channel: finalChannel, 
                related_trx_id: trx.id,
                keterangan: `Refund Kelebihan ${trx.id} - ${trx.customer?.nama}`
            }];

            if (finalChannel === 'Saldo Titipan Agen' && trx.agen?.nama) {
                const depId = 'DEP-' + Date.now().toString().slice(-6) + '-REF';
                inserts.push({
                    id: depId,
                    tipe: 'pemasukan',
                    tanggal: tgl,
                    kategori: 'Titipan Dana Agen',
                    nominal,
                    channel: 'Saldo Titipan Agen',
                    agen_name: trx.agen.nama,
                    related_trx_id: trx.id,
                    keterangan: `Pengembalian refund ke saldo otomatis untuk ${trx.id}`
                });
            }

            await supabase.from('keuangan').insert(inserts);
            
            window.showAlert('Refund Berhasil!', 'success', () => { window.location.reload(); });
        });
    }

    if (document.getElementById('btnCloseRefund')) document.getElementById('btnCloseRefund').addEventListener('click', () => document.getElementById('modalRefundKelebihan').classList.remove('active'));
    if (document.getElementById('btnCancelRefund')) document.getElementById('btnCancelRefund').addEventListener('click', () => document.getElementById('modalRefundKelebihan').classList.remove('active'));

    // Audit Detail
    window.showAuditDetail = async (trxId) => {
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
        if (!trx) return window.showAlert("Data tidak ditemukan.", "danger");
        
        let msg = `<div style="text-align:left; font-size: 0.9rem;">`;
        msg += `<b style="font-size:1.1rem; color:var(--primary);">Audit Keuangan: ${trxId}</b><br><br>`;
        msg += `Konsumen: <b>${trx.customer?.nama || '-'}</b><br>`;
        msg += `Total Deal: <b>${window.formatRp(trx.total_deal)}</b><br>`;
        msg += `Total Dibayar: <b style="color:var(--success);">${window.formatRp(trx.total_paid)}</b><br>`;
        msg += `Kelebihan: <b style="color:var(--warning);">${window.formatRp(trx.total_overpaid || 0)}</b><br><br>`;
        
        msg += `<b style="border-bottom: 2px solid var(--primary);">Rincian Sumber Uang (Sesuai Filter):</b><br>`;
        if (trx.history_bayar && trx.history_bayar.length > 0) {
            trx.history_bayar.forEach(h => {
                msg += `<div style="border-bottom:1px solid rgba(255,255,255,0.1); padding:8px 0;">`;
                msg += `📅 ${formatTgl(h.tgl)}: <b style="color:var(--primary);">${window.formatRp(h.nominal)}</b><br>`;
                msg += `🏷️ Kategori: <b>${h.category || '-'}</b><br>`;
                msg += `📝 Ket: <i>"${h.keterangan || '-'}"</i><br>`;
                msg += `<span style="background:var(--primary); color:#000; padding:2px 4px; border-radius:3px; font-size:0.7rem; font-weight:bold;">SUMBER: ${h.reason || 'MANUAL'}</span>`;
                msg += `</div>`;
            });
        } else {
            msg += `<div style="padding:15px 0;"><i>⚠️ Tidak ada catatan keuangan yang terhubung. Saldo ini mungkin "hantu" atau sisa data lama yang belum tersinkron sempurna.</i></div>`;
        }
        msg += `</div>`;
        window.showAlert(msg, "info");
    };

    if (document.getElementById('btnSyncBalances')) document.getElementById('btnSyncBalances').addEventListener('click', window.syncAllBalances);

    // Initial Load
    await renderStats();
    await renderList();

    // Tab System
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.onclick = function() {
            const tabId = this.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const targetId = 'tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1);
            const target = document.getElementById(targetId);
            if (target) target.classList.add('active');
        };
    });

    // ONE-TIME AUTO-FIX FOR BANA TRX00084
    if (!localStorage.getItem('fixed_bana_1200')) {
        setTimeout(async () => {
            try {
                const depId = 'DEP-' + Date.now().toString().slice(-6) + '-FIX';
                const { error } = await supabase.from('keuangan').insert([{
                    id: depId,
                    tipe: 'pengeluaran',
                    tanggal: window.getLocalDate ? window.getLocalDate() : '2026-05-19',
                    kategori: 'Pemakaian Titipan Agen',
                    nominal: 1200000,
                    channel: 'Saldo Titipan Agen',
                    agen_name: 'Bana',
                    related_trx_id: 'TRX00084',
                    keterangan: 'Pemakaian saldo otomatis untuk TRX00084 (Perbaikan Sistem)'
                }]);
                if (!error) {
                    localStorage.setItem('fixed_bana_1200', 'true');
                    console.log('Auto-fix untuk saldo Bana 1.200.000 berhasil dijalankan.');
                }
            } catch (e) {
                console.error('Gagal menjalankan auto-fix:', e);
            }
        }, 3000);
    }
});
