import { supabase } from './supabase.js';

const BB_REGIONS = {
    "Kota Pangkalpinang": ["Bukit Intan", "Gabek", "Gerunggang", "Girimaya", "Pangkal Balam", "Rangkui", "Taman Sari"],
    "Kab. Bangka": ["Bakam", "Belinyu", "Mendo Barat", "Merawang", "Pemali", "Puding Besar", "Riau Silip", "Sungai Liat"],
    "Kab. Bangka Barat": ["Jebus", "Kelapa", "Mentok", "Parittiga", "Simpang Teritip", "Tempilang"],
    "Kab. Bangka Tengah": ["Koba", "Lubuk Besar", "Namang", "Pangkalan Baru", "Simpang Katis", "Sungai Selan"],
    "Kab. Bangka Selatan": ["Air Gegas", "Kepulauan Pongok", "Lepar Pongok", "Payung", "Pulau Besar", "Simpang Rimba", "Toboali", "Tukak Sadai"],
    "Kab. Belitung": ["Badau", "Membalong", "Selat Nasik", "Sijuk", "Tanjung Pandan"],
    "Kab. Belitung Timur": ["Damar", "Dendang", "Gantung", "Kelapa Kampit", "Manggar", "Simpang Pesak", "Simpang Renggiang"]
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout.js handles redirect

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const email = profile.email;
    if (email) document.getElementById('userEmailDisplay').textContent = email;

    const isAdmin = profile.role === 'admin';
    const userRole = (profile.role || '').toLowerCase();
    const isMarketingRole = ['reseller', 'marketing_dm', 'marketing_ext', 'marketing_kandang'].includes(userRole);

    // GOOGLE DRIVE INTEGRATION
    const GDRIVE_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwVd01SmNkuoUwinekKbDAh3meqs8ZsbR-OZoCBPUcHZ3_jcBQST6p5vrSVJULt_t8/exec';

    function getDirectDriveLink(url) {
        if (!url) return '';
        if (!url.includes('drive.google.com')) return url;
        let fileId = '';
        const matchFile = url.match(/\/file\/d\/([^\/?]+)/);
        const matchId = url.match(/[?&]id=([^&]+)/);
        if (matchFile) fileId = matchFile[1];
        else if (matchId) fileId = matchId[1];
        return fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : url;
    }

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
                body: JSON.stringify({ base64: base64, mimeType: "image/jpeg", fileName: "dp_" + Date.now(), folderName: folderName })
            });
            const result = await response.json();
            return result.success ? getDirectDriveLink(result.url) : null;
        } catch (error) { console.error('GDrive Upload failed:', error); return null; }
    }

    // DB Helpers
    const getKambingDb = async () => { const { data } = await supabase.from('stok_kambing').select('*'); return data || []; };
    const getTrxDb = async () => { const { data } = await supabase.from('transaksi').select('*'); return data || []; };
    const getAgenDb = async () => { const { data } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single(); return data?.val || []; };
    const getRekeningDb = async () => { const { data } = await supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single(); return data?.val || []; };

    const tableBody = document.getElementById('tableBodyTransaksi');
    const modalKeluar = document.getElementById('modalKeluar');
    const formTerjual = document.getElementById('formTerjual');
    const inpAgenId = document.getElementById('inpAgenId');
    const inpCustKab = document.getElementById('inpCustKab');
    const inpCustKec = document.getElementById('inpCustKec');
    const inpSearchKambing = document.getElementById('inpSearchKambing');
    const listKambing = document.getElementById('listKambing');
    const btnAddKambing = document.getElementById('btnAddKambing');
    const cartContainer = document.getElementById('cartContainer');
    const displayTotalDeal = document.getElementById('displayTotalDeal');
    const inpTotalBayarAwal = document.getElementById('inpTotalBayarAwal');
    const inpChannelDP = document.getElementById('inpChannelDP');
    const containerRekDP = document.getElementById('containerRekDP');
    const inpRekIdDP = document.getElementById('inpRekIdDP');
    const inpBuktiDP = document.getElementById('inpBuktiDP');
    const previewBuktiDP = document.getElementById('previewBuktiDP');
    const btnOpenCameraDP = document.getElementById('btnOpenCameraDP');
    const btnRemoveDP = document.getElementById('btnRemoveDP');
    const imgPreviewDP = document.getElementById('imgPreviewDP');

    const modalLunas = document.getElementById('modalLunas');
    const selOrderLunas = document.getElementById('selOrderLunas');
    const infoOrderLunas = document.getElementById('infoOrderLunas');
    const detailOrderLunas = document.getElementById('detailOrderLunas');
    const historiPayLunas = document.getElementById('historiPayLunas');
    const formInputLunas = document.getElementById('formInputLunas');
    const inpNominalLunas = document.getElementById('inpNominalLunas');
    const inpChannelLunas = document.getElementById('inpChannelLunas');
    const inpRekIdLunas = document.getElementById('inpRekIdLunas');
    const containerRekLunas = document.getElementById('containerRekLunas');
    const inpTglLunas = document.getElementById('inpTglLunas');
    const btnSimpanLunas = document.getElementById('btnSimpanLunas');
    const inpGlobalSearch = document.getElementById('inpSearch');

    const sectionKomisi = document.getElementById('sectionKomisi');
    const labelKomisiAgen = document.getElementById('labelKomisiAgen');
    const komisiBaseDeal = document.getElementById('komisiBaseDeal');
    const komisiNominalDisplay = document.getElementById('komisiNominalDisplay');
    const komisiNettDisplay = document.getElementById('komisiNettDisplay');
    const inpKomisiNominal = document.getElementById('inpKomisiNominal');

    let currentSort = { column: 'id', direction: 'desc' };
    let currentCart = [];
    let currentAgenTipeKomisi = false;
    const TIPE_BERHAK_KOMISI_UPPER = ['MARKETING KANDANG', 'RESELLER'];

    const formatNum = (v) => Math.round(v || 0).toLocaleString('id-ID');
    const parseNum = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;
    const formatTgl = (iso) => { if(!iso) return '-'; const p = iso.split('-'); return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso; };
    const formatRp = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);

    const generateTrxId = async () => {
        const { data } = await supabase.from('transaksi').select('id').order('id', { ascending: false }).limit(1);
        let maxNum = data && data.length > 0 ? parseInt(data[0].id.replace('TRX', '')) || 0 : 0;
        return 'TRX' + (maxNum + 1).toString().padStart(5, '0');
    };

    // RBAC: Hide "New Order" button immediately for marketing roles
    const btnTambah = document.getElementById('btnTambahTerjual');
    if (isMarketingRole && btnTambah) {
        btnTambah.remove(); // Completely remove from DOM for marketing roles
    }

    const initForm = async () => {
        const userRole = (profile.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const linkedAgenId = profile.linked_agen_id;

        const agens = await getAgenDb();
        inpAgenId.innerHTML = '<option value="">-- Pilih Agen --</option>';
        agens.forEach(a => {
            const opt = document.createElement('option');
            opt.value = `${a.nama} - ${a.jenis || 'Agen'}`;
            opt.textContent = `${a.nama} — ${a.jenis || 'Agen'}`;
            if (userRole === 'agen' && a.id === linkedAgenId) opt.selected = true;
            inpAgenId.appendChild(opt);
        });
        if (userRole === 'agen') { inpAgenId.disabled = true; setTimeout(() => handleAgenChange(), 100); } else { inpAgenId.disabled = false; }
        inpCustKab.innerHTML = '<option value="">-- Pilih Kabupaten --</option>' + Object.keys(BB_REGIONS).map(k => `<option value="${k}">${k}</option>`).join('');
        await refreshKambingDropdown();
        currentCart = []; currentAgenTipeKomisi = false;
        sectionKomisi?.classList.remove('active');
        if(inpKomisiNominal) inpKomisiNominal.value = '0';
        if(inpTotalBayarAwal) inpTotalBayarAwal.value = '';
        
        // Reset Photo
        if(inpBuktiDP) inpBuktiDP.value = '';
        if(previewBuktiDP) previewBuktiDP.style.display = 'none';
        if(imgPreviewDP) imgPreviewDP.src = '';
        
        renderCart();
    };

    // --- PHOTO LISTENERS ---
    if (inpBuktiDP) {
        inpBuktiDP.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    if(imgPreviewDP) {
                        imgPreviewDP.src = re.target.result;
                        imgPreviewDP.style.display = 'block';
                    }
                    if(previewBuktiDP) previewBuktiDP.style.display = 'flex';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (btnOpenCameraDP) {
        btnOpenCameraDP.addEventListener('click', () => {
            window.openCameraUI((file) => {
                const dt = new DataTransfer();
                dt.items.add(file);
                if (inpBuktiDP) {
                    inpBuktiDP.files = dt.files;
                    inpBuktiDP.dispatchEvent(new Event('change'));
                }
            });
        });
    }

    if (btnRemoveDP) {
        btnRemoveDP.addEventListener('click', () => {
            if(inpBuktiDP) inpBuktiDP.value = '';
            if(previewBuktiDP) previewBuktiDP.style.display = 'none';
            if(imgPreviewDP) imgPreviewDP.src = '';
        });
    }

    const refreshKambingDropdown = async () => {
        const db = await getKambingDb();
        const available = db.filter(k => k.status_transaksi === 'Tersedia' && !k.transaction_id);
        listKambing.innerHTML = '';
        available.forEach(k => {
            if(currentCart.find(c => c.goatId === k.id)) return;
            const opt = document.createElement('option');
            let extraStat = k.status_kesehatan === 'Sakit' ? ' [SAKIT]' : (k.status_kesehatan === 'Mati' ? ' [MATI]' : '');
            opt.value = `${k.no_tali} | ${k.batch}`;
            opt.textContent = `No.${k.no_tali} | ${k.batch} - ${k.warna_tali}${extraStat} - ${formatNum(k.harga_kandang)}`;
            listKambing.appendChild(opt);
        });
    };

    const handleAgenChange = async () => {
        const agens = await getAgenDb();
        const agenInputVal = inpAgenId.value;
        const matchedAgen = agens.find(a => a.nama === agenInputVal || `${a.nama} - ${a.jenis || 'Agen'}` === agenInputVal);
        const tipe = matchedAgen ? (matchedAgen.jenis || '') : '';
        currentAgenTipeKomisi = TIPE_BERHAK_KOMISI_UPPER.includes(tipe.toUpperCase());
        if (labelKomisiAgen) labelKomisiAgen.textContent = currentAgenTipeKomisi ? `(${tipe})` : '';
        updateKomisiUI();
    };

    const updateKomisiUI = () => {
        const total = currentCart.reduce((sum, i) => sum + (parseFloat(i.hargaDeal) || 0), 0);
        if (!currentAgenTipeKomisi || !sectionKomisi) { sectionKomisi?.classList.remove('visible'); if(inpKomisiNominal) inpKomisiNominal.value = '0'; return; }
        const komisi = Math.round(total * 0.10);
        const nett = total - komisi;
        if(komisiBaseDeal) komisiBaseDeal.textContent = formatRp(total);
        if(komisiNominalDisplay) komisiNominalDisplay.textContent = formatRp(komisi);
        if(komisiNettDisplay) komisiNettDisplay.textContent = formatRp(nett);
        if(inpKomisiNominal) inpKomisiNominal.value = komisi;
        sectionKomisi.classList.add('visible');
    };

    const handleChannelChangeLocal = async (channelVal, container, selectEl) => {
        if (channelVal === 'Transfer Bank') {
            const reks = await getRekeningDb();
            if(reks && reks.length > 0) {
                container.style.display = 'block';
                selectEl.innerHTML = '<option value="">-- Pilih Rekening --</option>';
                reks.forEach(r => { const opt = document.createElement('option'); opt.value = r.id; opt.textContent = `${r.bank} - ${r.norek} (${r.an})`; selectEl.appendChild(opt); });
            } else { container.style.display = 'none'; }
        } else { container.style.display = 'none'; }
    };

    const renderCart = () => {
        cartContainer.innerHTML = ''; let total = 0;
        currentCart.forEach((item, index) => {
            total += parseFloat(item.hargaDeal) || 0;
            const div = document.createElement('div'); div.className = 'cart-item';
            div.innerHTML = `
                <div style="line-height: 1.2;"><strong style="font-size:1rem; color:var(--text-main);"># ${item.noTali}</strong><br><small style="color:var(--text-muted); font-size:0.75rem;">${item.warnaTali || ''} | ${item.batch}</small></div>
                <div><label style="color:var(--text-muted); font-size:0.65rem;">Sohibul Qurban</label><input type="text" class="form-control inp-sohibul" data-index="${index}" value="${item.namaSohibul || ''}" placeholder="Nama pendaftar..."></div>
                <div><label style="color:var(--text-muted); font-size:0.65rem;">Hrg Deal</label><input type="text" class="form-control inp-deal money-input" data-index="${index}" value="${formatNum(item.hargaDeal)}"></div>
                <div style="display:flex; justify-content:center;"><button type="button" class="btn btn-remove" data-index="${index}">&times;</button></div>
            `;
            cartContainer.appendChild(div);
        });
        displayTotalDeal.textContent = `TOTAL: ${formatRp(total)}`; updateKomisiUI();
        document.querySelectorAll('.inp-deal').forEach(inp => {
            inp.addEventListener('blur', (e) => { const raw = parseNum(e.target.value); currentCart[e.target.dataset.index].hargaDeal = raw; e.target.value = formatNum(raw); const subTotal = currentCart.reduce((s,i) => s + (parseFloat(i.hargaDeal)||0), 0); displayTotalDeal.textContent = `TOTAL: ${formatRp(subTotal)}`; updateKomisiUI(); });
        });
        document.querySelectorAll('.inp-sohibul').forEach(inp => { inp.addEventListener('input', (e) => { currentCart[e.target.dataset.index].namaSohibul = e.target.value; }); });
        document.querySelectorAll('.btn-remove').forEach(btn => { btn.addEventListener('click', async (e) => { currentCart.splice(parseInt(e.target.dataset.index), 1); renderCart(); await refreshKambingDropdown(); }); });
    };

    const renderTable = async () => {
        const userRole = localStorage.getItem('userRole');
        const loggedUser = JSON.parse(localStorage.getItem('LOGGED_IN_USER')) || {};
        const agenLinkedId = localStorage.getItem('linkedAgenId') || loggedUser.linkedAgenId || '';
        const agenLinkedName = (localStorage.getItem('agenName') || loggedUser.agenName || loggedUser.fullName || '').toLowerCase();
        let query = supabase.from('transaksi').select('*');
        if (userRole !== 'admin') { if (!agenLinkedId && !agenLinkedName) { tableBody.innerHTML = '<tr><td colspan="10">Data tidak ditemukan.</td></tr>'; return; } }
        const { data: trxData, error } = await query;
        if (error) return;
        let trx = [...trxData];
        const keyword = (inpGlobalSearch ? inpGlobalSearch.value : '').toLowerCase();
        if (userRole !== 'admin') { trx = trx.filter(t => (agenLinkedId && t.agen.id === agenLinkedId) || (agenLinkedName && (t.agen.nama || '').toLowerCase() === agenLinkedName)); }
        if (keyword) { trx = trx.filter(t => t.id.toLowerCase().includes(keyword) || (t.customer.nama || '').toLowerCase().includes(keyword) || (t.agen.nama || '').toLowerCase().includes(keyword) || (t.customer.wa1 || '').toLowerCase().includes(keyword)); }
        trx.sort((a, b) => { let vA = a[currentSort.column], vB = b[currentSort.column]; if (currentSort.column === 'sisa') { vA = a.totalDeal - a.totalPaid; vB = b.totalDeal - b.totalPaid; } return currentSort.direction === 'asc' ? (vA < vB ? -1 : 1) : (vA > vB ? -1 : 1); });
        const { data: editReqs } = await supabase.from('edit_requests').select('*').eq('status', 'pending');
        const kambingDb = await getKambingDb();
        tableBody.innerHTML = '';
        trx.forEach(t => {
            const hasPendingEdit = editReqs?.find(r => r.trx_id === t.id);
            const sisa = (t.totalDeal || 0) - (t.totalPaid || 0);
            const itemsHtml = t.items.map(item => { const kMeta = kambingDb.find(k => k.id === item.goatId); return `• No ${item.noTali} (${kMeta?.warna_tali || '-'})`; }).join('<br>');
            const tr = document.createElement('tr');
            const isOwner = (agenLinkedId && t.agen.id === agenLinkedId) || (agenLinkedName && (t.agen.nama || '').toLowerCase() === agenLinkedName);
            const canEdit = isAdmin || (isMarketingRole && isOwner);

            tr.innerHTML = `
                <td><div style="font-weight:700;">${t.id}</div><div style="font-size:0.75rem;">${formatTgl(t.tglTrx)}</div>${hasPendingEdit ? '<span class="badge" style="background:#f59e0b22; color:#f59e0b;">⏳ Review</span>' : ''}</td>
                <td>${t.agen.nama}<br><small>${t.agen.tipe || 'Agen'}</small></td>
                <td><strong>${t.customer.nama || '-'}</strong><br><small>WA: ${t.customer.wa1 || '-'}</small></td>
                <td><small>${t.delivery.alamat.kec || '-'}, ${t.delivery.alamat.kab || '-'}</small></td>
                <td><strong>${formatTgl(t.delivery.tgl)}</strong><br><small>${t.delivery.tipe || '-'}</small></td>
                <td><small>${itemsHtml}</small></td>
                <td style="font-weight:700;">${formatRp(t.totalDeal)}</td>
                <td style="font-weight:700; color:var(--success);">${formatRp(t.totalPaid || 0)}</td>
                <td style="font-weight:700; color:${sisa > 0 ? 'var(--warning)' : 'var(--success)'}">${formatRp(sisa)}</td>
                <td style="text-align:right;"><div class="action-btns">${t.needsAdminApproval && isAdmin ? `<button class="btn btn-sm" onclick="approveTrx('${t.id}')">✅</button>` : ''}${canEdit ? `<button class="btn btn-sm" onclick="editFullTrx('${t.id}')">✏️</button>` : ''}${isAdmin ? `<button class="btn btn-sm" onclick="rollbackTrx('${t.id}')">🗑️</button>` : ''}</div></td>
            `;
            tableBody.appendChild(tr);
        });
    };

    const performSave = async (sendWA) => {
        const agens = await getAgenDb();
        const matchedAgen = agens.find(a => a.nama === inpAgenId.value || `${a.nama} - ${a.jenis || 'Agen'}` === inpAgenId.value);
        const trxId = window.editingTrxId || await generateTrxId();
        const total = currentCart.reduce((sum, i) => sum + (parseFloat(i.hargaDeal) || 0), 0);
        const paidNow = parseNum(inpTotalBayarAwal.value);
        let finalChannelDP = inpChannelDP.value; if(finalChannelDP === 'Transfer Bank' && inpRekIdDP.value) finalChannelDP = `TF ${inpRekIdDP.options[inpRekIdDP.selectedIndex].textContent}`;
        const userRole = localStorage.getItem('userRole');
        if (window.editingTrxId && userRole !== 'agen') await silentRollback(window.editingTrxId, true);
        let buktiUrl = null; if (inpBuktiDP?.files.length > 0) { const b64 = await compressImage(inpBuktiDP.files[0]); buktiUrl = await uploadToGDrive(b64, 'FOTO_BUKTI_DP'); }
        
        const newTrx = {
            id: trxId, tglTrx: window.getLocalDate(),
            agen: { id: matchedAgen?.id || '', nama: matchedAgen?.nama || inpAgenId.value, tipe: matchedAgen?.jenis || 'Agen' },
            customer: { nama: document.getElementById('inpCustNama').value, wa1: document.getElementById('inpCustWA1').value, wa2: document.getElementById('inpCustWA2').value, alamat: { kab: inpCustKab.value, kec: inpCustKec.value, desa: document.getElementById('inpCustDesa').value, jalan: document.getElementById('inpCustAlamatJalan').value, maps: document.getElementById('inpMapsLink')?.value || '' } },
            delivery: { tipe: document.getElementById('inpDeliveryTipe').value, tgl: document.getElementById('inpDeliveryTgl').value, alamat: { kab: inpCustKab.value, kec: inpCustKec.value, desa: document.getElementById('inpCustDesa').value, jalan: document.getElementById('inpCustAlamatJalan').value, maps: document.getElementById('inpMapsLink')?.value || '' } },
            items: currentCart, totalDeal: total, totalPaid: paidNow + (window.existingInstallmentsTotal || 0),
            historyBayar: paidNow > 0 ? [{ payId: 'PAY-'+Date.now(), tgl: window.getLocalDate(), nominal: paidNow, channel: finalChannelDP, buktiUrl }] : [],
            komisi: { berhak: currentAgenTipeKomisi, nominal: parseNum(inpKomisiNominal?.value), status: 'belum_bayar' },
            needsAdminApproval: userRole === 'agen'
        };

        if (window.editingTrxId && userRole === 'agen') {
            await supabase.from('edit_requests').insert([{ trx_id: window.editingTrxId, new_data: newTrx, requester_email: email, status: 'pending' }]);
            showToast('✅ Permintaan edit dikirim ke Admin!');
            showAlert('Permintaan Perubahan Terkirim!', 'success', () => { modalKeluar.classList.remove('active'); window.editingTrxId = null; }); return;
        }

        await supabase.from('transaksi').insert([newTrx]);
        for (const it of currentCart) await supabase.from('stok_kambing').update({ status_transaksi: 'Terjual', transaction_id: trxId, tgl_keluar: newTrx.tglTrx, harga_deal: it.hargaDeal }).eq('id', it.goatId);
        if(paidNow > 0) await supabase.from('keuangan').insert([{ id: 'PAY-'+Date.now(), tipe: 'pemasukan', tanggal: newTrx.tglTrx, kategori: 'Jual Kambing', nominal: paidNow, channel: finalChannelDP, related_trx_id: trxId, bukti_url: buktiUrl }]);

        if (sendWA && typeof window.sendWa === 'function') {
            const config = await window.getWaConfig();
            
            // Build Items string
            const itemsStr = currentCart.map(it => `• No.${it.noTali} (${it.batch})`).join('\n');
            const sohibulStr = currentCart.map(it => `• ${it.noTali}: ${it.namaSohibul || '-'}`).join('\n');
            
            const commonData = {
                nama: newTrx.customer.nama,
                id: trxId,
                tgl: formatTgl(newTrx.tglTrx),
                total: formatRp(total),
                dp: formatRp(paidNow),
                sisa: formatRp(total - newTrx.totalPaid),
                items: itemsStr,
                sohibul: sohibulStr,
                alamat: newTrx.customer.alamat.jalan + ', ' + newTrx.customer.alamat.kec,
                wa_konsumen: newTrx.customer.wa1,
                nama_agen: newTrx.agen.nama,
                jadwal: formatTgl(newTrx.delivery.tgl)
            };

            // 1. Send to Customer
            const templateCust = newTrx.agen.tipe.toUpperCase().includes('DM') ? config.templateOrderDM : config.templateOrderNormal;
            const msgCust = await window.parseWaTemplate(templateCust, commonData);
            if (newTrx.customer.wa1) await window.sendWa(newTrx.customer.wa1, msgCust);

            // 2. Send to Agent
            const templateAgen = newTrx.agen.tipe.toUpperCase().includes('DM') ? config.templateAgentDM : config.templateAgentNormal;
            const msgAgen = await window.parseWaTemplate(templateAgen, commonData);
            // Cari nomor WA agen dari master_data
            const allAgens = await getAgenDb();
            const agenData = allAgens.find(a => a.id === newTrx.agen.id || a.nama === newTrx.agen.nama);
            if (agenData && agenData.wa) await window.sendWa(agenData.wa, msgAgen);
        }
        showAlert('Berhasil Disimpan!', 'success', () => { modalKeluar.classList.remove('active'); renderTable(); window.editingTrxId = null; });
    };

    const silentRollback = async (trxId, keepInstallments = false) => {
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
        if(!trx) return;
        for (const it of trx.items) await supabase.from('stok_kambing').update({ status_transaksi: 'Tersedia', transaction_id: null, tgl_keluar: null, harga_deal: null }).eq('id', it.goatId);
        if (!keepInstallments) await supabase.from('keuangan').delete().eq('related_trx_id', trxId); else { const { data: fin } = await supabase.from('keuangan').select('nominal').eq('related_trx_id', trxId); window.existingInstallmentsTotal = fin?.reduce((s,f) => s + f.nominal, 0) || 0; await supabase.from('keuangan').delete().eq('related_trx_id', trxId).in('kategori', ['Jual Kambing']); }
        await supabase.from('transaksi').delete().eq('id', trxId);
    };

    window.rollbackTrx = async (trxId) => { showConfirm('Batalkan transaksi?', async () => { await silentRollback(trxId); showToast('Dibatalkan'); await renderTable(); }); };
    window.approveTrx = async (trxId) => { await supabase.from('transaksi').update({ needsAdminApproval: false }).eq('id', trxId); await renderTable(); };

    window.deleteHistoryItem = async (trxId, payId, payNominal) => {
        showConfirm('Hapus riwayat bayar?', async () => {
            const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
            const updatedHistory = trx.historyBayar.filter(h => h.payId !== payId);
            await supabase.from('transaksi').update({ totalPaid: trx.totalPaid - payNominal, historyBayar: updatedHistory }).eq('id', trxId);
            await supabase.from('keuangan').delete().eq('id', payId);
            await renderTable(); modalLunas.classList.remove('active');
        });
    };

    const performSaveLunas = async (nominal, trxId, channel, tgl, kirimWA) => {
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
        const payId = 'PAY-' + Date.now();
        const updatedHistory = [...(trx.historyBayar || []), { payId, tgl, nominal, channel }];
        const totalPaidNew = (trx.totalPaid || 0) + nominal;
        
        await supabase.from('transaksi').update({ totalPaid: totalPaidNew, historyBayar: updatedHistory }).eq('id', trxId);
        await supabase.from('keuangan').insert([{ id: payId, tipe: 'pemasukan', tanggal: tgl, kategori: 'Pelunasan Order', nominal, channel, related_trx_id: trxId }]);
        
        if (kirimWA && typeof window.sendWa === 'function') {
            const config = await window.getWaConfig();
            const commonData = {
                nama: trx.customer.nama,
                id: trx.id,
                tgl: formatTgl(tgl),
                nominal: formatRp(nominal),
                sisa: formatRp(trx.totalDeal - totalPaidNew),
                nama_agen: trx.agen.nama
            };

            // 1. Notif Ke Konsumen
            const msgCust = await window.parseWaTemplate(config.templateLunas, commonData);
            if (trx.customer.wa1) await window.sendWa(trx.customer.wa1, msgCust);

            // 2. Notif Ke Agen
            const msgAgen = await window.parseWaTemplate(config.templateLunasAgent, commonData);
            const allAgens = await getAgenDb();
            const agenData = allAgens.find(a => a.id === trx.agen.id || a.nama === trx.agen.nama);
            if (agenData && agenData.wa) await window.sendWa(agenData.wa, msgAgen);
        }
        showAlert('Pembayaran Berhasil!', 'success', () => { modalLunas.classList.remove('active'); renderTable(); });
    };


    formTerjual.addEventListener('submit', (e) => { e.preventDefault(); if(currentCart.length === 0) return; showChoice("Simpan Transaksi?", [{ text: "📲 Simpan & WA", callback: () => performSave(true) }, { text: "💾 Simpan Saja", callback: () => performSave(false) }]); });
    
    // Global Access
    window.terimaLunas = (trxId) => {
        selOrderLunas.innerHTML = '<option value="">-- Pilih Order --</option>';
        supabase.from('transaksi').select('*').then(({data}) => {
            data.filter(t => t.totalDeal > t.totalPaid).forEach(t => { const opt = document.createElement('option'); opt.value = t.id; opt.textContent = `${t.id} - ${t.customer.nama} | Sisa: ${formatRp(t.totalDeal-t.totalPaid)}`; selOrderLunas.appendChild(opt); });
            if(trxId) { selOrderLunas.value = trxId; selOrderLunas.dispatchEvent(new Event('change')); }
        });
        modalLunas.classList.add('active');
    };

    selOrderLunas.addEventListener('change', async () => {
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', selOrderLunas.value).single();
        if(!trx) return;
        detailOrderLunas.innerHTML = `ID: ${trx.id} | Sisa: ${formatRp(trx.totalDeal-trx.totalPaid)}`;
        let hist = ''; (trx.historyBayar || []).forEach(h => { hist += `<div>${formatTgl(h.tgl)} - ${formatRp(h.nominal)} <button onclick="deleteHistoryItem('${trx.id}','${h.payId}',${h.nominal})">🗑️</button></div>`; });
        historiPayLunas.innerHTML = hist;
        inpNominalLunas.value = formatNum(trx.totalDeal - trx.totalPaid);
        infoOrderLunas.style.display = 'block'; formInputLunas.style.display = 'block'; btnSimpanLunas.disabled = false;
    });

    btnSimpanLunas.addEventListener('click', () => { performSaveLunas(parseNum(inpNominalLunas.value), selOrderLunas.value, inpChannelLunas.value, inpTglLunas.value, true); });

    document.getElementById('btnTambahTerjual').addEventListener('click', () => { window.editingTrxId = null; initForm(); modalKeluar.classList.add('active'); });
    document.getElementById('btnCloseModal').addEventListener('click', () => modalKeluar.classList.remove('active'));
    document.getElementById('btnCloseLunasModal').addEventListener('click', () => modalLunas.classList.remove('active'));
    
    inpSearchKambing.addEventListener('change', async () => { await addKambingToCart(); });
    btnAddKambing.addEventListener('click', async () => { await addKambingToCart(); });
    inpAgenId.addEventListener('change', async () => { await handleAgenChange(); });
    inpChannelDP.addEventListener('change', () => handleChannelChangeLocal(inpChannelDP.value, containerRekDP, inpRekIdDP));
    inpChannelLunas.addEventListener('change', () => handleChannelChangeLocal(inpChannelLunas.value, containerRekLunas, inpRekIdLunas));

    const addKambingToCart = async () => {
        const db = await getKambingDb();
        const goat = db.find(k => k.status_transaksi === 'Tersedia' && k.no_tali === inpSearchKambing.value.split('|')[0].trim());
        if(goat) { currentCart.push({ goatId: goat.id, noTali: goat.no_tali, batch: goat.batch, hargaKandang: goat.harga_kandang, hargaDeal: goat.harga_kandang }); renderCart(); await refreshKambingDropdown(); inpSearchKambing.value = ''; }
    };

    renderTable();
});
