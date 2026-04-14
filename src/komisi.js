import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const email = profile.email;
    if (email) {
        const emailEl = document.getElementById('userEmailDisplay');
        if(emailEl) emailEl.textContent = email;
    }

    const loggedUser = profile;
    const GDRIVE_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwVd01SmNkuoUwinekKbDAh3meqs8ZsbR-OZoCBPUcHZ3_jcBQST6p5vrSVJULt_t8/exec';

    // State
    let cachedCommissionTrxs = [];
    let selectedPhotoFile = null; // Sumber utama file bukti

    const formatTgl = (iso) => {
        if (!iso) return '-';
        const p = iso.split('-');
        return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
    };

    async function compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader(); 
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image(); 
                img.src = e.target.result;
                img.onload = () => {
                    const cv = document.createElement('canvas'); 
                    const ctx = cv.getContext('2d');
                    let w = img.width, h = img.height; 
                    const max = 1200;
                    if (w > h) { if (w > max) { h *= max / w; w = max; } } 
                    else { if (h > max) { w *= max / h; h = max; } }
                    cv.width = w; cv.height = h; ctx.drawImage(img, 0, 0, w, h);
                    resolve(cv.toDataURL('image/jpeg', 0.6).split(',')[1]);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }

    async function uploadToGDrive(base64, folderName) {
        try {
            const resp = await fetch(GDRIVE_PROXY_URL, {
                method: 'POST',
                body: JSON.stringify({ base64, mimeType: "image/jpeg", fileName: "kom_" + Date.now(), folderName })
            });
            const res = await resp.json(); 
            return res.success ? res.url : null;
        } catch (e) { 
            console.error("GDrive Upload Error:", e);
            return null; 
        }
    }

    const getBankAccounts = async () => { 
        const { data } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single(); 
        if (data && data.val && data.val.length > 0) return data.val;
        
        const { data: oldData } = await supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single();
        return oldData?.val || [];
    };

    const inpBuktiKomisi = document.getElementById('inpBuktiKomisi');
    const previewBuktiKomisi = document.getElementById('previewBuktiKomisi');
    const imgPreviewKomisi = previewBuktiKomisi ? previewBuktiKomisi.querySelector('img') : null;
    const btnRemoveKomisiPhoto = document.getElementById('btnRemoveKomisiPhoto');
    const btnOpenCameraKomisi = document.getElementById('btnOpenCameraKomisi');

    const getTrxData = async (force = false) => {
        if (!force && cachedCommissionTrxs.length > 0) return cachedCommissionTrxs;

        const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).single();
        const { data: trxs } = await supabase.from('transaksi').select('*');
        
        let filtered = trxs || [];
        if (profile?.role === 'agen' || profile?.permissions?.strictAgen) {
            filtered = filtered.filter(t => t.agen && t.agen.id === profile.linked_agen_id);
        }
        
        cachedCommissionTrxs = filtered.filter(t => t.komisi && t.komisi.berhak === true);
        return cachedCommissionTrxs;
    };

    const updateStatsKomisi = (list) => {
        let total = 0, lunas = 0, belum = 0; 
        const agens = new Set();
        list.forEach(t => {
            const n = parseFloat(t.komisi.nominal) || 0;
            total += n;
            if(t.komisi.status === 'lunas') lunas += n; else belum += n;
            if(t.agen?.nama) agens.add(t.agen.nama);
        });

        const elTotal = document.getElementById('statTotalKomisi');
        const elLunas = document.getElementById('statKomisiLunas');
        const elBelum = document.getElementById('statKomisiBelum');
        const elJml = document.getElementById('statJmlAgen');
        if(elTotal) elTotal.textContent = window.formatRp(total);
        if(elLunas) elLunas.textContent = window.formatRp(lunas);
        if(elBelum) elBelum.textContent = window.formatRp(belum);
        if(elJml) elJml.textContent = agens.size;
    };

    const renderTabel = (list) => {
        const tbody = document.getElementById('tableBodyKomisi');
        if (!tbody) return;
        tbody.innerHTML = '';

        const searchQuery = document.getElementById('inpSearchKomisi')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('filterStatusKomisi')?.value || '';

        const filtered = list.filter(t => {
            const matchSearch = String(t.id).toLowerCase().includes(searchQuery) ||
                              String(t.agen?.nama || '').toLowerCase().includes(searchQuery) ||
                              String(t.customer?.nama || '').toLowerCase().includes(searchQuery);
            const matchStatus = !statusFilter || t.komisi.status === statusFilter;
            return matchSearch && matchStatus;
        });

        filtered.sort((a,b) => b.id.localeCompare(a.id)).forEach(t => {
            const tr = document.createElement('tr');
            const isLunas = t.komisi.status === 'lunas';
            const totalDeal = parseFloat(t.total_deal || t.totalDeal || 0);
            const totalPaid = parseFloat(t.total_paid || t.totalPaid || 0);
            const nominalKomisi = parseFloat(t.komisi.nominal) || 0;
            const canPay = totalPaid > nominalKomisi;
            const btnLabel = isLunas ? '💸 Cairkan' : (canPay ? '💸 Cairkan (DP)' : '⌛ Tunggu DP > Komisi');
            
            tr.innerHTML = `
                <td><div style="font-weight:700; color:var(--primary);">${t.id}</div><div style="font-size:0.7rem; color:var(--text-muted);">${formatTgl(t.tgl_trx || t.tglTrx)}</div></td>
                <td><div style="font-weight:600;">${t.agen?.nama || '-'}</div><div style="font-size:0.7rem; color:var(--text-muted);">${t.agen?.tipe || ''}</div></td>
                <td>${t.customer?.nama || '-'}</td>
                <td>${window.formatRp(totalDeal)}</td>
                <td style="color:#f59e0b; font-weight:800;">${window.formatRp(t.komisi.nominal)}</td>
                <td><div style="font-size:0.8rem;">${t.komisi.metodePembayaran || 'Akhir'}</div></td>
                <td><span class="badge ${isLunas ? 'badge-success' : 'badge-warning'}" style="font-size:0.7rem; padding:4px 8px;">${isLunas ? 'LUNAS' : 'OUTSTANDING'}</span></td>
                <td style="text-align:right; white-space:nowrap;">
                    ${isLunas ? 
                        `
                        ${t.komisi.buktiUrl ? `
                            <button class="btn btn-sm" onclick="window.viewPhoto('${t.komisi.buktiUrl}')" style="background:rgba(16,185,129,0.1); color:var(--success); border:1px solid rgba(16,185,129,0.2); margin-right:4px;" title="Lihat Bukti Transfer">🖼️</button>
                        ` : ''}
                        <button class="btn btn-sm btn-shimmer" style="background:rgba(244,63,94,0.1); color:var(--danger); border:1px solid rgba(244,63,94,0.2);" onclick="window.rollbackKomisi('${t.id}')">↩️</button>
                        ` : 
                        `<button class="btn btn-sm btn-shimmer" ${!canPay ? 'disabled style="background:rgba(255,255,255,0.05); color:var(--text-muted);"' : 'style="background:var(--primary); color:#ffffff; font-size:0.75rem; border:none; padding:4px 10px;"'} onclick="window.openBayarKomisi('${t.id}')">
                            ${btnLabel}
                        </button>`
                    }
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    window.openBayarKomisi = async (id) => {
        const trxs = await getTrxData();
        const t = trxs.find(x => x.id === id);
        if(!t) return;

        // Reset Photo State
        selectedPhotoFile = null;
        if(inpBuktiKomisi) inpBuktiKomisi.value = '';
        if(previewBuktiKomisi) previewBuktiKomisi.style.display = 'none';

        const modal = document.getElementById('modalBayarKomisi');
        document.getElementById('bayarModalInfo').innerHTML = `
            <div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                <div style="color:var(--text-muted); font-size:0.75rem;">TRANSAKSI</div>
                <div style="font-weight:700; margin-bottom:0.5rem;">${t.id} - ${t.customer.nama}</div>
                <div style="color:var(--text-muted); font-size:0.75rem;">AGEN BERHAK</div>
                <div style="font-weight:700; color:var(--primary);">${t.agen.nama}</div>
            </div>
            <div style="margin-top:1rem; text-align:center;">
                <div style="font-size:0.85rem; color:var(--text-muted);">NOMINAL KOMISI</div>
                <div style="font-size:1.6rem; font-weight:800; color:#f59e0b;">${window.formatRp(t.komisi.nominal)}</div>
            </div>
        `;
        modal._trxId = id; modal._nom = t.komisi.nominal; modal.classList.add('active');
        document.getElementById('inpTglBayarKomisi').value = new Date().toISOString().split('T')[0];
    };

    document.getElementById('btnKonfirmasiBayar')?.addEventListener('click', async () => {
        const modal = document.getElementById('modalBayarKomisi');
        const id = modal._trxId; 
        const nom = modal._nom;
        const tgl = document.getElementById('inpTglBayarKomisi').value;
        const chan = document.getElementById('inpChannelBayarKomisi').value;
        const btn = document.getElementById('btnKonfirmasiBayar');
        
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Memproses...';

            let photoUrl = null;
            if (selectedPhotoFile) {
                window.showToast('📸 Mengompres & Mengunggah bukti...', 'info');
                try {
                    const b64 = await compressImage(selectedPhotoFile);
                    photoUrl = await uploadToGDrive(b64, "BUKTI_KOMISI");
                } catch (err) {
                    console.error("Upload failed details:", err);
                    window.showToast('Gagal memproses foto, menggunakan data tanpa bukti.', 'warning');
                }
            }

            let finalChan = chan;
            if(chan === 'Transfer Bank') {
                const sel = document.getElementById('inpRekIdKomisi');
                finalChan = 'TF ' + sel.options[sel.selectedIndex].textContent;
            }

            const trxs = await getTrxData();
            const trx = trxs.find(x => x.id === id);
            const totalDeal = parseFloat(trx.total_deal || trx.totalDeal || 0);
            const totalPaid = parseFloat(trx.total_paid || trx.totalPaid || 0);
            const isUpfront = (totalDeal - totalPaid) > 1000;

            const updatedKomisi = { ...trx.komisi, status: 'lunas', tglBayar: tgl, isUpfront, buktiUrl: photoUrl };
            
            await supabase.from('transaksi').update({ komisi: updatedKomisi, updated_at: new Date().toISOString() }).eq('id', id);
            await supabase.from('keuangan').insert([{
                id: 'KMS-'+Date.now().toString().slice(-6), tipe: 'pengeluaran', tanggal: tgl,
                kategori: 'Komisi Agen', nominal: nom, channel: finalChan, related_trx_id: id,
                keterangan: `Bayar Komisi ${trx.agen.nama} (${id}) ${isUpfront ? '(Upfront)' : ''}`,
                bukti_url: photoUrl
            }]);

            showToast('✅ Komisi berhasil dicairkan!');
            modal.classList.remove('active');
            await getTrxData(true);
            init();
        } catch (e) {
            showAlert('Gagal mencairkan komisi: ' + e.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 Konfirmasi Pembayaran';
        }
    });

    window.rollbackKomisi = async (id) => {
        showConfirm(`Batalkan status lunas komisi ${id}?`, async () => {
            const trxs = await getTrxData();
            const trx = trxs.find(x => x.id === id);
            // Hapus buktiUrl juga saat rollback
            const updated = { ...trx.komisi, status: 'belum_bayar', tglBayar: null, buktiUrl: null };
            await supabase.from('transaksi').update({ komisi: updated, updated_at: new Date().toISOString() }).eq('id', id);
            await supabase.from('keuangan').delete().eq('related_trx_id', id).eq('kategori', 'Komisi Agen');
            showToast('✅ Pembayaran komisi dibatalkan.');
            await getTrxData(true);
            init();
        });
    };

    // Photo Listeners
    inpBuktiKomisi?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file) {
            selectedPhotoFile = file;
            const reader = new FileReader();
            reader.onload = (ev) => {
                if(imgPreviewKomisi) imgPreviewKomisi.src = ev.target.result;
                if(previewBuktiKomisi) previewBuktiKomisi.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        }
    });

    btnRemoveKomisiPhoto?.addEventListener('click', () => {
        selectedPhotoFile = null;
        if(inpBuktiKomisi) inpBuktiKomisi.value = '';
        if(previewBuktiKomisi) previewBuktiKomisi.style.display = 'none';
    });

    btnOpenCameraKomisi?.addEventListener('click', () => {
        if(window.openCameraUI) {
            window.openCameraUI((file) => {
                selectedPhotoFile = file;
                // Tetap update preview UI
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if(imgPreviewKomisi) imgPreviewKomisi.src = ev.target.result;
                    if(previewBuktiKomisi) previewBuktiKomisi.style.display = 'flex';
                };
                reader.readAsDataURL(file);
                
                // Opsional: sync ke input file (sering gagal di mobile, makanya kita pakai selectedPhotoFile)
                try {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    if(inpBuktiKomisi) {
                        inpBuktiKomisi.files = dt.files;
                    }
                } catch(e) {}
            });
        }
    });

    // Main Init
    const init = async () => {
        const list = await getTrxData();
        updateStatsKomisi(list);
        renderTabel(list);
    };

    // Event Listeners
    document.getElementById('btnCloseBayarModal')?.addEventListener('click', () => document.getElementById('modalBayarKomisi').classList.remove('active'));
    document.getElementById('btnBatalBayar')?.addEventListener('click', () => document.getElementById('modalBayarKomisi').classList.remove('active'));

    document.getElementById('inpChannelBayarKomisi')?.addEventListener('change', async () => {
        const chan = document.getElementById('inpChannelBayarKomisi').value;
        const container = document.getElementById('containerRekKomisi');
        const sel = document.getElementById('inpRekIdKomisi');
        
        if (chan === 'Transfer Bank') {
            const reks = await getBankAccounts();
            container.style.display = 'block';
            sel.innerHTML = '<option value="">-- Pilih Rekening --</option>';
            reks.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `${r.bank} - ${r.norek} (${r.an})`;
                sel.appendChild(opt);
            });
        } else {
            container.style.display = 'none';
        }
    });

    document.getElementById('inpSearchKomisi')?.addEventListener('input', () => renderTabel(cachedCommissionTrxs));
    document.getElementById('filterStatusKomisi')?.addEventListener('change', () => renderTabel(cachedCommissionTrxs));
    
    // Sorting
    document.querySelectorAll('.sort-header').forEach(h => {
        h.addEventListener('click', () => {
            const col = h.getAttribute('data-column');
            // Simple sorting implementation
            const list = [...cachedCommissionTrxs].sort((a,b) => {
                if(col === 'id') return b.id.localeCompare(a.id);
                return 0;
            });
            renderTabel(list);
        });
    });

    // Tab Logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            const el = document.getElementById(target);
            if(el) el.classList.add('active');

            const list = await getTrxData();
            if(target === 'tabSaldoAgen') renderRekapPerAgen(list);
            if(target === 'tabRekap') renderRekapBulanan(list);
        });
    });

    function renderRekapPerAgen(list) {
        const agens = {};
        list.forEach(t => {
            const id = t.agen?.id || 'unknown';
            const nama = t.agen?.nama || 'Tanpa Agen';
            const tipe = t.agen?.tipe || '-';
            if(!agens[id]) agens[id] = { nama, tipe, total:0, lunas:0, belum:0, trx:0 };
            
            const n = parseFloat(t.komisi?.nominal) || 0;
            agens[id].total += n;
            agens[id].trx++;
            if(t.komisi?.status === 'lunas') agens[id].lunas += n;
            else agens[id].belum += n;
        });

        const container = document.getElementById('containerSaldoAgen');
        if(!container) return;
        
        container.innerHTML = Object.values(agens).map(a => `
            <div class="rekap-card">
                <div class="rekap-card-header" style="margin-bottom:0.5rem;">
                    <div>
                        <div class="rekap-agen-name" style="color:var(--text-main); font-size:1.1rem;">${a.nama}</div>
                        <div class="rekap-agen-tipe" style="color:var(--primary); font-weight:700;">${a.tipe}</div>
                    </div>
                </div>
                <div class="rekap-row"><span class="rekap-row-label">Total Transaksi</span><span class="rekap-row-value">${a.trx} Ekor</span></div>
                <div class="rekap-row"><span class="rekap-row-label">Total Hak Komisi</span><span class="rekap-row-value">${window.formatRp(a.total)}</span></div>
                <div class="rekap-row"><span class="rekap-row-label">Sudah Dibayar</span><span class="rekap-row-value" style="color:var(--success)">${window.formatRp(a.lunas)}</span></div>
                <div class="rekap-row" style="border-top:2px dashed rgba(255,255,255,0.05); padding-top:0.75rem; margin-top:0.2rem;"><span class="rekap-row-label" style="font-weight:700; color:var(--warning);">Sisa Outstanding</span><span class="rekap-row-value" style="color:var(--warning); font-weight:800; font-size:1.1rem;">${window.formatRp(a.belum)}</span></div>
            </div>
        `).join('') || `<div style="padding:2rem; text-align:center; color:var(--text-muted); width:100%;">Belum ada data.</div>`;
    }

    function renderRekapBulanan(list) {
        const months = {};
        list.forEach(t => {
            const dateStr = t.tgl_trx || t.tglTrx;
            if(!dateStr) return;
            const d = new Date(dateStr);
            const mKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            if(!months[mKey]) months[mKey] = { lunas:0, belum:0, total:0 };
            
            const n = parseFloat(t.komisi?.nominal) || 0;
            months[mKey].total += n;
            if(t.komisi?.status === 'lunas') months[mKey].lunas += n;
            else months[mKey].belum += n;
        });

        const grid = document.getElementById('rekapGrid');
        if(!grid) return;

        grid.innerHTML = Object.keys(months).sort().reverse().map(m => {
            const [y, mo] = m.split('-');
            const mName = new Date(y, parseInt(mo)-1).toLocaleString('id-ID', {month:'long', year:'numeric'});
            const obj = months[m];

            return `
            <div class="rekap-card" style="border-left:4px solid var(--primary);">
                <div class="rekap-card-header" style="margin-bottom:0.5rem;">
                    <div>
                        <div class="rekap-agen-name" style="color:var(--primary); font-size:1.1rem;">🗓️ ${mName}</div>
                    </div>
                </div>
                <div class="rekap-row"><span class="rekap-row-label">Akumulasi Komisi</span><span class="rekap-row-value">${window.formatRp(obj.total)}</span></div>
                <div class="rekap-row"><span class="rekap-row-label">Tercairkan (Lunas)</span><span class="rekap-row-value" style="color:var(--success)">${window.formatRp(obj.lunas)}</span></div>
                <div class="rekap-row" style="background:rgba(245,158,11,0.05); padding:8px; border-radius:6px; margin-top:8px;"><span class="rekap-row-label" style="color:var(--warning); font-weight:700;">Outstanding Bulan Ini</span><span class="rekap-row-value" style="color:var(--warning); font-weight:800;">${window.formatRp(obj.belum)}</span></div>
            </div>
            `;
        }).join('') || `<div style="padding:2rem; text-align:center; color:var(--text-muted); width:100%;">Belum ada data bulanan.</div>`;
    }

    init();
});
