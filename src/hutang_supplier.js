import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout.js handles redirect

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const email = profile.email;
    if (email) document.getElementById('userEmailDisplay').textContent = email;


    const GDRIVE_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwVd01SmNkuoUwinekKbDAh3meqs8ZsbR-OZoCBPUcHZ3_jcBQST6p5vrSVJULt_t8/exec';

    async function compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image(); img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                    let width = img.width; let height = img.height;
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
            const resp = await fetch(GDRIVE_PROXY_URL, {
                method: 'POST',
                body: JSON.stringify({ base64, mimeType: "image/jpeg", fileName: "pay_supp_" + Date.now(), folderName })
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

    const tableBody = document.getElementById('tableBodyHutang');
    const modalBayar = document.getElementById('modalBayar');
    const formBayar = document.getElementById('formBayar');
    const inpSearch = document.getElementById('inpSearch');

    let cachedGoats = [];
    let cachedFinance = [];
    let currentSort = { column: 'tglMasuk', direction: 'desc' };

    const loadData = async (force = false) => {
        if (!force && cachedGoats.length > 0) return { goats: cachedGoats, finance: cachedFinance };
        
        const [{ data: goats }, { data: finance }] = await Promise.all([
            supabase.from('stok_kambing').select('*'),
            supabase.from('keuangan').select('*')
        ]);
        
        cachedGoats = goats || [];
        cachedFinance = finance || [];
        return { goats: cachedGoats, finance: cachedFinance };
    };

    const updateStats = (supplierStats) => {
        let totalHutang = 0;
        let totalPaid = 0;
        let totalKomp = 0;

        Object.values(supplierStats).forEach(s => {
            totalHutang += s.totalTags;
            totalPaid += s.totalPaid;
            totalKomp += s.totalKomp;
        });

        const sisaHutang = totalHutang - totalKomp - totalPaid;

        document.getElementById('statTotalHutang').textContent = formatRp(totalHutang);
        document.getElementById('statTotalTerbayar').textContent = formatRp(totalPaid);
        document.getElementById('statSisaHutang').textContent = formatRp(Math.max(0, sisaHutang));
    };

    async function renderTable() {
        const { goats, finance } = await loadData();
        if(!tableBody) return;

        const supplierStats = {};
        goats.forEach(k => {
            const sName = (k.supplier || 'Tanpa Supplier').trim();
            if(!supplierStats[sName]) supplierStats[sName] = { nama: sName, totalTags: 0, totalKomp: 0, totalPaid: 0, batches: {}, totalEkor: 0 };
            const nota = parseFloat(k.harga_nota) || 0;
            supplierStats[sName].totalTags += nota;
            supplierStats[sName].totalEkor++;
            
            const bKey = k.batch || 'BT-000';
            if(!supplierStats[sName].batches[bKey]) {
                supplierStats[sName].batches[bKey] = { ekor: 0, tagihan: 0, tgl: k.tgl_masuk, notes: [], paid: 0, komp: 0 };
            }
            supplierStats[sName].batches[bKey].ekor++;
            supplierStats[sName].batches[bKey].tagihan += nota;
            if(k.catatan_masuk) supplierStats[sName].batches[bKey].notes.push(k.catatan_masuk);
        });

        finance.forEach(f => {
            const sName = (f.supplier || '').trim();
            if(sName && supplierStats[sName]) {
                const nom = parseFloat(f.nominal) || 0;
                const bKey = f.batch;

                if(f.tipe === 'pemasukan' && f.kategori === 'Kompensasi Supplier') {
                    supplierStats[sName].totalKomp += nom;
                    if(bKey && supplierStats[sName].batches[bKey]) supplierStats[sName].batches[bKey].komp += nom;
                }
                else if(f.tipe === 'pengeluaran' && f.kategori === 'Bayar Supplier') {
                    supplierStats[sName].totalPaid += nom;
                    // Alokasi Spesifik Batch
                    if(bKey && supplierStats[sName].batches[bKey]) {
                        supplierStats[sName].batches[bKey].paid += nom;
                    } else {
                        // Alokasi Global (Tanpa Batch)
                        if(!supplierStats[sName].globalUnallocated) supplierStats[sName].globalUnallocated = 0;
                        supplierStats[sName].globalUnallocated += nom;
                    }
                }
            }
        });

        updateStats(supplierStats);

        let flattenedData = [];
        Object.values(supplierStats).forEach(s => {
            // Urutkan batch berdasarkan tanggal masuk (Tertua pertama) untuk alokasi FIFO
            const sortedBatches = Object.entries(s.batches).sort((a,b) => {
                const dA = new Date(a[1].tgl || '2000-01-01');
                const dB = new Date(b[1].tgl || '2000-01-01');
                return dA - dB;
            });

            let unallocatedPool = s.globalUnallocated || 0;

            sortedBatches.forEach(([batch, bData]) => {
                const sisaSebelumGlobal = bData.tagihan - bData.komp - bData.paid;
                
                // Alokasikan dana global ke batch ini
                let fromGlobal = 0;
                if(unallocatedPool > 0 && sisaSebelumGlobal > 0) {
                    fromGlobal = Math.min(sisaSebelumGlobal, unallocatedPool);
                    unallocatedPool -= fromGlobal;
                }

                const batchSisa = sisaSebelumGlobal - fromGlobal;

                flattenedData.push({
                    nama: s.nama, batch, tglMasuk: bData.tgl, totalEkor: bData.ekor,
                    totalPokok: bData.tagihan, 
                    batchSisa, 
                    isLunas: batchSisa <= 0,
                    keterangan: bData.notes[0] || '-',
                    totalKomp: bData.komp,
                    totalPaid: bData.paid + fromGlobal, // Tampilkan total yang terbayar di batch ini
                    fromGlobal: fromGlobal
                });
            });
        });

        const searchTerm = (inpSearch?.value || '').toLowerCase();
        const statusFilter = document.getElementById('selStatusHutang')?.value || 'all';

        let displayData = flattenedData.filter(d => {
            const matchSearch = d.nama.toLowerCase().includes(searchTerm) || d.batch.toLowerCase().includes(searchTerm);
            let matchStatus = true;
            if (statusFilter === 'hutang') matchStatus = !d.isLunas;
            else if (statusFilter === 'lunas') matchStatus = d.isLunas;
            return matchSearch && matchStatus;
        });

        displayData.sort((a,b) => {
            let vA = a[currentSort.column], vB = b[currentSort.column];
            return currentSort.direction === 'asc' ? (vA < vB ? -1 : 1) : (vA > vB ? -1 : 1);
        });

        tableBody.innerHTML = '';
        if (displayData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);">Tidak ada data hutang ditemukan.</td></tr>`;
            return;
        }

        displayData.forEach(item => {
            const tr = document.createElement('tr');
            const sisaColor = item.isLunas ? 'var(--success)' : 'var(--danger)';
            tr.innerHTML = `
                <td><span class="badge" style="background:rgba(255,255,255,0.05); color:var(--primary); font-weight:700;">${item.batch}</span></td>
                <td>${item.tglMasuk || '-'}</td>
                <td style="font-weight:700; color:var(--text-main);">${item.nama}</td>
                <td style="text-align:center;"><span style="color:var(--text-muted); font-size:0.9rem;">${item.totalEkor}</span> <small>ekor</small></td>
                <td style="font-weight:600;">${formatRp(item.totalPokok)}</td>
                <td style="font-size:0.75rem; color:var(--text-muted); max-width:150px; overflow:hidden; text-overflow:ellipsis;">${item.keterangan}</td>
                <td style="color:var(--warning); font-size:0.9rem;">${formatRp(item.totalKomp)}</td>
                <td style="color:var(--success); font-size:0.9rem;">${formatRp(item.totalPaid)}</td>
                <td style="font-weight:bold; color:${sisaColor}; font-size:1.05rem;">
                    ${item.batchSisa > 0 ? formatRp(item.batchSisa) : '<span class="badge badge-success">LUNAS</span>'}
                </td>
                <td style="text-align:right;">
                    <button class="btn btn-sm btn-bayar btn-shimmer" 
                        data-name="${item.nama}" 
                        data-batch="${item.batch}" 
                        data-sisa="${item.batchSisa}"
                        style="background:var(--primary); color:#ffffff; border:none; padding:6px 12px;">💸 Bayar</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        document.querySelectorAll('.btn-bayar').forEach(btn => btn.onclick = () => openBayarModal(btn.dataset.name, btn.dataset.batch, btn.dataset.sisa));
    }

    async function checkSaldoCukup(channel, nominal, label) {
        const { data } = await supabase.from('keuangan').select('*');
        let s = 0; const target = (channel || '').toLowerCase().trim();
        (data || []).forEach(it => {
            const ch = (it.channel || 'Tunai').toLowerCase().trim();
            if(ch === target || ch.includes(target)) {
                if(it.tipe === 'pemasukan') s += (parseFloat(it.nominal) || 0);
                if(it.tipe === 'pengeluaran') s -= (parseFloat(it.nominal) || 0);
            }
        });
        if(s < nominal) {
            // PERINGATAN (BYPASS)
            const ok = confirm(`⚠️ Saldo di ${label} tidak cukup! Saldo saat ini: ${formatRp(s)}.\n\nTetap lanjutkan pencatatan pembayaran (Mungkin menggunakan dana luar)?`);
            return ok;
        }
        return true;
    }

    const inpChannelBayar = document.getElementById('inpChannelBayar');
    const containerRekBayar = document.getElementById('containerRekBayar');
    const inpRekIdBayar = document.getElementById('inpRekIdBayar');
    const inpBatchBayar = document.getElementById('inpBatchBayar');
    const inpBuktiBayar = document.getElementById('inpBuktiBayar');
    const previewBuktiBayar = document.getElementById('previewBuktiBayar');

    window.setupMoneyMask('inpNominal');

    const openBayarModal = async (supplierName, activeBatch, suggestedNominal = 0) => {
        document.getElementById('inpSupplierName').value = supplierName;
        document.getElementById('displaySupplier').value = supplierName;
        document.getElementById('inpTglBayar').value = window.getLocalDate();
        
        const { data: gs } = await supabase.from('stok_kambing').select('batch').eq('supplier', supplierName);
        const batches = [...new Set((gs || []).map(g => g.batch))];
        inpBatchBayar.innerHTML = '<option value="">-- Semua Batch (Global) --</option>';
        batches.forEach(b => {
             const o = document.createElement('option'); o.value = b; o.textContent = `Batch ${b}`;
             if(b === activeBatch) o.selected = true;
             inpBatchBayar.appendChild(o);
        });

        document.getElementById('inpNominal').value = window.formatNum(suggestedNominal); // Auto-fill sisa hutang
        document.getElementById('inpCatatan').value = `Bayar supplier ${supplierName}${activeBatch ? ' (Batch '+activeBatch+')' : ''}`;
        inpChannelBayar.value = 'Tunai'; containerRekBayar.style.display = 'none';
        modalBayar.classList.add('active');
    };

    formBayar?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nama = document.getElementById('inpSupplierName').value;
        const nom = window.parseNum(document.getElementById('inpNominal').value);
        const chan = inpChannelBayar.value;
        const tgl = document.getElementById('inpTglBayar').value;
        const batch = inpBatchBayar.value;

        let finalChan = chan;
        if(chan === 'Transfer Bank' && inpRekIdBayar.value) finalChan = 'TF ' + inpRekIdBayar.options[inpRekIdBayar.selectedIndex].textContent;

        if(!await checkSaldoCukup(finalChan, nom, finalChan)) return;

        let buktiUrl = null;
        if(inpBuktiBayar?.files.length > 0) {
            window.showToast('Uploading...', 'info');
            const b64 = await compressImage(inpBuktiBayar.files[0]);
            buktiUrl = await uploadToGDrive(b64, 'PAY_SUPP');
        }

        const id = 'PAY-' + Date.now().toString().slice(-6);
        await supabase.from('keuangan').insert([{
            id, tipe: 'pengeluaran', tanggal: tgl, kategori: 'Bayar Supplier', nominal: nom,
            keterangan: `Bayar ${nama}${batch ? ' (Batch '+batch+')' : ''}`,
            channel: finalChan, supplier: nama, batch: batch, bukti_url: buktiUrl
        }]);

        window.showAlert('Berhasil disimpan!', 'success', () => {
             modalBayar.classList.remove('active'); renderTable();
        });
    });

    inpChannelBayar?.addEventListener('change', async () => {
        if(inpChannelBayar.value === 'Transfer Bank') {
            const reks = await getBankAccounts();
            containerRekBayar.style.display = 'block';
            inpRekIdBayar.innerHTML = '<option value="">-- Pilih --</option>';
            reks.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = `${r.bank} - ${r.norek} (${r.an})`; inpRekIdBayar.appendChild(o); });
        } else containerRekBayar.style.display = 'none';
    });

    inpSearch?.addEventListener('input', renderTable);
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modalBayar.classList.remove('active'));

    document.getElementById('btnBayarGlobal')?.addEventListener('click', async () => {
        const { goats } = await loadData();
        const suppliers = [...new Set(goats.map(g => (g.supplier || 'Tanpa Supplier').trim()))];
        
        if (suppliers.length === 0) return window.showAlert('Tidak ada data supplier ditemukan.', 'warning');
        
        let targetSupplier = suppliers[0];
        if (suppliers.length > 1) {
            // Jika lebih dari satu, minta pilih atau tampilkan prompt sederhana
            // Untuk saat ini kita ambil yang pertama atau biarkan user memilih di modal jika kita tambah dropdown
            targetSupplier = suppliers[0]; 
        }

        // Hitung total sisa hutang supplier ini untuk suggestion nominal
        const data = await loadData();
        const fins = data.finance;
        const gts = goats.filter(g => (g.supplier || 'Tanpa Supplier').trim() === targetSupplier);
        const tags = gts.reduce((s, k) => s + (parseFloat(k.harga_nota) || 0), 0);
        const paid = fins.filter(f => (f.supplier || '').trim() === targetSupplier && f.tipe === 'pengeluaran' && f.kategori === 'Bayar Supplier')
                         .reduce((s, f) => s + (parseFloat(f.nominal) || 0), 0);
        const komp = fins.filter(f => (f.supplier || '').trim() === targetSupplier && f.tipe === 'pemasukan' && f.kategori === 'Kompensasi Supplier')
                         .reduce((s, f) => s + (parseFloat(f.nominal) || 0), 0);
        
        openBayarModal(targetSupplier, null, tags - komp - paid);
    });

    document.querySelectorAll('.sort-header').forEach(h => {
        h.addEventListener('click', () => {
            currentSort.direction = (currentSort.column === h.dataset.column && currentSort.direction === 'asc') ? 'desc' : 'asc';
            currentSort.column = h.dataset.column;
            renderTable();
        });
    });

    await renderTable();
});
