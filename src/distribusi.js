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

    const user = profile;
    const isAdmin = user.role === 'admin';
    const email = profile.email;
    if (email) {
        const display = document.getElementById('userEmailDisplay');
        if (display) display.textContent = email;
    }

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.href = 'index.html';
    });

    const formatTgl = (iso) => {
        if(!iso) return '-';
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
                body: JSON.stringify({ base64, mimeType: "image/jpeg", fileName: "dist_" + Date.now(), folderName })
            });
            const res = await resp.json(); return res.success ? res.url : null;
        } catch (e) { return null; }
    }

    const getTrips = async () => { const { data } = await supabase.from('master_data').select('val').eq('key', 'TRIPS').single(); return data?.val || []; };
    const containerTrip = document.getElementById('containerTrip');
    const modalTrip = document.getElementById('modalTrip');
    const tableBodySelection = document.getElementById('tableBodySelection');
    
    let cachedTrips = [];
    let cachedGoats = [];
    let cachedTransactions = [];

    const loadData = async (force = false) => {
        if (!force && cachedTrips.length > 0) return { trips: cachedTrips, goats: cachedGoats, trxs: cachedTransactions };
        
        const [
            { data: rawTrips },
            { data: rawGoats },
            { data: rawTrxs }
        ] = await Promise.all([
            supabase.from('master_data').select('val').eq('key', 'TRIPS').single(),
            supabase.from('stok_kambing').select('*'),
            supabase.from('transaksi').select('*')
        ]);
        
        cachedTrips = rawTrips?.val || [];
        cachedGoats = rawGoats || [];
        cachedTransactions = rawTrxs || [];
        return { trips: cachedTrips, goats: cachedGoats, trxs: cachedTransactions };
    };

    const updateStatsDist = (trips, allGoats) => {
        const today = new Date().toISOString().split('T')[0];
        const tripToday = trips.filter(t => t.tglKirim === today).length;
        const waiting = allGoats.filter(k => k.status_transaksi === 'Terjual').length;
        const delivered = allGoats.filter(k => k.status_transaksi === 'Terdistribusi').length;

        const elTripToday = document.getElementById('statTripToday');
        const elWaitDist = document.getElementById('statWaitDist');
        const elDoneDist = document.getElementById('statDoneDist');
        
        if(elTripToday) elTripToday.textContent = `${tripToday} Trip`;
        if(elWaitDist) elWaitDist.textContent = `${waiting} Ekor`;
        if(elDoneDist) elDoneDist.textContent = `${delivered} Ekor`;
    };
    
    async function renderTrips() {
        const { trips, goats } = await loadData();
        if(!containerTrip) return;

        const isSopir = profile?.role === 'sopir';
        
        const filteredTrips = trips.filter(t => {
            if(isSopir && (t.sopirNama||'').toLowerCase() !== (profile.full_name||'').toLowerCase()) return false;
            return true;
        }).sort((a,b) => new Date(b.tglKirim) - new Date(a.tglKirim));

        updateStatsDist(trips, goats);

        containerTrip.innerHTML = '';
        if(!filteredTrips.length) {
            containerTrip.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-muted); background:rgba(255,255,255,0.02); border-radius:15px; border:1px dashed rgba(255,255,255,0.1);">Belum ada rencana perjalanan (Trip) distribusi.</div>';
            return;
        }

        filteredTrips.forEach(t => {
            const card = document.createElement('div');
            card.className = 'trip-card';
            const isDone = t.status === 'Selesai';
            card.innerHTML = `
                <div class="trip-header">
                    <div>
                        <div class="trip-id">${t.id}</div>
                        <div class="trip-date">${formatTgl(t.tglKirim)}</div>
                    </div>
                    <span class="badge ${isDone ? 'badge-success' : 'badge-warning'}" style="padding:4px 10px; font-size:0.7rem;">${t.status.toUpperCase()}</span>
                </div>
                <div class="trip-info" style="font-size:0.85rem; line-height:1.6;">
                    <div style="color:var(--text-main); font-weight:600;">🚚 ${t.sopirNama}</div>
                    <div style="color:var(--text-muted); font-size:0.75rem;">📋 ${t.nopol || '-'} • ${t.note || 'Tanpa catatan'}</div>
                </div>
                <div class="trip-items" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05);">
                    ${t.items.map(i => `
                        <div class="trip-item" style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                            <div style="max-width:70%;">
                                <div style="font-weight:700; color:var(--primary); font-size:0.9rem;">${i.noTali}</div>
                                <div style="font-size:0.75rem; color:var(--text-main); font-weight:500;">${i.konsumen}</div>
                                <div style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📍 ${i.alamat}</div>
                            </div>
                            <div style="text-align:right;">
                                ${i.status === 'Terdistribusi' ? '<span style="color:var(--success); font-size:1.2rem;">✅</span>' : 
                                  `<button class="btn btn-sm btn-shimmer" onclick="window.openLaporDist('${t.id}','${i.goatId}','${i.konsumen}')" style="background:var(--primary); padding:4px 12px; font-size:0.7rem; border-radius:6px; border:none;">Lapor</button>`}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="trip-footer" style="padding-top:0.5rem; justify-content:space-between;">
                     <button class="btn btn-sm" onclick="window.printTrip('${t.id}')" style="background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid rgba(255,255,255,0.1); border-radius:6px;">🖨️ Cetak</button>
                     ${!isSopir ? `<button class="btn btn-sm" onclick="window.deleteTrip('${t.id}')" style="color:var(--danger); background:transparent; border:none; opacity:0.6;">🗑️ Hapus</button>` : ''}
                </div>
            `;
            containerTrip.appendChild(card);
        });
    }

    const saveTrips = async (trips) => {
        await supabase.from('master_data').upsert({ key: 'TRIPS', val: trips });
        cachedTrips = trips;
    };

    window.deleteTrip = async (id) => {
        showConfirm(`Hapus trip ${id}?`, async () => {
            const { trips } = await loadData();
            const filtered = trips.filter(t => t.id !== id);
            await saveTrips(filtered);
            showToast(`Trip ${id} dihapus.`);
            await loadData(true);
            renderTrips();
        });
    };

    window.openLaporDist = (tripId, goatId, nama) => {
        const modal = document.getElementById('modalLaporTuntas');
        document.getElementById('laporKonsumenNama').textContent = nama;
        modal._tripId = tripId; modal._goatId = goatId;
        modal.classList.add('active');
    };

    document.getElementById('btnSimpanBukti')?.addEventListener('click', async () => {
        const modal = document.getElementById('modalLaporTuntas');
        const img = document.getElementById('previewBukti');
        const btn = document.getElementById('btnSimpanBukti');
        
        if (!img.src || img.src.length < 100) return showAlert('Ambil foto bukti dulu!', 'warning');

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Mengunggah...';
            showToast('Mengunggah bukti ke Cloud...', 'info');

            const url = await uploadToGDrive(img.src, 'DISTRIBUSI_FOTO');
            if(!url) throw new Error("Gagal mengunggah foto.");

            const { trips } = await loadData();
            const tIdx = trips.findIndex(t => t.id === modal._tripId);
            const iIdx = trips[tIdx].items.findIndex(i => i.goatId === modal._goatId);

            trips[tIdx].items[iIdx].status = 'Terdistribusi';
            trips[tIdx].items[iIdx].buktiUrl = url;
            trips[tIdx].items[iIdx].tglDistribusi = new Date().toISOString();
            
            if(trips[tIdx].items.every(xi => xi.status === 'Terdistribusi')) {
                trips[tIdx].status = 'Selesai';
            }
            
            await saveTrips(trips);

            await supabase.from('stok_kambing').update({ 
                status_transaksi: 'Terdistribusi', 
                status_fisik: 'Terdistribusi',
                updated_at: new Date().toISOString()
            }).eq('id', modal._goatId);
            
            modal.classList.remove('active');
            showToast('✅ Distribusi tuntas!', 'success');
            await loadData(true);
            renderTrips();

        } catch (err) {
            showAlert('Gagal: ' + err.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Simpan & Lapor Tuntas';
        }
    });

    document.getElementById('btnBuatTrip')?.addEventListener('click', async () => {
        const { goats, trxs } = await loadData();
        const { data: sops } = await supabase.from('master_data').select('val').eq('key', 'SOPIR').single();
        
        const sopirsList = document.getElementById('listSopir');
        sopirsList.innerHTML = '';
        (sops?.val || []).forEach(s => { const o = document.createElement('option'); o.value = s.nama; sopirsList.appendChild(o); });

        const eligible = goats.filter(k => k.status_transaksi === 'Terjual');
        tableBodySelection.innerHTML = '';
        
        if(eligible.length === 0) {
            tableBodySelection.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Tidak ada kambing terjual yang menunggu kirim.</td></tr>';
        }

        const renderTable = (filter = '') => {
            tableBodySelection.innerHTML = '';
            eligible.filter(k => k.no_tali.toLowerCase().includes(filter.toLowerCase())).forEach((k, idx) => {
                const trx = trxs.find(t => t.id === k.transaction_id);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="checkbox" class="goat-checkbox" data-id="${k.id}" data-notali="${k.no_tali}" data-konsumen="${trx?.customer?.nama}" data-alamat="${trx?.delivery?.alamat?.alamat || '-'}"></td>
                    <td>${idx + 1}</td>
                    <td><div style="font-weight:700; color:var(--primary);">${k.no_tali}</div></td>
                    <td>${trx?.customer?.nama || '-'}</td>
                    <td>${trx?.delivery?.alamat?.kab || '-'}</td>
                    <td>${trx?.delivery?.alamat?.kec || trx?.delivery?.alamat?.desa || '-'}</td>
                    <td style="color:var(--danger); font-weight:600;">${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format((trx?.totalDeal || 0) - (trx?.totalPaid || 0))}</td>
                    <td>${formatTgl(trx?.delivery?.tanggal)}</td>
                `;
                tableBodySelection.appendChild(tr);
            });
        };

        renderTable();
        document.getElementById('inpSearchGoat')?.addEventListener('input', (e) => renderTable(e.target.value));
        
        modalTrip.classList.add('active');
        document.getElementById('inpTripTgl').value = new Date().toISOString().split('T')[0];
    });

    document.getElementById('formTrip')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selected = document.querySelectorAll('.goat-checkbox:checked');
        if(!selected.length) return showAlert('Pilih minimal 1 kambing!', 'warning');

        const { trips } = await loadData();
        const newTrip = {
            id: 'TRP-' + Date.now().toString().slice(-6),
            sopirNama: document.getElementById('inpTripSopir').value,
            nopol: document.getElementById('inpTripNopol').value,
            tglKirim: document.getElementById('inpTripTgl').value,
            status: 'Pengiriman',
            note: document.getElementById('inpTripNote').value,
            items: Array.from(selected).map(cb => ({
                goatId: cb.dataset.id, noTali: cb.dataset.notali, konsumen: cb.dataset.konsumen, alamat: cb.dataset.alamat, status: 'Pengiriman'
            }))
        };
        trips.push(newTrip);
        await saveTrips(trips);
        modalTrip.classList.remove('active');
        showToast(`Trip ${newTrip.id} diaktifkan!`);
        await loadData(true);
        renderTrips();
    });

    renderTrips();
});
