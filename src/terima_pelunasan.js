import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout.js handles redirect

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const email = profile.email;
    if (email) document.getElementById('userEmailDisplay').textContent = email;


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

    // DB Helpers
    const getTrxData = async () => { const { data } = await supabase.from('transaksi').select('*'); return data || []; };
    const getBankAccounts = async () => { 
        const { data } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single(); 
        if (data && data.val && data.val.length > 0) return data.val;
        
        // Fallback to old key
        const { data: oldData } = await supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single();
        return oldData?.val || [];
    };
    const getAgenDb = async () => { const { data } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single(); return data?.val || []; };

    const getAgentSaldo = async (agenName) => {
        if (!agenName) return 0;
        const { data } = await supabase.from('keuangan').select('nominal, tipe, kategori').eq('agen_name', agenName);
        let saldo = 0;
        (data || []).forEach(f => {
            const isOut = f.kategori !== 'Titipan Dana Agen' || f.tipe === 'pengeluaran';
            saldo += (isOut ? -1 : 1) * (parseFloat(f.nominal) || 0);
        });
        return saldo;
    };

    const selOrder = document.getElementById('selOrder');
    const boxInfoOrder = document.getElementById('boxInfoOrder');
    const gridInfoOrder = document.getElementById('gridInfoOrder');
    const displaySisa = document.getElementById('displaySisa');
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
    const btnOpenCameraTP = document.getElementById('btnOpenCameraTP');
    const btnRemoveTPPhoto = document.getElementById('btnRemoveTPPhoto');
    const tableBodyOverpaid = document.getElementById('tableBodyOverpaid');
    const badgeOverpaidCount = document.getElementById('badgeOverpaidCount');

    // Set default date
    if(inpTglBayar) inpTglBayar.value = window.getLocalDate();

    // setupMoneyMask will be called at the end of file for all IDs

    const renderStats = async () => {
        const { data: trxs } = await supabase.from('transaksi').select('*');
        const userRole = (profile?.role || '').toLowerCase().replace(/_/g, ' ').trim();
        const isAdmin = ['admin', 'office', 'staf', 'operator'].includes(userRole);
        const linkedAgenId = profile?.linked_agen_id;
        let filtered = isAdmin ? trxs : trxs.filter(t => t.agen?.id === linkedAgenId);

        const belumLunas = filtered.filter(t => (t.total_deal - t.total_paid) > 0);
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

        const belumLunas = filtered.filter(t => (t.total_deal - t.total_paid) > 0).sort((a,b) => new Date(b.tgl_trx) - new Date(a.tgl_trx));
        const overpaid = filtered.filter(t => (t.total_overpaid || 0) > 0 || (t.total_paid > t.total_deal)).sort((a,b) => new Date(b.tgl_trx) - new Date(a.tgl_trx));

        tableBodyBelumLunas.innerHTML = belumLunas.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:1.5rem; font-size:0.8rem; color:var(--text-muted);">Semua lunas!</td></tr>' : '';
        belumLunas.forEach(t => tableBodyBelumLunas.appendChild(createOrderRow(t, 'belum')));

        tableBodyOverpaid.innerHTML = overpaid.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:1rem; font-size:0.75rem; color:var(--text-muted);">Tidak ada kelebihan bayar</td></tr>' : '';
        overpaid.forEach(t => tableBodyOverpaid.appendChild(createOrderRow(t, 'overpaid')));
        
        badgeOverpaidCount.textContent = overpaid.length;
        badgeOverpaidCount.style.display = overpaid.length > 0 ? 'inline-block' : 'none';
        
        // Highlight active row if any
        if (selOrder.value) {
            const rows = tableBodyBelumLunas.querySelectorAll('tr');
            rows.forEach(r => {
                if(r.dataset.id === selOrder.value) r.classList.add('row-selected');
                else r.classList.remove('row-selected');
            });
        }
    };

    const createOrderRow = (t, type) => {
        const sisa = (t.total_deal || 0) - (t.total_paid || 0);
        const pct = Math.round(((t.total_paid || 0) / (t.total_deal || 1)) * 100);
        const tr = document.createElement('tr');
        tr.dataset.id = t.id;
        tr.style.cursor = 'pointer';
        
        if (type === 'belum') {
            tr.innerHTML = `
                <td style="font-weight:700; color:var(--primary);">${t.id}</td>
                <td>
                    <div style="font-weight:600;">${t.customer.nama || '-'}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">${formatTgl(t.tgl_trx)}</div>
                </td>
                <td style="font-weight:700; color:var(--warning);">${window.formatRp(sisa)}</td>
                <td style="min-width:100px;">
                    <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:2px;">Terbayar ${pct}%</div>
                    <div style="background:rgba(255,255,255,0.06); height:6px; border-radius:4px; width:100%;">
                        <div style="width:${Math.min(100, pct)}%; height:100%; background:var(--success); border-radius:4px;"></div>
                    </div>
                </td>
                <td><button class="btn btn-sm" style="padding:4px 10px; font-size:0.75rem; background:rgba(16,185,129,0.15); color:var(--success); border:1px solid rgba(16,185,129,0.3);">Pilih</button></td>
            `;
            tr.onclick = () => {
                // Clear selected state from all rows
                tableBodyBelumLunas.querySelectorAll('tr').forEach(r => r.classList.remove('row-selected'));
                tr.classList.add('row-selected');
                
                selOrder.value = t.id;
                selOrder.dispatchEvent(new Event('input'));
                
                // Scroll the form into view if on mobile
                if (window.innerWidth <= 768) {
                    document.querySelector('.card-box').scrollIntoView({ behavior: 'smooth' });
                }
            };
        } else {
            tr.innerHTML = `
                <td style="font-weight:700; color:var(--primary);">${t.id}</td>
                <td>${t.customer.nama || '-'}</td>
                <td style="font-weight:700; color:var(--warning);">${window.formatRp((t.total_overpaid || 0) + Math.max(0, t.total_paid - t.total_deal))}</td>
                <td><button class="btn btn-sm" style="padding:4px 10px; font-size:0.75rem; background:rgba(245,158,11,0.15); color:var(--warning); border:1px solid rgba(245,158,11,0.3);">Refund</button></td>
            `;
            tr.onclick = () => openRefundModal(t);
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
            <div class="info-card"><div class="label">Pernah Bayar</div><div class="value">${window.formatRp(trx.total_paid)}</div></div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.25rem;">SALDO SISA:</div>
            <div class="sisa-big" id="displaySisa">${window.formatRp(sisa)}</div>
        `;
        listHistoriPay.innerHTML = '';
        (trx.history_bayar || []).forEach(h => {
             const div = document.createElement('div'); div.className = 'history-item';
             div.innerHTML = `<div><strong>${window.formatRp(h.nominal)}</strong> via ${h.channel}<br><small>${formatTgl(h.tgl)}</small></div> <button class="btn-sm" onclick="window.deleteHistoryItem('${trx.id}', '${h.payId}', ${h.nominal})">🗑️</button>`;
             listHistoriPay.appendChild(div);
        });
        boxHistoriPay.style.display = (trx.history_bayar?.length > 0) ? 'block' : 'none';
        inpNominalBayar.value = window.formatNum(sisa);
        boxInfoOrder.style.display = 'block'; formBayar.style.display = 'block';
    });

    window.deleteHistoryItem = async (trxId, payId, nominal) => {
        window.showConfirm('Hapus riwayat?', async () => {
            const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
            const updatedHistory = trx.history_bayar.filter(h => h.payId !== payId);
            await supabase.from('transaksi').update({ total_paid: trx.total_paid - nominal, history_bayar: updatedHistory }).eq('id', trxId);
            await supabase.from('keuangan').delete().eq('id', payId);
            selOrder.dispatchEvent(new Event('input')); renderStats(); renderList();
        });
    };

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
        
        if (chan === 'Saldo Titipan Agen') {
            const agenName = trx.agen.nama;
            const currentSaldo = await getAgentSaldo(agenName);
            if (currentSaldo < nominal) throw new Error(`Saldo Titipan Agen tidak cukup. Tersedia: ${window.formatRp(currentSaldo)}`);

            const payIdCommon = 'PAY-' + Date.now();
            await supabase.from('keuangan').insert([
                { 
                    id: payIdCommon + '-OUT', 
                    tipe: 'pengeluaran', 
                    tanggal: tgl, 
                    kategori: 'Pemakaian Titipan Agen', 
                    nominal, 
                    channel: 'Saldo Titipan', 
                    related_trx_id: trxId, 
                    agen_name: agenName,
                    keterangan: `Pemakaian titipan untuk Pelunasan Order ${trxId}`
                },
                { 
                    id: payIdCommon + '-IN', 
                    tipe: 'pemasukan', 
                    tanggal: tgl, 
                    kategori: 'Pelunasan Order', 
                    nominal, 
                    channel: 'Saldo Titipan', 
                    related_trx_id: trxId, 
                    agen_name: agenName,
                    keterangan: `Pelunasan via Titipan Agen`
                }
            ]);
        } else {
            await supabase.from('keuangan').insert([{ id: payId, tipe: 'pemasukan', tanggal: tgl, kategori: 'Pelunasan Order', nominal, channel: finalChannel, related_trx_id: trxId, bukti_url: buktiUrl }]);
        }

        if (sendWA && typeof window.sendWa === 'function') {
            try {
                const config = await window.getWaConfig();
                const waTarget = trx.customer.wa1 || trx.customer.wa2;
                const agens = await getAgenDb();
                const matchedAgen = agens.find(a => a.id === trx.agen.id || a.nama === trx.agen.nama);
                const agentTipe = (trx.agen?.tipe || matchedAgen?.jenis || '').toUpperCase();
                const skipCustWA = agentTipe.includes('DM') || agentTipe.includes('EXT');
                // Fetch Official Accounts
                const reks = await getBankAccounts();
                const rekStr = (reks || []).map(r => `${r.bank} — ${r.norek} (a.n ${r.an})`).join('\n');

                const infoAgen = matchedAgen ? `${matchedAgen.nama} (${matchedAgen.wa || '-'})` : (trx.agen?.nama || '-');
                const commonData = { 
                    nama: trx.customer.nama, 
                    id: trx.id, 
                    nominal: window.formatRp(nominal), 
                    sisa: window.formatRp(sisa - realPay),
                    rekening: rekStr || '-',
                    info_agen: infoAgen
                };

                // Hanya kirim ke Konsumen jika BUKAN agen DM/EXT
                if (waTarget && !skipCustWA) {
                    const msgCust = await window.parseWaTemplate(config.templateLunas, commonData);
                    const res = await window.sendWa(waTarget, msgCust);
                    if (!res.success) {
                        window.showConfirm(`WA Konsumen Gagal: ${res.msg}\n\nIngin kirim manual?`, () => {
                            window.open(res.link, '_blank');
                        }, null, 'WA Gateway Masalah', 'Kirim Manual', 'btn-primary');
                    }
                }

                if (matchedAgen?.wa) {
                    const msgAgen = await window.parseWaTemplate(config.templateLunasAgent, { ...commonData, nama_agen: matchedAgen.nama });
                    const resA = await window.sendWa(matchedAgen.wa, msgAgen);
                    if (!resA.success) {
                        window.showToast('WA ke Agen gagal dikirim otomatis.', 'warning');
                    }

                    // Kirim Notifikasi Saldo Terpotong jika pakai Titipan
                    if (chan === 'Saldo Titipan Agen') {
                        const currentSaldo = await getAgentSaldo(matchedAgen.nama);
                        const msgSaldo = `*NOTIFIKASI SALDO TITIPAN*\n\nHalo ${matchedAgen.nama},\nSaldo titipan Anda telah terpotong sebesar *${window.formatRp(nominal)}* untuk pelunasan *${trxId}*.\n\nSisa saldo titipan Anda saat ini: *${window.formatRp(currentSaldo)}*.\n\nTerima kasih.`;
                        await window.sendWa(matchedAgen.wa, msgSaldo);
                    }
                }
            } catch (e) {
                console.error('WA Lunas Err:', e);
            }
        }

        window.showAlert('Pembayaran Berhasil!', 'success', () => { selOrder.value = ''; boxInfoOrder.style.display = 'none'; formBayar.style.display = 'none'; renderStats(); renderList(); });
    };

    // --- CAMERA & BUKTI BAYAR LOGIC ---
    btnOpenCameraTP?.addEventListener('click', () => {
        if(typeof window.openCameraUI === 'function') {
            window.openCameraUI(async (file) => {
                const dt = new DataTransfer();
                dt.items.add(file);
                if(inpBuktiBayar) inpBuktiBayar.files = dt.files;
                
                if(previewBuktiBayar) {
                    const previewImg = previewBuktiBayar.querySelector('img');
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if(previewImg) previewImg.src = e.target.result;
                        previewBuktiBayar.style.display = 'flex';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    });

    inpBuktiBayar?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && previewBuktiBayar) {
            const previewImg = previewBuktiBayar.querySelector('img');
            const reader = new FileReader();
            reader.onload = (re) => {
                if(previewImg) previewImg.src = re.target.result;
                previewBuktiBayar.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        }
    });

    btnRemoveTPPhoto?.addEventListener('click', () => {
        if(inpBuktiBayar) inpBuktiBayar.value = '';
        if(previewBuktiBayar) {
            previewBuktiBayar.style.display = 'none';
            const img = previewBuktiBayar.querySelector('img');
            if(img) img.src = '';
        }
    });

    btnSimpanBayar.onclick = () => window.showChoice("Kirim WA resi?", [{ text: "Ya, Kirim", callback: () => performSaveLunas(true) }, { text: "Simpan Saja", callback: () => performSaveLunas(false) }]);

    inpChannelBayar.addEventListener('change', async () => {
        const infoDiv = document.getElementById('infoSaldoTitipan');
        const valSpan = document.getElementById('valSaldoTitipan');
        if (infoDiv) infoDiv.style.display = 'none';

        if(inpChannelBayar.value === 'Transfer Bank') {
            const reks = await getBankAccounts();
            containerRekBayar.style.display = 'block';
            inpRekIdBayar.innerHTML = '<option value="">-- Pilih --</option>';
            reks.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = `${r.bank} - ${r.norek} (${r.an})`; inpRekIdBayar.appendChild(o); });
        } else if (inpChannelBayar.value === 'Saldo Titipan Agen') {
            containerRekBayar.style.display = 'none';
            const trxId = selOrder.value;
            if (!trxId) {
                window.showToast('Pilih Order Terlebih Dahulu', 'warning');
                inpChannelBayar.value = 'Tunai';
                return;
            }
            const { data: trx } = await supabase.from('transaksi').select('agen').eq('id', trxId).single();
            const agenName = trx?.agen?.nama || '';
            
            if (infoDiv && valSpan && agenName) {
                infoDiv.style.display = 'block';
                valSpan.textContent = 'Memuat...';
                const saldo = await getAgentSaldo(agenName);
                valSpan.textContent = window.formatRp(saldo);
            }
        } else containerRekBayar.style.display = 'none';
    });

    const openRefundModal = (trx) => {
        const modal = document.getElementById('modalRefundKelebihan');
        const surplus = (trx.total_overpaid || 0) + Math.max(0, trx.total_paid - trx.total_deal);
        document.getElementById('refundTrxId').textContent = trx.id;
        document.getElementById('refundKonsumen').textContent = trx.customer.nama;
        document.getElementById('refundNominal').textContent = window.formatRp(surplus);
        document.getElementById('inpNominalRefund').value = window.formatNum(surplus);
        modal._trx = trx; modal.classList.add('active');
    };

    document.getElementById('btnCloseRefund')?.addEventListener('click', () => {
        document.getElementById('modalRefundKelebihan').classList.remove('active');
    });
    document.getElementById('btnCancelRefund')?.addEventListener('click', () => {
        document.getElementById('modalRefundKelebihan').classList.remove('active');
    });

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

        await supabase.from('transaksi').update({ 
            total_overpaid: oldOver - fromOver,
            total_paid: oldPaid - fromPaid
        }).eq('id', trx.id);
        await supabase.from('keuangan').insert([{ id: refId, tipe: 'pengeluaran', tanggal: tgl, kategori: 'Pengembalian Dana', nominal, channel: chan, related_trx_id: trx.id, keterangan: 'Refund kelebihan '+trx.id }]);
        
        modal.classList.remove('active');
        window.showAlert('Refund Berhasil!', 'success', () => { renderStats(); renderList(); });
    });

    const inpChannelRefund = document.getElementById('inpChannelRefund');
    if (inpChannelRefund) {
        inpChannelRefund.onchange = () => {
            const safeguard = document.getElementById('safeguardRefund');
            if (safeguard) {
                safeguard.style.display = (inpChannelRefund.value === 'Kas Operasional') ? 'block' : 'none';
            }
        };
    }

    const inpChannelBayar = document.getElementById('inpChannelBayar');
    if (inpChannelBayar) {
        inpChannelBayar.onchange = () => {
            const safeguard = document.getElementById('safeguardPay');
            if (safeguard) {
                safeguard.style.display = (inpChannelBayar.value === 'Kas Operasional') ? 'block' : 'none';
            }
            // Original logic for Saldo Titipan info
            const boxSaldo = document.getElementById('infoSaldoTitipan');
            if (inpChannelBayar.value === 'Saldo Titipan Agen') {
                if (boxSaldo) boxSaldo.style.display = 'block';
            } else {
                if (boxSaldo) boxSaldo.style.display = 'none';
            }
        };
    }

    // Populate Datalist
    const trxsAll = await getTrxData();
    const listOrders = document.getElementById('listOrders');
    if(listOrders) {
        listOrders.innerHTML = '';
        trxsAll.forEach(t => { 
            const o = document.createElement('option'); 
            o.value = t.id; 
            o.textContent = `${t.id} - ${t.customer?.nama || ''} [Agen: ${t.agen?.nama || '-'}] | Sisa: ${window.formatRp(t.total_deal - t.total_paid)}`; 
            listOrders.appendChild(o); 
        });
    }

    // Tab System Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.onclick = () => {
            const tabId = btn.dataset.tab;
            
            // Toggle buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle contents
            tabContents.forEach(content => {
                if (content.id === 'tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1)) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        };
    });

    // Event Search
    inpSearchOrder.addEventListener('input', renderList);

    // --- REPAIR TOOL: SYNC BALANCES ---
    const syncAllBalances = async () => {
        window.showConfirm("🔄 Sinkronkan ulang seluruh saldo order berdasarkan riwayat pembayaran?<br><br><small>Ini akan memperbaiki data yang tidak sinkron (seperti data Aziz) akibat penghapusan transaksi manual sebelumnya.</small>", async () => {
            window.showToast("Memulai sinkronisasi...", "info");
            try {
                const { data: trxs, error } = await supabase.from('transaksi').select('*');
                if (error) throw error;

                let updatedCount = 0;
                for (const trx of trxs) {
                    const history = trx.history_bayar || [];
                    const calcPaid = history.reduce((s, h) => s + (parseFloat(h.nominal) || 0), 0);
                    const calcOver = Math.max(0, calcPaid - (trx.total_deal || 0));

                    if (calcPaid !== trx.total_paid || calcOver !== trx.total_overpaid) {
                        await supabase.from('transaksi').update({
                            total_paid: calcPaid,
                            total_overpaid: calcOver,
                            updated_at: new Date().toISOString()
                        }).eq('id', trx.id);
                        updatedCount++;
                    }
                }

                window.showAlert(`Sinkronisasi selesai! <b>${updatedCount}</b> data berhasil diperbaiki.`, "success", () => {
                    window.location.reload();
                });
            } catch (err) {
                console.error("Sync Error:", err);
                window.showAlert("Gagal sinkronisasi: " + err.message, "danger");
            }
        }, null, "Sinkronisasi Saldo", "Ya, Sinkronkan", "btn-warning");
    };

    document.getElementById('btnSyncBalances')?.addEventListener('click', syncAllBalances);

    window.setupMoneyMask('inpNominalBayar');
    window.setupMoneyMask('inpNominalRefund');

    renderStats(); renderList();
});
