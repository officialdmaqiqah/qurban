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
    const isAdmin = loggedUser.role === 'admin';

    const formatRp = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
    const formatTgl = (iso) => {
        if (!iso) return '-';
        const p = iso.split('-');
        return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
    };

    const GDRIVE_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwVd01SmNkuoUwinekKbDAh3meqs8ZsbR-OZoCBPUcHZ3_jcBQST6p5vrSVJULt_t8/exec';

    async function compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader(); reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image(); img.src = e.target.result;
                img.onload = () => {
                    const cv = document.createElement('canvas'); const ctx = cv.getContext('2d');
                    let w = img.width, h = img.height; const max = 800;
                    if (w > h) { if (w > max) { h *= max / w; w = max; } } else { if (h > max) { w *= max / h; h = max; } }
                    cv.width = w; cv.height = h; ctx.drawImage(img, 0, 0, w, h);
                    resolve(cv.toDataURL('image/jpeg', 0.6).split(',')[1]);
                };
            };
        });
    }

    async function uploadToGDrive(base64, folderName) {
        try {
            const resp = await fetch(GDRIVE_PROXY_URL, {
                method: 'POST',
                body: JSON.stringify({ base64, mimeType: "image/jpeg", fileName: "kom_" + Date.now(), folderName })
            });
            const res = await resp.json(); return res.success ? res.url : null;
        } catch (e) { return null; }
    }

    const getBankAccounts = async () => { 
        const { data } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single(); 
        if (data && data.val && data.val.length > 0) return data.val;
        
        const { data: oldData } = await supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single();
        return oldData?.val || [];
    };
    let cachedCommissionTrxs = [];

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
        let total = 0, lunas = 0, belum = 0; const agens = new Set();
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

        if(elTotal) elTotal.textContent = formatRp(total);
        if(elLunas) elLunas.textContent = formatRp(lunas);
        if(elBelum) elBelum.textContent = formatRp(belum);
        if(elJml) elJml.textContent = agens.size;
    };

    let currentSort = { column: 'id', direction: 'desc' };

    const renderTabel = (list) => {
        const tbody = document.getElementById('tableBodyKomisi');
        if(!tbody) return; 
        
        const keyword = (document.getElementById('inpSearchKomisi')?.value || '').toLowerCase();
        const statusFlt = document.getElementById('filterStatusKomisi')?.value;

        let filtered = [...list];
        if(keyword) {
            filtered = filtered.filter(t => 
                t.id.toLowerCase().includes(keyword) || 
                (t.agen?.nama||'').toLowerCase().includes(keyword) ||
                (t.customer?.nama||'').toLowerCase().includes(keyword)
            );
        }
        if(statusFlt) filtered = filtered.filter(t => t.komisi.status === statusFlt);

        filtered.sort((a,b) => {
            let vA = a[currentSort.column], vB = b[currentSort.column];
            if (currentSort.column === 'tglTrx') {
                vA = new Date(vA); vB = new Date(vB);
            }
            return currentSort.direction === 'asc' ? (vA < vB ? -1 : 1) : (vA > vB ? -1 : 1);
        });

        tbody.innerHTML = '';
        if(filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:var(--text-muted);">Tidak ada data komisi ditemukan.</td></tr>`;
            return;
        }

        filtered.forEach(t => {
            const tr = document.createElement('tr');
            const isLunas = t.komisi.status === 'lunas';
            const totalDeal = parseFloat(t.total_deal || t.totalDeal || 0);
            const totalPaid = parseFloat(t.total_paid || t.totalPaid || 0);
            const sisa = totalDeal - totalPaid;
            const canPay = sisa <= 1000; // Allow 1000 tolerance for rounding
            
            tr.innerHTML = `
                <td><div style="font-weight:700; color:var(--primary);">${t.id}</div><div style="font-size:0.7rem; color:var(--text-muted);">${formatTgl(t.tgl_trx || t.tglTrx)}</div></td>
                <td><div style="font-weight:600;">${t.agen?.nama || '-'}</div><div style="font-size:0.7rem; color:var(--text-muted);">${t.agen?.tipe || ''}</div></td>
                <td>${t.customer?.nama || '-'}</td>
                <td>${formatRp(totalDeal)}</td>
                <td style="color:#f59e0b; font-weight:800;">${formatRp(t.komisi.nominal)}</td>
                <td><div style="font-size:0.8rem;">${t.komisi.metodePembayaran || 'Akhir'}</div></td>
                <td><span class="badge ${isLunas ? 'badge-success' : 'badge-warning'}" style="font-size:0.7rem; padding:4px 8px;">${isLunas ? 'LUNAS' : 'OUTSTANDING'}</span></td>
                <td style="text-align:right;">
                    ${isLunas ? 
                        `<button class="btn btn-sm btn-shimmer" style="background:rgba(244,63,94,0.1); color:var(--danger); border:1px solid rgba(244,63,94,0.2);" onclick="window.rollbackKomisi('${t.id}')">↩️</button>` : 
                        `<button class="btn btn-sm btn-shimmer" ${!canPay ? 'disabled style="background:rgba(255,255,255,0.05); color:var(--text-muted);"' : 'style="background:var(--primary); font-size:0.75rem; border:none; padding:4px 10px;"'} onclick="window.openBayarKomisi('${t.id}')">
                            ${canPay ? '💸 Cairkan' : '⌛ Tunggu Lunas'}
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
                <div style="font-size:1.6rem; font-weight:800; color:#f59e0b;">${formatRp(t.komisi.nominal)}</div>
            </div>
        `;
        modal._trxId = id; modal._nom = t.komisi.nominal; modal.classList.add('active');
        document.getElementById('inpTglBayarKomisi').value = new Date().toISOString().split('T')[0];
    };

    document.getElementById('btnKonfirmasiBayar')?.addEventListener('click', async () => {
        const modal = document.getElementById('modalBayarKomisi');
        const id = modal._trxId; const nom = modal._nom;
        const tgl = document.getElementById('inpTglBayarKomisi').value;
        const chan = document.getElementById('inpChannelBayarKomisi').value;
        const btn = document.getElementById('btnKonfirmasiBayar');
        
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Memproses...';

            let finalChan = chan;
            if(chan === 'Transfer Bank') {
                const sel = document.getElementById('inpRekIdKomisi');
                finalChan = 'TF ' + sel.options[sel.selectedIndex].textContent;
            }

            const trxs = await getTrxData();
            const trx = trxs.find(x => x.id === id);
            const updatedKomisi = { ...trx.komisi, status: 'lunas', tglBayar: tgl };
            
            await supabase.from('transaksi').update({ komisi: updatedKomisi, updated_at: new Date().toISOString() }).eq('id', id);
            await supabase.from('keuangan').insert([{
                id: 'KMS-'+Date.now().toString().slice(-6), tipe: 'pengeluaran', tanggal: tgl,
                kategori: 'Komisi Agen', nominal: nom, channel: finalChan, related_trx_id: id,
                keterangan: `Bayar Komisi ${trx.agen.nama} (${id})`
            }]);

            showToast('✅ Komisi berhasil dicairkan!');
            modal.classList.remove('active');
            await getTrxData(true);
            init();
        } catch (e) {
            showAlert('Gagal mencairkan komisi: ' + e.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Konfirmasi & Cairkan';
        }
    });

    window.rollbackKomisi = async (id) => {
        showConfirm(`Batalkan status lunas komisi ${id}?`, async () => {
            const trxs = await getTrxData();
            const trx = trxs.find(x => x.id === id);
            const updated = { ...trx.komisi, status: 'belum_bayar', tglBayar: null };
            await supabase.from('transaksi').update({ komisi: updated, updated_at: new Date().toISOString() }).eq('id', id);
            await supabase.from('keuangan').delete().eq('related_trx_id', id).eq('kategori', 'Komisi Agen');
            showToast('✅ Pembayaran komisi dibatalkan.');
            await getTrxData(true);
            init();
        });
    };

    const init = async () => {
        const list = await getTrxData();
        updateStatsKomisi(list);
        renderTabel(list);
    };

    // Modal Close Listeners
    document.getElementById('btnCloseBayarModal')?.addEventListener('click', () => document.getElementById('modalBayarKomisi').classList.remove('active'));
    document.getElementById('btnBatalBayar')?.addEventListener('click', () => document.getElementById('modalBayarKomisi').classList.remove('active'));

    // Channel Payment Listener
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

    document.getElementById('inpSearchKomisi')?.addEventListener('input', async () => renderTabel(await getTrxData()));
    document.getElementById('filterStatusKomisi')?.addEventListener('change', async () => renderTabel(await getTrxData()));
    
    init();
});
