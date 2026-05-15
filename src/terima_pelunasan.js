import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; 

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    // Helpers
    const formatTgl = (iso) => {
        if (!iso) return '-';
        const p = iso.split('-');
        return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
    };

    const GDRIVE_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwVd01SmNkuoUwinekKbDAh3meqs8ZsbR-OZoCBPUcHZ3_jcBQST6p5vrSVJULt_t8/exec';

    async function compressImage(file) {
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

    async function uploadToGDrive(base64, folderName) {
        try {
            const response = await fetch(GDRIVE_PROXY_URL, {
                method: 'POST',
                body: JSON.stringify({ base64, mimeType: "image/jpeg", fileName: "pay_" + Date.now(), folderName })
            });
            const result = await response.json();
            return result.success ? result.url : null;
        } catch (e) { console.error('GDrive failed:', e); return null; }
    }

    const getTrxData = async () => { const { data } = await supabase.from('transaksi').select('*'); return data || []; };
    const getBankAccounts = async () => { 
        const { data } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single(); 
        return data?.val || [];
    };

    const getAgentSaldo = async (agenName) => {
        if (!agenName) return 0;
        const { data } = await supabase.from('keuangan').select('nominal, tipe, kategori').eq('agen_name', agenName);
        let saldo = 0;
        (data || []).forEach(f => {
            const nom = parseFloat(f.nominal) || 0;
            const isDepositIn = f.kategori === 'Titipan Dana Agen' && f.tipe === 'pemasukan';
            const isDepositOut = ['Pemakaian Titipan Agen', 'Penarikan Titipan Agen'].includes(f.kategori) || (f.kategori === 'Titipan Dana Agen' && f.tipe === 'pengeluaran');
            if (isDepositIn) saldo += nom;
            else if (isDepositOut) saldo -= nom;
        });
        return saldo;
    };

    const selOrder = document.getElementById('selOrder');
    const boxInfoOrder = document.getElementById('boxInfoOrder');
    const gridInfoOrder = document.getElementById('gridInfoOrder');
    const boxHistoriPay = document.getElementById('boxHistoriPay');
    const listHistoriPay = document.getElementById('listHistoriPay');
    const formBayar = document.getElementById('formBayar');
    const inpNominalBayar = document.getElementById('inpNominalBayar');
    const inpChannelBayar = document.getElementById('inpChannelBayar');
    const inpTglBayar = document.getElementById('inpTglBayar');
    const btnSimpanBayar = document.getElementById('btnSimpanBayar');
    const tableBodyBelumLunas = document.getElementById('tableBodyBelumLunas');
    const inpSearchOrder = document.getElementById('inpSearchOrder');
    const containerRekBayar = document.getElementById('containerRekBayar');
    const inpRekIdBayar = document.getElementById('inpRekIdBayar');
    const inpBuktiBayar = document.getElementById('inpBuktiBayar');
    const previewBuktiBayar = document.getElementById('previewBuktiBayar');
    const tableBodyOverpaid = document.getElementById('tableBodyOverpaid');
    const badgeOverpaidCount = document.getElementById('badgeOverpaidCount');

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

        document.getElementById('statJmlBelumLunas').textContent = belumLunas.length + ' Order';
        document.getElementById('statTotalSisa').textContent = window.formatRp(totalSisa);
        document.getElementById('statTotalPaid').textContent = window.formatRp(totalPaid);
    };

    const renderList = async () => {
        const trxs = await getTrxData();
        const keyword = (inpSearchOrder.value || '').toLowerCase();
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

        tableBodyBelumLunas.innerHTML = belumLunas.length === 0 ? '<tr><td colspan="5" style="text-align:center;">Semua lunas!</td></tr>' : '';
        belumLunas.forEach(t => tableBodyBelumLunas.appendChild(createOrderRow(t, 'belum')));

        tableBodyOverpaid.innerHTML = overpaid.length === 0 ? '<tr><td colspan="4" style="text-align:center;">Tidak ada kelebihan bayar</td></tr>' : '';
        overpaid.forEach(t => tableBodyOverpaid.appendChild(createOrderRow(t, 'overpaid')));
        
        badgeOverpaidCount.textContent = overpaid.length;
        badgeOverpaidCount.style.display = overpaid.length > 0 ? 'inline-block' : 'none';
    };

    const createOrderRow = (t, type) => {
        const sisa = (t.total_deal || 0) - (t.total_paid || 0);
        const pct = Math.round(((t.total_paid || 0) / (t.total_deal || 1)) * 100);
        const tr = document.createElement('tr');
        tr.dataset.id = t.id;
        tr.style.cursor = 'pointer';
        
        if (type === 'belum') {
            tr.innerHTML = `
                <td data-label="ID ORDER" style="font-weight:700; color:var(--primary);">${t.id}</td>
                <td data-label="KONSUMEN" style="text-align:right;">
                    <div style="font-weight:600;">${t.customer.nama || '-'}</div>
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
                selOrder.value = t.id;
                selOrder.dispatchEvent(new Event('input'));
            };
        } else {
            tr.innerHTML = `
                <td data-label="ID ORDER" style="font-weight:700; color:var(--primary);">${t.id}</td>
                <td data-label="KONSUMEN" style="text-align:right;">
                    <div style="font-weight:600;">${t.customer.nama || '-'}</div>
                    <div style="font-size:0.7rem; color:var(--primary);">Agen: ${t.agen?.nama || '-'}</div>
                </td>
                <td data-label="KELEBIHAN" style="font-weight:700; color:var(--warning); cursor:pointer;" onclick="window.showAuditDetail('${t.id}')">
                    ${window.formatRp(Math.max(t.total_overpaid || 0, (t.total_paid || 0) - (t.total_deal || 0)))}
                </td>
                <td data-label="AKSI"><button class="btn btn-sm">💸</button></td>
            `;
            tr.onclick = (e) => {
                if (e.target.closest('td').dataset.label === 'KELEBIHAN') return;
                openRefundModal(t);
            };
        }
        return tr;
    };

    selOrder.addEventListener('input', async () => {
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', selOrder.value).single();
        if(!trx) { boxInfoOrder.style.display = 'none'; formBayar.style.display = 'none'; return; }
        const sisa = trx.total_deal - trx.total_paid;
        gridInfoOrder.innerHTML = `
            <div class="info-card"><div class="label">Konsumen</div><div class="value">${trx.customer.nama}</div></div>
            <div class="info-card"><div class="label">Total Deal</div><div class="value">${window.formatRp(trx.total_deal)}</div></div>
            <div class="info-card"><div class="label">Pernah Bayar</div><div class="value" style="cursor:pointer;" onclick="window.showAuditDetail('${trx.id}')">${window.formatRp(trx.total_paid)}</div></div>
            <div class="info-card" style="background:rgba(245,158,11,0.05);"><div class="label" style="color:var(--warning);">SISA TAGIHAN</div><div class="value" style="color:var(--warning); font-size:1.5rem;">${window.formatRp(sisa)}</div></div>
        `;
        
        listHistoriPay.innerHTML = '';
        (trx.history_bayar || []).forEach(h => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `<span>• ${formatTgl(h.tgl)}: ${window.formatRp(h.nominal)} (${h.channel})</span>`;
            listHistoriPay.appendChild(div);
        });
        boxHistoriPay.style.display = (trx.history_bayar?.length > 0) ? 'block' : 'none';
        inpNominalBayar.value = window.formatNum(sisa);
        boxInfoOrder.style.display = 'block'; formBayar.style.display = 'block';
    });

    const performSaveLunas = async (sendWA) => {
        const trxId = selOrder.value;
        const nominal = window.parseNum(inpNominalBayar.value);
        const chan = inpChannelBayar.value;
        const tgl = inpTglBayar.value;
        const payId = 'PAY-' + Date.now().toString().slice(-6);

        let finalChannel = chan;
        if(chan === 'Transfer Bank' && inpRekIdBayar.value) finalChannel = `TF ${inpRekIdBayar.options[inpRekIdBayar.selectedIndex].textContent}`;

        let buktiUrl = null;
        if(inpBuktiBayar?.files.length > 0) { const b64 = await compressImage(inpBuktiBayar.files[0]); buktiUrl = await uploadToGDrive(b64, 'BUKTI_PAY'); }

        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
        const sisa = trx.total_deal - trx.total_paid;
        const realPay = Math.min(nominal, sisa);
        const over = Math.max(0, nominal - sisa);

        const updatedHistory = [...(trx.history_bayar || []), { payId, tgl, nominal, channel: finalChannel, buktiUrl }];
        await supabase.from('transaksi').update({ total_paid: trx.total_paid + realPay, total_overpaid: (trx.total_overpaid || 0) + over, history_bayar: updatedHistory }).eq('id', trxId);
        await supabase.from('keuangan').insert([{ id: payId, tipe: 'pemasukan', tanggal: tgl, kategori: 'Pelunasan Order', nominal, channel: finalChannel, related_trx_id: trxId, bukti_url: buktiUrl }]);

        window.showAlert('Pembayaran Berhasil!', 'success', () => { window.location.reload(); });
    };

    btnSimpanBayar.onclick = () => performSaveLunas(false);

    inpChannelBayar.addEventListener('change', async () => {
        if(inpChannelBayar.value === 'Transfer Bank') {
            const reks = await getBankAccounts();
            containerRekBayar.style.display = 'block';
            inpRekIdBayar.innerHTML = '<option value="">-- Pilih --</option>';
            reks.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = `${r.bank} - ${r.norek} (${r.an})`; inpRekIdBayar.appendChild(o); });
        } else containerRekBayar.style.display = 'none';
    });

    const openRefundModal = (trx) => {
        const modal = document.getElementById('modalRefundKelebihan');
        const surplus = (trx.total_overpaid || 0);
        document.getElementById('refundTrxId').textContent = trx.id;
        document.getElementById('refundKonsumen').textContent = trx.customer.nama;
        document.getElementById('refundNominal').textContent = window.formatRp(surplus);
        document.getElementById('inpNominalRefund').value = window.formatNum(surplus);
        modal._trx = trx; modal.classList.add('active');
    };

    document.getElementById('btnSimpanRefund')?.addEventListener('click', async () => {
        const modal = document.getElementById('modalRefundKelebihan');
        const trx = modal._trx;
        const nominal = window.parseNum(document.getElementById('inpNominalRefund').value);
        const tgl = document.getElementById('inpTglRefund').value;
        const chan = document.getElementById('inpChannelRefund').value;
        const refId = 'REF-' + Date.now().toString().slice(-6);

        const oldOver = (trx.total_overpaid || 0);
        const oldPaid = (trx.total_paid || 0);
        const deal = (trx.total_deal || 0);

        let fromOver = Math.min(nominal, oldOver);
        let remaining = nominal - fromOver;
        let fromPaid = Math.min(remaining, Math.max(0, oldPaid - deal));

        await supabase.from('transaksi').update({ total_overpaid: oldOver - fromOver, total_paid: oldPaid - fromPaid }).eq('id', trx.id);
        await supabase.from('keuangan').insert([{ id: refId, tipe: 'pengeluaran', tanggal: tgl, kategori: 'Pengembalian Dana', nominal, channel: chan, related_trx_id: trx.id }]);
        
        window.showAlert('Refund Berhasil!', 'success', () => { window.location.reload(); });
    });

    document.getElementById('btnCloseRefund')?.addEventListener('click', () => {
        document.getElementById('modalRefundKelebihan').classList.remove('active');
    });
    document.getElementById('btnCancelRefund')?.addEventListener('click', () => {
        document.getElementById('modalRefundKelebihan').classList.remove('active');
    });

    // Audit & Sync Logic
    window.showAuditDetail = async (trxId) => {
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
        if (!trx) return window.showAlert("Data tidak ditemukan.", "danger");
        
        let msg = `<b>Audit Keuangan: ${trxId}</b><br><br>`;
        msg += `Total Deal: ${window.formatRp(trx.total_deal)}<br>`;
        msg += `Total Dibayar: ${window.formatRp(trx.total_paid)}<br><br>`;
        msg += `<b>History Catatan:</b><br>`;
        if (trx.history_bayar && trx.history_bayar.length > 0) {
            trx.history_bayar.forEach(h => {
                msg += `• ${formatTgl(h.tgl)}: ${window.formatRp(h.nominal)} (${h.channel || h.keterangan || '?'})<br>`;
            });
        } else {
            msg += `<i>Tidak ada catatan keuangan yang terdeteksi.</i>`;
        }
        window.showAlert(msg, "info");
    };

    window.syncAllBalances = async () => {
        window.showConfirm(`🚀 <b>JALANKAN MEGA-SYNC v11.6?</b><br><br>Sistem akan menghitung ulang semua saldo dari nol berdasarkan laporan keuangan.`, async () => {
            try {
                window.showToast("Sinkronisasi sedang berjalan...", "info");
                const { data: trxs } = await supabase.from('transaksi').select('*');
                const { data: allFins } = await supabase.from('keuangan').select('*');
                
                for (const trx of trxs) {
                    const tId = trx.id.toUpperCase();
                    const rawName = (trx.customer?.nama || '').toLowerCase().trim();
                    const honorifics = ['haji', 'hj', 'pak', 'bpk', 'ibu', 'ny', 'tn', 'kak', 'bang', 'mas', 'mbak'];
                    const nameParts = rawName.split(' ').filter(p => p.length >= 3 && !honorifics.includes(p));
                    
                    const logs = [];
                    const history = (allFins || []).filter(f => {
                        const fId = (f.related_trx_id || '').toUpperCase();
                        const fDesc = (f.keterangan || '').toLowerCase();
                        const fCat = (f.kategori || '').toLowerCase();
                        
                        // 1. HARD MATCH: ID Transaksi (Haram diambil orang lain jika fId diisi)
                        if (fId === tId) return true;
                        if (fId && fId !== tId) return false; // Sudah milik orang lain
                        
                        // 2. ID Match via Keterangan
                        if (fDesc.includes(tId.toLowerCase())) return true;

                        // 3. FUZZY MATCH: Nama (Hanya jika fId kosong)
                        if (!fId) {
                            // Nama Lengkap
                            if (rawName.length > 4 && (fDesc.includes(rawName) || fCat.includes(rawName))) return true;
                            // Nama Panggilan Unik
                            if (nameParts.length > 0) {
                                return nameParts.some(p => p.length >= 4 && fDesc.includes(p));
                            }
                        }
                        
                        return false;
                    }));

                    let total = history.reduce((sum, h) => {
                        const cat = (h.category || '').toLowerCase();
                        if (h.tipe === 'pemasukan') {
                            if (cat.includes('komisi') || cat.includes('karkas')) return sum;
                            return sum + h.nominal;
                        } else {
                            if (cat.includes('refund') || cat.includes('tarik')) return sum + h.nominal;
                            return sum;
                        }
                    }, 0);

                    let finalPaid = Math.max(0, total);
                    if (total === 0 && history.length === 0) finalPaid = Math.max(0, trx.total_paid || 0);

                    await supabase.from('transaksi').update({
                        total_paid: finalPaid,
                        total_overpaid: Math.max(0, finalPaid - trx.total_deal),
                        history_bayar: history
                    }).eq('id', trx.id);
                }
                window.showAlert("Sinkronisasi Selesai!", "success", () => window.location.reload());
            } catch (err) {
                window.showAlert("Error: " + err.message, "danger");
            }
        });
    };

    document.getElementById('btnSyncBalances')?.addEventListener('click', window.syncAllBalances);

    // Initial Load
    await renderStats();
    await renderList();

    // --- TAB SYSTEM (AT THE VERY END) ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.onclick = function() {
            const tabId = this.dataset.tab;
            console.log('Switching to tab:', tabId);
            
            // Toggle Buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Toggle Contents
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const targetId = 'tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1);
            const target = document.getElementById(targetId);
            if (target) target.classList.add('active');
        };
    });
});
