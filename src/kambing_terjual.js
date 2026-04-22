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
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    if (email && userEmailDisplay) userEmailDisplay.textContent = email;

    const userRole = (profile.role || '').toLowerCase().replace(/_/g, ' ').trim();
    const isAdmin = ['admin', 'office', 'staf', 'operator'].includes(userRole);
    const marketingRoles = [
        'agen',
        'reseller', 
        'marketing dm', 
        'marketing ext', 
        'marketing kandang', 
        'emarketing kandang',
        'marketing luar',
        'marketing'
    ];
    const isMarketingRole = marketingRoles.includes(userRole);

    // GOOGLE DRIVE INTEGRATION
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
                body: JSON.stringify({ base64: base64, mimeType: "image/jpeg", fileName: "dp_" + Date.now(), folderName: folderName })
            });
            const result = await response.json();
            return result.success ? window.getDirectDriveLink(result.url) : null;
        } catch (error) { console.error('GDrive Upload failed:', error); return null; }
    }

    // DB Helpers
    const getKambingDb = async () => { 
        const { data, error } = await supabase.from('stok_kambing').select('*').order('no_tali', { ascending: true }); 
        if (error) console.error('Gagal mengambil data kambing:', error);
        return data || []; 
    };
    const getTrxDb = async () => { const { data } = await supabase.from('transaksi').select('*'); return data || []; };
    const getAgenDb = async () => { 
        try {
            // 1. Ambil dari Master Data Agen
            const { data: md } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single();
            const mdAgens = md?.val || [];

            // 2. Ambil dari Tabel Profiles (User yg punya role agen/marketing)
            const marketingRoles = ['agen', 'reseller', 'marketing dm', 'marketing ext', 'marketing kandang', 'emarketing kandang', 'marketing luar', 'marketing', 'staf', 'office'];
            const { data: profs } = await supabase.from('profiles').select('full_name, wa, role, permissions').in('role', ['agen', 'marketing', 'staf', 'office', 'reseller']);
            
            // 3. Gabungkan (Merge)
            const map = new Map();
            
            // Masukkan dari Master Data dulu
            mdAgens.forEach(a => {
                if (a.nama) map.set(a.nama.toLowerCase().trim(), { ...a, source: 'master_data' });
            });

            // Masukkan/Update dari Profiles (Profile lebih update biasanya)
            (profs || []).forEach(p => {
                const nameKey = (p.full_name || "").toLowerCase().trim();
                if (!nameKey) return;

                const existing = map.get(nameKey);
                const jenis = p.permissions?.jenis_agen || p.role || 'Agen';
                
                if (existing) {
                    // Cek tipe: Prioritaskan tipe spesifik dari Master Data (EXT/DM) daripada 'Agen' standar dari profil
                    const isGeneric = (jenis === 'Agen' || jenis === 'marketing');
                    const newTipe = (isGeneric && existing.tipe) ? existing.tipe : jenis;

                    map.set(nameKey, { 
                        ...existing, 
                        wa: p.wa || existing.wa, 
                        tipe: newTipe, 
                        source: 'merged'
                    });
                } else {
                    // Jika belum ada, tambahkan baru
                    map.set(nameKey, {
                        id: 'USER-' + nameKey.replace(/\s+/g, '-'),
                        nama: p.full_name,
                        wa: p.wa,
                        tipe: jenis, // Gunakan 'tipe' agar sinkron dengan bagian kode lain
                        source: 'profiles'
                    });
                }
            });

            return Array.from(map.values());
        } catch (err) {
            console.error('Error in getAgenDb:', err);
            return [];
        }
    };
    const getRekeningDb = async () => { 
        const { data } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single(); 
        if (data && data.val && data.val.length > 0) return data.val;
        
        const { data: oldData } = await supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single();
        return oldData?.val || [];
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

    const tableBody = document.getElementById('tableBodyTransaksi');
    const modalKeluar = document.getElementById('modalKeluar');
    const formTerjual = document.getElementById('formTerjual');
    const inpTglOrder = document.getElementById('inpTglOrder');
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
    let lastTrxData = []; // Store for bulk actions

    // --- SORTING HANDLER ---
    document.querySelectorAll('.sort-header').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const column = th.dataset.column;
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }

            // Update UI Icons
            document.querySelectorAll('.sort-header').forEach(h => {
                const col = h.dataset.column;
                let label = h.textContent.replace(/[🔼🔽↕️]/g, '').trim();
                if (col === currentSort.column) {
                    label += (currentSort.direction === 'asc' ? ' 🔼' : ' 🔽');
                } else {
                    label += ' ↕️';
                }
                h.textContent = label;
            });

            renderTable();
        });
    });
    let currentCart = [];
    let currentAgenTipeKomisi = false;
    const TIPE_BERHAK_KOMISI_UPPER = ['MARKETING KANDANG', 'RESELLER'];

    const formatTgl = (iso) => { if(!iso) return '-'; const p = iso.split('-'); return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso; };
    const formatRp = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
    const formatNum = (v) => new Intl.NumberFormat('id-ID').format(v || 0);
    const parseNum = (s) => { if(!s) return 0; return parseFloat(String(s).replace(/[^0-9]/g, '')) || 0; };
    const debounce = (func, wait) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); }; };

    const generateTrxId = async () => {
        const { data } = await supabase.from('transaksi').select('id').order('id', { ascending: false }).limit(1);
        let maxNum = data && data.length > 0 ? parseInt(data[0].id.replace('TRX', '')) || 0 : 0;
        return 'TRX' + (maxNum + 1).toString().padStart(5, '0');
    };

    // RBAC: Show "Order Baru" button ONLY for Admin/Office
    const btnTambah = document.getElementById('btnTambahTerjual');
    const isAuthorizedToOrder = ['admin', 'office', 'staf', 'operator'].includes(userRole);
    
    if (isAuthorizedToOrder && btnTambah) {
        btnTambah.style.display = 'block'; // Show if authorized
    } else if (btnTambah) {
        btnTambah.remove(); // Force remove for everyone else
    }

    const initForm = async () => {
        const userRole = (profile.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const linkedAgen = profile.permissions?.linkedAgen || '';

        const agens = await getAgenDb();
        agens.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));
        inpAgenId.innerHTML = '<option value="">-- Pilih Agen --</option>';
        agens.forEach(a => {
            const opt = document.createElement('option');
            opt.value = `${a.nama} - ${a.jenis || 'Agen'}`;
            opt.textContent = `${a.nama} — ${a.jenis || 'Agen'}`;
            if (userRole === 'agen' && a.nama === linkedAgen) opt.selected = true;
            inpAgenId.appendChild(opt);
        });
        if (userRole === 'agen' && linkedAgen) { inpAgenId.disabled = true; setTimeout(() => handleAgenChange(), 100); } else { inpAgenId.disabled = false; }
        inpCustKab.innerHTML = '<option value="">-- Pilih Kabupaten --</option>' + Object.keys(BB_REGIONS).map(k => `<option value="${k}">${k}</option>`).join('');
        await refreshKambingDropdown();
        currentCart = []; currentAgenTipeKomisi = false;
        sectionKomisi?.classList.remove('active');
        if(inpKomisiNominal) inpKomisiNominal.value = '0';
        if(inpTglOrder) inpTglOrder.value = window.getLocalDate();
        if(inpTotalBayarAwal) inpTotalBayarAwal.value = '';
        
        // Auto-clean WA
        if (window.setupAutoCleanWA) {
            window.setupAutoCleanWA('inpCustWA1');
            window.setupAutoCleanWA('inpCustWA2');
        }

        // Reset Photo
        if(inpBuktiDP) inpBuktiDP.value = '';
        if(previewBuktiDP) previewBuktiDP.style.display = 'none';
        if(imgPreviewDP) imgPreviewDP.src = '';
        window.existingBuktiUrl = null;
        
        
        window.setupMoneyMask(inpTotalBayarAwal);
        window.setupMoneyMask(inpNominalLunas);

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
            window.existingBuktiUrl = null;
        });
    }

    const refreshKambingDropdown = async (filterText = '') => {
        const db = await getKambingDb();
        const search = (filterText || '').toLowerCase().trim();
        
        let available = db.filter(k => k.status_transaksi === 'Tersedia' && !k.transaction_id);
        
        // Filter by No Tali ONLY
        if (search) {
            available = available.filter(k => String(k.no_tali).toLowerCase().includes(search));
        }

        listKambing.innerHTML = '';
        available.slice(0, 50).forEach(k => { // Limit to 50 for performance
            if(currentCart.find(c => c.goatId === k.id)) return;
            const opt = document.createElement('option');
            let extraStat = k.status_kesehatan === 'Sakit' ? ' [SAKIT]' : (k.status_kesehatan === 'Mati' ? ' [MATI]' : '');
            
            // Signature unik No Tali + Batch agar tidak tertukar
            const signature = `No.${k.no_tali} | ${k.batch}`;
            opt.value = signature;
            opt.textContent = `No.${k.no_tali} - ${k.warna_tali}${extraStat} - ${formatNum(k.harga_kandang)}`;
            listKambing.appendChild(opt);
        });
    };

    const handleAgenChange = async () => {
        const agens = await getAgenDb();
        const agenInputVal = inpAgenId.value;
        const matchedAgen = agens.find(a => 
            a.nama === agenInputVal || 
            `${a.nama} - ${a.jenis || 'Agen'}` === agenInputVal ||
            (agenInputVal && agenInputVal.startsWith(a.nama + ' '))
        );
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

    const handleChannelChangeLocal = async (channelVal, container, selectEl, suffix = '') => {
        const infoDiv = document.getElementById('infoSaldoTitipan' + suffix);
        const valSpan = document.getElementById('valSaldoTitipan' + suffix);
        
        if (infoDiv) infoDiv.style.display = 'none';

        if (channelVal === 'Transfer Bank') {
            const reks = await getRekeningDb();
            if(reks && reks.length > 0) {
                container.style.display = 'block';
                selectEl.innerHTML = '<option value="">-- Pilih Rekening --</option>';
                reks.forEach(r => { const opt = document.createElement('option'); opt.value = r.id; opt.textContent = `${r.bank} - ${r.norek} (${r.an})`; selectEl.appendChild(opt); });
            } else { container.style.display = 'none'; }
        } else if (channelVal === 'Saldo Titipan Agen') {
            container.style.display = 'none';
            if (infoDiv && valSpan) {
                let agenName = '';
                if (suffix === 'DP') {
                    // Ambil dari inpAgenId. Nilainya "Nama - Jenis"
                    const raw = inpAgenId.value;
                    agenName = raw ? raw.split(' - ')[0] : '';
                } else {
                    // Ambil dari order yang terpilih di modal lunas
                    const trxId = selOrderLunas.value;
                    if (trxId) {
                        const { data: trx } = await supabase.from('transaksi').select('agen').eq('id', trxId).single();
                        agenName = trx?.agen?.nama || '';
                    }
                }
                
                if (agenName) {
                    infoDiv.style.display = 'block';
                    valSpan.textContent = 'Memuat...';
                    const saldo = await getAgentSaldo(agenName);
                    valSpan.textContent = window.formatRp(saldo);
                } else {
                    await window.showAlert('Pilih Agen/Order Terlebih Dahulu', 'warning');
                    if (suffix === 'DP') inpChannelDP.value = 'Tunai';
                    else inpChannelLunas.value = 'Tunai';
                }
            }
        } else { container.style.display = 'none'; }
    };

    const renderCart = () => {
        cartContainer.innerHTML = ''; let total = 0;
        currentCart.forEach((item, index) => {
            total += parseFloat(item.hargaDeal) || 0;
            const div = document.createElement('div'); div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-header">
                    <div class="cart-item-id">
                        <span style="color:var(--primary);"># ${item.noTali || '?'}</span>
                        <span class="badge" style="background:rgba(255,255,255,0.05); font-size:0.7rem; font-weight:400; color:var(--text-muted);">${item.warnaTali || ''}</span>
                        <span class="badge" style="background:rgba(255,255,255,0.05); font-size:0.7rem; font-weight:400; color:var(--text-muted);">${String(item.batch || '-').replace('undefined', '-')}</span>
                    </div>
                    <button type="button" class="btn-remove" data-index="${index}" title="Hapus dari daftar">&times;</button>
                </div>
                <div class="cart-item-grid">
                    <div class="form-group" style="margin-bottom:0.75rem;">
                        <label class="form-label" style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:4px;">Sohibul Qurban / Pendaftar</label>
                        <input type="text" class="form-control inp-sohibul" data-index="${index}" value="${item.namaSohibul || ''}" placeholder="Masukkan nama pendaftar...">
                    </div>
                    <div class="cart-item-prices">
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label" style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:4px;">Harga Kandang</label>
                            <div style="position:relative;">
                                <span style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.75rem; opacity:0.5;">Rp</span>
                                <input type="text" class="form-control" style="padding-left:28px; background:rgba(255,255,255,0.03); color:var(--text-muted); border-color:rgba(255,255,255,0.02);" value="${window.formatNum(item.hargaKandang)}" readonly>
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label" style="font-size:0.7rem; color:var(--primary); display:block; margin-bottom:4px; font-weight:600;">Harga Deal</label>
                            <div style="position:relative;">
                                <span style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.75rem; color:var(--primary); opacity:0.7;">Rp</span>
                                <input type="text" class="form-control inp-deal money-input" data-index="${index}" value="${window.formatNum(item.hargaDeal)}" style="padding-left:28px; border-color:rgba(var(--primary-rgb), 0.2); background:rgba(var(--primary-rgb), 0.05); color:var(--primary); font-weight:600;">
                            </div>
                        </div>
                    </div>
                </div>
            `;
            cartContainer.appendChild(div);
        });
        displayTotalDeal.textContent = `TOTAL: ${window.formatRp(total)}`; updateKomisiUI();
        document.querySelectorAll('.inp-deal').forEach(inp => {
            window.setupMoneyMask(inp);
            inp.addEventListener('input', (e) => { 
                const raw = window.parseNum(e.target.value); 
                currentCart[e.target.dataset.index].hargaDeal = raw; 
                const subTotal = currentCart.reduce((s,i) => s + (parseFloat(i.hargaDeal)||0), 0); 
                displayTotalDeal.textContent = `TOTAL: ${window.formatRp(subTotal)}`; 
                updateKomisiUI(); 
            });
        });
        document.querySelectorAll('.inp-sohibul').forEach(inp => { inp.addEventListener('input', (e) => { currentCart[e.target.dataset.index].namaSohibul = e.target.value; }); });
        document.querySelectorAll('.btn-remove').forEach(btn => { btn.addEventListener('click', async (e) => { currentCart.splice(parseInt(e.target.dataset.index), 1); renderCart(); await refreshKambingDropdown(); }); });
    };

    const renderTable = async () => {
        const linkedAgen = profile?.permissions?.linkedAgen || '';
        const profileName = (profile?.full_name || '').toLowerCase();
        
        // 1. Fetch Trx Data only
        let query = supabase.from('transaksi').select('*');
        if (!isAdmin && !linkedAgen && !profileName) { 
            tableBody.innerHTML = '<tr><td colspan="10">Data tidak ditemukan.</td></tr>'; 
            return; 
        }

        const { data: trxData, error } = await query;
        if (error) { console.error("Query Error:", error); return; }
        
        let trx = [...(trxData || [])];
        lastTrxData = trx; // Sync for global use
        const keyword = (inpGlobalSearch ? inpGlobalSearch.value : '').toLowerCase().trim();

        // 2. Fetch Support Data (Cached for this render)
        const [editReqsRes, kambingDb] = await Promise.all([
            supabase.from('edit_requests').select('*').eq('status', 'pending'),
            getKambingDb()
        ]);
        const editReqs = editReqsRes.data || [];

        // 3. Apply Filter Role
        if (!isAdmin) { 
            const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
            const search = clean(linkedAgen || profileName);
            trx = trx.filter(t => {
                const name = clean(typeof t.agen === 'string' ? t.agen : (t.agen?.nama || ''));
                const id = clean(t.agen?.id || '');
                return name === search || id === search || name.includes(search);
            });
        }

        // 4. Apply Search Keyword
        if (keyword) { 
            trx = trx.filter(t => 
                (t.id || '').toLowerCase().includes(keyword) || 
                (t.customer?.nama || '').toLowerCase().includes(keyword) || 
                (t.agen?.nama || '').toLowerCase().includes(keyword) || 
                (t.customer?.wa1 || '').toLowerCase().includes(keyword)
            ); 
        }

        // 5. Sort
        trx.sort((a, b) => { 
            let vA, vB;
            
            // Mapping column to values
            switch(currentSort.column) {
                case 'sisa':
                    vA = (a.total_deal || 0) - (a.total_paid || 0);
                    vB = (b.total_deal || 0) - (b.total_paid || 0);
                    break;
                case 'totalDeal':
                    vA = a.total_deal || 0;
                    vB = b.total_deal || 0;
                    break;
                case 'totalPaid':
                    vA = a.total_paid || 0;
                    vB = b.total_paid || 0;
                    break;
                case 'agen':
                    vA = (a.agen?.nama || '').toLowerCase();
                    vB = (b.agen?.nama || '').toLowerCase();
                    break;
                case 'customer':
                    vA = (a.customer?.nama || '').toLowerCase();
                    vB = (b.customer?.nama || '').toLowerCase();
                    break;
                case 'tglAntar':
                    vA = a.delivery?.tgl || '';
                    vB = b.delivery?.tgl || '';
                    break;
                case 'id':
                default:
                    vA = a.id || '';
                    vB = b.id || '';
            }

            if (currentSort.direction === 'asc') {
                return vA < vB ? -1 : (vA > vB ? 1 : 0);
            } else {
                return vA > vB ? -1 : (vA < vB ? 1 : 0);
            }
        });

        tableBody.innerHTML = '';
        trx.forEach(t => {
            const hasPendingEdit = editReqs.find(r => r.trx_id === t.id);
            const sisa = (t.total_deal || 0) - (t.total_paid || 0);
            const itemsHtml = `<div style="display:flex; flex-wrap:wrap; gap:6px;">` + (t.items || []).map(item => { 
                const kMeta = kambingDb.find(k => k.id === item.goatId); 
                let badgeColor = 'var(--primary)';
                if (kMeta?.status_kesehatan === 'Sakit') badgeColor = 'var(--warning)';
                if (kMeta?.status_kesehatan === 'Mati') badgeColor = 'var(--danger)';

                return `
                    <div style="display:inline-flex; align-items:center; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:4px 8px; font-size:0.75rem; transition: var(--transition); cursor:pointer;" 
                         onclick="window.viewGoatPhoto('${item.goatId}')">
                        <span style="color:${badgeColor}; font-weight:600; margin-right:4px;">No.${item.noTali} ${item.label_printed ? '<span title="Label Sudah Dicetak">🏷️</span>' : ''}</span>
                        <span style="color:var(--text-muted); font-size:0.65rem;">${kMeta?.warna_tali || item.warnaTali || '-'}</span>
                    </div>`; 
            }).join('') + `</div>`;
            
            const tr = document.createElement('tr');
            const isOwner = (t.agen?.id === (profile?.linked_agen_id || '')) || ((t.agen?.nama || '').toLowerCase() === (profile?.linked_agen_nama || '').toLowerCase());
            const canEdit = isAdmin || isOwner;

            tr.innerHTML = `
                <td style="text-align:center;"><input type="checkbox" class="trx-checkbox" data-id="${t.id}" style="width:16px; height:16px; cursor:pointer;"></td>
                <td>
                    <div style="font-weight:700;">${t.id}</div>
                    <div style="font-size:0.75rem;">${formatTgl(t.tgl_trx)}</div>
                    ${hasPendingEdit ? '<div class="status-pill status-review" style="margin-top:5px; transform: scale(0.85); origin: left center;">⏳ Review</div>' : ''}
                </td>
                <td>${t.agen?.nama || '-'}<br><small>${t.agen?.tipe || 'Agen'}</small></td>
                <td><strong>${t.customer?.nama || '-'}</strong><br><small>WA: ${t.customer?.wa1 || '-'}</small></td>
                <td><small>${t.delivery?.alamat?.kec || '-'}, ${t.delivery?.alamat?.kab || '-'}</small></td>
                <td><strong>${formatTgl(t.delivery?.tgl)}</strong><br><small>${t.delivery?.tipe || '-'}</small></td>
                <td>${itemsHtml}</td>
                <td style="font-weight:700;">${formatRp(t.total_deal)}</td>
                <td style="font-weight:700; color:var(--success);">${formatRp(t.total_paid || 0)}</td>
                <td style="font-weight:700; color:${sisa > 0 ? 'var(--warning)' : 'var(--success)'}">${formatRp(sisa)}</td>
                <td style="text-align:right;"><div class="action-btns">${t.komisi?.needs_approval && isAdmin ? `<button class="btn btn-sm" onclick="approveTrx('${t.id}')">✅</button>` : ''}${canEdit ? `<button class="btn btn-sm" onclick="editFullTrx('${t.id}')">✏️</button>` : ''}${isAdmin ? `<button class="btn btn-sm" onclick="rollbackTrx('${t.id}')">🗑️</button>` : ''}</div></td>
            `;
            tableBody.appendChild(tr);
        });
    };

    window.viewGoatPhoto = async (id) => {
        const { data: k } = await supabase.from('stok_kambing').select('foto_fisik, no_tali, warna_tali').eq('id', id).single();
        if(!k || !k.foto_fisik) return window.showToast('Foto tidak tersedia.', 'warning');
        
        const lb = document.getElementById('photoLightbox');
        const img = document.getElementById('lightboxImg');
        const loader = document.getElementById('lightboxLoading');
        const btnDownload = document.getElementById('btnDownloadLightbox');
        
        if(lb && img) {
            img.style.display = 'none';
            if(loader) {
                loader.style.display = 'block';
                loader.innerHTML = 'Memuat Foto...';
                loader.style.color = 'white';
            }
            
            img.src = window.getDirectDriveLink(k.foto_fisik);
            lb.style.display = 'flex';

            // Setup Overlay Download
            if (btnDownload) {
                btnDownload.onclick = async (ev) => {
                    ev.stopPropagation();
                    const noTali = k.no_tali || '-';
                    const warnaTali = k.warna_tali || '-';
                    const url = window.getDirectDriveLink(k.foto_fisik);

                    try {
                        const originalText = btnDownload.innerHTML;
                        btnDownload.innerHTML = '⏳ Menyiapkan...';
                        btnDownload.style.opacity = '0.7';
                        btnDownload.style.pointerEvents = 'none';

                        const tempImg = new Image();
                        tempImg.crossOrigin = "anonymous";
                        tempImg.src = url;
                        await new Promise((res, rej) => { tempImg.onload = res; tempImg.onerror = rej; });

                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = tempImg.naturalWidth;
                        canvas.height = tempImg.naturalHeight;
                        ctx.drawImage(tempImg, 0, 0);

                        // --- DRAW OVERLAY ---
                        const fontSize = Math.round(canvas.width * 0.035);
                        const barHeight = fontSize * 2.2;
                        ctx.fillStyle = 'rgba(0,0,0,0.6)';
                        ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

                        ctx.fillStyle = 'white';
                        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(`No Tali : ${noTali} | Warna : ${warnaTali}`, canvas.width / 2, canvas.height - (barHeight / 2));

                        const a = document.createElement('a');
                        a.href = canvas.toDataURL('image/jpeg', 0.95);
                        a.download = `kambing_${noTali}.jpg`;
                        a.click();

                        if(window.showToast) window.showToast('Foto Berhasil Diunduh!');
                        btnDownload.innerHTML = originalText;
                    } catch (error) {
                        console.error('Download failed:', error);
                        window.open(url, '_blank');
                    } finally {
                        btnDownload.style.opacity = '1';
                        btnDownload.style.pointerEvents = 'auto';
                    }
                };
            }
            
            img.onerror = () => {
                if(loader) {
                    loader.innerHTML = `Gagal memuat foto.<br><span style="font-size:0.75rem; color:var(--danger); font-style:normal;">Pastikan file di Google Drive sudah diset ke <b>"Anyone with the link can view"</b>.</span>`;
                }
            };
        }
    };

    const performSave = async (sendWA) => {
        const agens = await getAgenDb();
        const searchVal = (inpAgenId.value || '').toLowerCase().trim();
        const matchedAgen = agens.find(a => {
            const fullLabel = `${a.nama} - ${a.tipe || 'Agen'}`.toLowerCase();
            return a.nama.toLowerCase() === searchVal || 
                   fullLabel === searchVal ||
                   searchVal.startsWith(a.nama.toLowerCase() + ' -');
        });
        const trxId = window.editingTrxId || await generateTrxId();
        const total = currentCart.reduce((sum, i) => sum + (parseFloat(i.hargaDeal) || 0), 0);
        const paidNow = parseNum(inpTotalBayarAwal.value);
        let finalChannelDP = inpChannelDP.value; if(finalChannelDP === 'Transfer Bank' && inpRekIdDP.value) finalChannelDP = `TF ${inpRekIdDP.options[inpRekIdDP.selectedIndex].textContent}`;
        const roleNorm = (profile.role || '').toLowerCase().trim();

        try {
            if (window.editingTrxId && roleNorm !== 'agen') await silentRollback(window.editingTrxId, true);
            
            let buktiUrl = window.existingBuktiUrl || null; 
            if (inpBuktiDP?.files.length > 0) { 
                const b64 = await compressImage(inpBuktiDP.files[0]); 
                buktiUrl = await uploadToGDrive(b64, 'FOTO_BUKTI_DP'); 
            }
            
            const dropdownVal = inpAgenId.value || '';
            const fallbackTipe = dropdownVal.includes(' - ') ? dropdownVal.split(' - ').pop() : 'Agen';

            const newTrx = {
                id: trxId, tgl_trx: inpTglOrder.value || window.getLocalDate(),
                agen: { 
                    id: matchedAgen?.id || '', 
                    nama: matchedAgen?.nama || dropdownVal.split(' - ')[0], 
                    tipe: matchedAgen?.tipe || fallbackTipe 
                },
                customer: { nama: document.getElementById('inpCustNama').value, wa1: document.getElementById('inpCustWA1').value, wa2: document.getElementById('inpCustWA2').value, alamat: { kab: inpCustKab.value, kec: inpCustKec.value, desa: document.getElementById('inpCustDesa').value, jalan: document.getElementById('inpCustAlamatJalan').value, maps: document.getElementById('inpMapsLink')?.value || '' } },
                delivery: { tipe: document.getElementById('inpDeliveryTipe').value, tgl: document.getElementById('inpDeliveryTgl').value, alamat: { kab: inpCustKab.value, kec: inpCustKec.value, desa: document.getElementById('inpCustDesa').value, jalan: document.getElementById('inpCustAlamatJalan').value, maps: document.getElementById('inpMapsLink')?.value || '' } },
                items: currentCart, total_deal: total, 
                total_paid: Math.min(paidNow + (window.existingInstallmentsTotal || 0), total),
                total_overpaid: Math.max(0, (paidNow + (window.existingInstallmentsTotal || 0)) - total),
                history_bayar: paidNow > 0 ? [{ payId: 'PAY-'+Date.now(), tgl: inpTglOrder.value || window.getLocalDate(), nominal: paidNow, channel: finalChannelDP, buktiUrl }] : [],
                komisi: { berhak: currentAgenTipeKomisi, nominal: parseNum(inpKomisiNominal?.value), status: 'belum_bayar', needs_approval: roleNorm === 'agen' }
            };

            console.log(`[Edit Debug] Attempting save. ID: ${window.editingTrxId}, Role: ${roleNorm}, Email: ${profile.email}`);

            if (window.editingTrxId && roleNorm === 'agen') {
                console.log("[Edit Debug] Sending to edit_requests table...");
                const { error: reqError } = await supabase.from('edit_requests').insert([{ 
                    trx_id: window.editingTrxId, 
                    new_data: newTrx, 
                    requester_email: profile.email || 'unknown', 
                    status: 'pending' 
                }]);
                
                if(reqError) {
                    console.error("[Edit Debug] Insert failed:", reqError);
                    throw reqError;
                }
                
                showAlert('Permintaan Perubahan Terkirim!', 'success', () => { 
                    modalKeluar.classList.remove('active'); 
                    window.editingTrxId = null; 
                    renderTable();
                }); 
                return;
            }

            const { error: insertError } = await supabase.from('transaksi').insert([newTrx]);
            if (insertError) throw insertError;

            for (const it of currentCart) {
                const { error: stokErr } = await supabase
                    .from('stok_kambing')
                    .update({ status_transaksi: 'Terjual', transaction_id: trxId })
                    .eq('id', it.goatId);
                if (stokErr) console.error('Gagal update stok kambing ID:', it.goatId, stokErr);
            }
            if(paidNow > 0) {
                if (inpChannelDP.value === 'Saldo Titipan Agen') {
                    const agenName = matchedAgen?.nama || '';
                    if (!agenName) throw new Error('Agen tidak ditemukan.');
                    const currentSaldo = await getAgentSaldo(agenName);
                    if (currentSaldo < paidNow) throw new Error(`Saldo Titipan Agen tidak cukup. Tersedia: ${window.formatRp(currentSaldo)}`);

                    // Record Wash Entry (Out from Deposit, In to Sales)
                    const payIdCommon = 'PAY-' + Date.now();
                    await supabase.from('keuangan').insert([
                        { 
                            id: payIdCommon + '-OUT', 
                            tipe: 'pengeluaran', 
                            tanggal: newTrx.tgl_trx, 
                            kategori: 'Pemakaian Titipan Agen', 
                            nominal: paidNow, 
                            channel: 'Tunai / Cash', // Harus sama dengan channel IN agar saldo tidak double count
                            related_trx_id: trxId, 
                            agen_name: agenName,
                            keterangan: `Pemakaian titipan untuk DP Order ${trxId}`
                        },
                        { 
                            id: payIdCommon + '-IN', 
                            tipe: 'pemasukan', 
                            tanggal: newTrx.tgl_trx, 
                            kategori: 'Jual Kambing', 
                            nominal: paidNow, 
                            channel: 'Tunai / Cash', // Berubah dari 'Saldo Titipan' agar masuk ke kas tunai
                            related_trx_id: trxId, 
                            agen_name: agenName,
                            keterangan: `DP via Titipan Agen`
                        }
                    ]);
                } else {
                    await supabase.from('keuangan').insert([{ id: 'PAY-'+Date.now(), tipe: 'pemasukan', tanggal: newTrx.tgl_trx, kategori: 'Jual Kambing', nominal: paidNow, channel: finalChannelDP, related_trx_id: trxId, bukti_url: buktiUrl }]);
                }
            }

            if (sendWA && typeof window.sendWa === 'function') {
                try {
                    const config = await window.getWaConfig();
                    const itemsStr = currentCart.map(it => `• No.${it.noTali} (${it.warnaTali || '-'})`).join('\n');
                    const sohibulStr = currentCart.map(it => `• ${it.noTali}: ${it.namaSohibul || '-'}`).join('\n');
                    
                    // Fetch Goat Photos
                    const goatIds = currentCart.map(it => it.goatId);
                    const { data: goatsData } = await supabase.from('stok_kambing').select('id, foto_fisik').in('id', goatIds);
                    const fotoStr = (goatsData || [])
                        .filter(g => g.foto_fisik)
                        .map(g => window.getDirectDriveLink(g.foto_fisik))
                        .join('\n');

                    // Fetch Official Accounts
                    const reks = await getRekeningDb();
                    const rekStr = (reks || []).map(r => `${r.bank} — ${r.norek} (a.n ${r.an})`).join('\n');

                    const agentTipe = (newTrx.agen?.tipe || '').toUpperCase();
                    const skipCustWA = agentTipe.includes('DM') || agentTipe.includes('EXT');
                    const calculatedKomisi = skipCustWA ? 0 : Math.round(total * 0.10);

                    const historyStr = (newTrx.history_bayar || []).length > 0
                        ? (newTrx.history_bayar || []).map((h, idx) => `• ${formatTgl(h.tgl)}: ${formatRp(h.nominal)} (${idx === 0 ? 'DP' : 'Angsuran'})`).join('\n')
                        : `• DP Dibayar: ${formatRp(paidNow)}`;

                    const infoAgen = matchedAgen ? `${matchedAgen.nama} (${matchedAgen.wa || '-'})` : (newTrx.agen?.nama || '-');
                    
                    const commonData = { 
                        judul: window.editingTrxId ? '*UPDATE DATA PENJUALAN!* 🔄' : '*NOTIFIKASI PENJUALAN BARU!* 🚀',
                        nama: newTrx.customer?.nama || '-', 
                        id: trxId, 
                        tgl: formatTgl(newTrx.tgl_trx), 
                        total: formatRp(total), 
                        dp: formatRp(paidNow), 
                        history: historyStr,
                        sisa: formatRp(total - newTrx.total_paid), 
                        items: itemsStr, 
                        sohibul: sohibulStr, 
                        foto: fotoStr || '-',
                        rekening: rekStr || '-',
                        info_agen: infoAgen,
                        alamat: (newTrx.customer?.alamat?.jalan || '') + ', ' + (newTrx.customer?.alamat?.kec || ''), 
                        maps: newTrx.customer?.alamat?.maps || '-',
                        wa_konsumen: newTrx.customer?.wa1 || '-', 
                        nama_agen: newTrx.agen?.nama || '-', 
                        jadwal: formatTgl(newTrx.delivery?.tgl),
                        komisi: formatRp(calculatedKomisi)
                    };
                    
                    // Notif Ke Konsumen (Hanya jika BUKAN agen DM/EXT)
                    if (newTrx.customer?.wa1 && !skipCustWA) {
                        const templateCust = newTrx.delivery?.tipe === 'ambil_sendiri' ? config.templateOrderDM : config.templateOrderNormal;
                        const msgCust = await window.parseWaTemplate(templateCust, commonData);
                        
                        const res = await window.sendWa(newTrx.customer.wa1, msgCust);
                        if (!res.success) {
                            window.showConfirm(`WA Konsumen Gagal: ${res.msg}\n\nIngin kirim manual?`, () => {
                                window.open(res.link, '_blank');
                            }, null, 'WA Gateway Masalah', 'Kirim Manual', 'btn-primary');
                        }
                    }
                    
                    const agenData = matchedAgen;
                    let templateAgen = skipCustWA ? config.templateAgentDM : config.templateAgentNormal;
                    
                    // FALLBACK: Jika template khusus DM/EXT kosong, gunakan template normal agar WA tetap terkirim
                    if (skipCustWA && (!templateAgen || templateAgen.trim() === "")) {
                        console.warn('[WA] Template DM/EXT kosong, menggunakan template Agent Normal sebagai cadangan.');
                        templateAgen = config.templateAgentNormal;
                    }

                    if (agenData && agenData.wa) {
                        const msgAgenParsed = await window.parseWaTemplate(templateAgen, commonData);
                        if (!msgAgenParsed || msgAgenParsed.trim() === "") {
                            window.showAlert('⚠️ WA TIDAK TERKIRIM!<br><br>Penyebab: <b>Isi pesan Agen Kosong</b>. Silakan cek Template WA di Pengaturan.', 'warning');
                        } else {
                            console.log(`[WA] Menyiapkan pengiriman Ke Agen: ${agenData.nama} (${agenData.wa})`);
                            // Debugging alert (Hanya untuk pelacakan, bisa dihapus nanti)
                            // window.showToast('Mengirim WA ke ' + agenData.nama + '...', 'info');
                            
                            const resA = await window.sendWa(agenData.wa, msgAgenParsed);
                            
                            if (!resA.success) {
                                await window.showAlert(`⚠️ WA AGEN GAGAL OTOMATIS<br><br>Error: ${resA.msg}<br><br>Kami menawarkan opsi manual...`, 'warning');
                                await window.showConfirm(`Gagal otomatis. Ingin kirim lewat WA Web/Aplikasi?`, () => {
                                    window.open(resA.link, '_blank');
                                });
                            } else {
                                window.showToast('✅ WA Agen Berhasil Terkirim!', 'success');
                            }

                            // Notifikasi Saldo Terpotong
                            if (inpChannelDP.value === 'Saldo Titipan Agen') {
                                const currentSaldo = await getAgentSaldo(agenData.nama);
                                const msgSaldo = `*NOTIFIKASI SALDO TITIPAN*\n\nHalo ${agenData.nama},\nSaldo titipan Anda telah terpotong sebesar *${formatRp(paidNow)}* untuk pembayaran DP *${trxId}*.\n\nSisa saldo titipan Anda saat ini: *${formatRp(currentSaldo)}*.\n\nTerima kasih.`;
                                await window.sendWa(agenData.wa, msgSaldo);
                            }
                        }
                    } else {
                        const displayNama = matchedAgen?.nama || newTrx.agen?.nama || inpAgenId.value;
                        console.warn('[WA] Data Agen/WA tidak ditemukan untuk:', displayNama);
                        await window.showAlert(`⚠️ WA AGEN TIDAK TERKIRIM!<br><br>Penyebab: <b>Nomor WA untuk agen "${displayNama}" tidak ditemukan</b> atau data tidak cocok.<br><br>Pastikan nomor di Pengaturan sudah benar.`, 'danger');
                    }
                } catch (e) {
                    console.error('WA Err:', e);
                    await window.showAlert(`⚠️ SYSTEM ERROR (WA)<br><br>Terjadi kesalahan teknis saat mengirim WA: ${e.message}`, 'danger');
                }
            }
            
            showAlert('Berhasil Disimpan!', 'success', () => { modalKeluar.classList.remove('active'); renderTable(); window.editingTrxId = null; });
        } catch (err) {
            console.error('Save failed:', err);
            showAlert('Gagal Menyimpan: ' + err.message, 'danger');
        }
    };

    const silentRollback = async (trxId, keepInstallments = false) => {
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
        if(!trx) return;
        for (const it of trx.items) await supabase.from('stok_kambing').update({ status_transaksi: 'Tersedia', transaction_id: null }).eq('id', it.goatId);
        
        if (!keepInstallments) {
            await supabase.from('keuangan').delete().eq('related_trx_id', trxId);
            window.existingInstallmentsTotal = 0;
        } else {
            // Hanya ambil nominal cicilan (Pelunasan Order), abaikan DP (Jual Kambing) karena DP akan diinput ulang/diedit
            const { data: fin } = await supabase.from('keuangan').select('nominal').eq('related_trx_id', trxId).neq('kategori', 'Jual Kambing');
            window.existingInstallmentsTotal = fin?.reduce((s,f) => s + f.nominal, 0) || 0;
            // Hapus record DP lama dari keuangan
            await supabase.from('keuangan').delete().eq('related_trx_id', trxId).eq('kategori', 'Jual Kambing');
        }
        await supabase.from('transaksi').delete().eq('id', trxId);
    };

    window.rollbackTrx = async (trxId) => { showConfirm('Batalkan transaksi?', async () => { await silentRollback(trxId); showToast('Dibatalkan'); await renderTable(); }); };
    window.approveTrx = async (trxId) => { 
        const { data: trx } = await supabase.from('transaksi').select('komisi').eq('id', trxId).single();
        if (trx) {
            const upKomisi = { ...trx.komisi, needs_approval: false };
            await supabase.from('transaksi').update({ komisi: upKomisi }).eq('id', trxId); 
            await renderTable(); 
        }
    };

    window.deleteHistoryItem = async (trxId, payId, payNominal) => {
        showConfirm('Hapus riwayat bayar?', async () => {
            const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
            const updatedHistory = trx.history_bayar.filter(h => h.payId !== payId);
            await supabase.from('transaksi').update({ total_paid: trx.total_paid - payNominal, history_bayar: updatedHistory }).eq('id', trxId);
            await supabase.from('keuangan').delete().eq('id', payId);
            await renderTable(); modalLunas.classList.remove('active');
        });
    };

    const performSaveLunas = async (nominal, trxId, channel, tgl, kirimWA) => {
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
        const payId = 'PAY-' + Date.now();
        const updatedHistory = [...(trx.history_bayar || []), { payId, tgl, nominal, channel }];
        const totalPaidNew = (trx.total_paid || 0) + nominal;
        
        await supabase.from('transaksi').update({ total_paid: totalPaidNew, history_bayar: updatedHistory }).eq('id', trxId);
        
        if (channel === 'Saldo Titipan Agen') {
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
                    channel: 'Tunai / Cash', // Harus sama dengan channel IN
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
                    channel: 'Tunai / Cash', // Berubah dari 'Saldo Titipan' agar masuk ke kas tunai
                    related_trx_id: trxId, 
                    agen_name: agenName,
                    keterangan: `Pelunasan via Titipan Agen`
                }
            ]);
        } else {
            await supabase.from('keuangan').insert([{ id: payId, tipe: 'pemasukan', tanggal: tgl, kategori: 'Pelunasan Order', nominal, channel, related_trx_id: trxId }]);
        }
        
        if (kirimWA && typeof window.sendWa === 'function') {
            try {
                const config = await window.getWaConfig();
                const commonData = {
                    nama: trx.customer.nama,
                    id: trx.id,
                    tgl: formatTgl(tgl),
                    nominal: formatRp(nominal),
                    sisa: formatRp(trx.total_deal - totalPaidNew),
                    nama_agen: trx.agen.nama
                };

                // 1. Notif Ke Konsumen (Hanya jika BUKAN agen DM)
                const isDMAgen = (trx.agen?.tipe || '').toUpperCase().includes('DM');
                if (trx.customer.wa1 && !isDMAgen) {
                    const msgCust = await window.parseWaTemplate(config.templateLunas, commonData);
                    const res = await window.sendWa(trx.customer.wa1, msgCust);
                    if (!res.success) {
                        window.showConfirm(`WA Pelunasan Gagal: ${res.msg}\n\nIngin kirim manual?`, () => {
                            window.open(res.link, '_blank');
                        }, null, 'WA Gateway Masalah', 'Kirim Manual', 'btn-primary');
                    }
                }

                // 2. Notif Ke Agen
                const msgAgen = await window.parseWaTemplate(config.templateLunasAgent, commonData);
                const allAgens = await getAgenDb();
                const agenData = allAgens.find(a => a.id === trx.agen.id || a.nama === trx.agen.nama);
                if (agenData && agenData.wa) {
                    await window.sendWa(agenData.wa, msgAgen);
                }
            } catch (e) {
                console.error('WA Lunas Err:', e);
            }
        }
        showAlert('Pembayaran Berhasil!', 'success', () => { modalLunas.classList.remove('active'); renderTable(); });
    };

    window.editFullTrx = async (trxId) => {
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
        if(!trx) return;
        window.editingTrxId = trx.id;
        await initForm();
        
        if (inpTglOrder) inpTglOrder.value = trx.tgl_trx || window.getLocalDate();
        document.getElementById('inpCustNama').value = trx.customer.nama || '';
        document.getElementById('inpCustWA1').value = trx.customer.wa1 || '';
        document.getElementById('inpCustWA2').value = trx.customer.wa2 || '';
        
        inpCustKab.value = trx.customer.alamat.kab || '';
        inpCustKab.dispatchEvent(new Event('change'));
        setTimeout(() => {
            inpCustKec.value = trx.customer.alamat.kec || '';
            document.getElementById('inpCustDesa').value = trx.customer.alamat.desa || '';
            document.getElementById('inpCustAlamatJalan').value = trx.customer.alamat.jalan || '';
            document.getElementById('inpMapsLink').value = trx.customer.alamat.maps || '';
        }, 500);

        document.getElementById('inpDeliveryTipe').value = trx.delivery.tipe || 'diantar';
        document.getElementById('inpDeliveryTgl').value = trx.delivery.tgl || '';
        
        inpAgenId.value = `${trx.agen.nama} - ${trx.agen.tipe || 'Agen'}`;
        await handleAgenChange();
        
        // Fix: Refresh metadata from DB when editing to capture latest goat info
        const { data: currentGoats } = await supabase.from('stok_kambing').select('*').in('id', trx.items.map(i => i.goatId));
        currentCart = trx.items.map(it => {
            const dbRef = (currentGoats || []).find(g => g.id === it.goatId);
            return {
                ...it,
                batch: dbRef?.batch || it.batch || '-',
                noTali: dbRef?.no_tali || it.noTali || '?',
                warnaTali: dbRef?.warna_tali || it.warnaTali || '-',
                hargaKandang: dbRef?.harga_kandang || it.hargaKandang || 0
            };
        });
        renderCart();
        
        const firstPay = trx.history_bayar?.find(h => h.payId && h.payId.startsWith('PAY-'));
        if (firstPay && !trx.total_paid) {
             // legacy handle
        }
        
        const { data: dpFin } = await supabase.from('keuangan').select('nominal').eq('related_trx_id', trx.id).eq('kategori', 'Jual Kambing').single();
        
        if (inpTotalBayarAwal) {
            inpTotalBayarAwal.value = dpFin ? formatNum(dpFin.nominal) : '';
            inpTotalBayarAwal.disabled = !isAdmin; // Hanya Admin yang bisa edit DP yang sudah masuk
        }

        // Restore Payment Channel & Photo
        const dpRecord = (trx.history_bayar || []).find(h => !h.payId?.includes('LUNAS'));
        if (dpRecord) {
            const rawChan = dpRecord.channel || 'Tunai';
            if (rawChan.startsWith('TF ')) {
                inpChannelDP.value = 'Transfer Bank';
                await handleChannelChangeLocal('Transfer Bank', containerRekDP, inpRekIdDP);
                const rekSearch = rawChan.replace('TF ', '').trim();
                for (let i = 0; i < inpRekIdDP.options.length; i++) {
                    if (inpRekIdDP.options[i].textContent.includes(rekSearch)) {
                        inpRekIdDP.selectedIndex = i;
                        break;
                    }
                }
            } else {
                inpChannelDP.value = (rawChan === 'Cash' || rawChan === 'Tunai / Cash') ? 'Tunai' : rawChan;
                containerRekDP.style.display = 'none';
            }

            if (dpRecord.buktiUrl) {
                window.existingBuktiUrl = dpRecord.buktiUrl;
                if (imgPreviewDP) {
                    imgPreviewDP.src = dpRecord.buktiUrl;
                    imgPreviewDP.style.display = 'block';
                }
                if (previewBuktiDP) previewBuktiDP.style.display = 'flex';
            }
        }
        
        modalKeluar.classList.add('active');
    };


    if (formTerjual) {
        formTerjual.addEventListener('submit', (e) => { e.preventDefault(); if(currentCart.length === 0) return; showChoice("Simpan Transaksi?", [{ text: "📲 Simpan & WA", callback: () => performSave(true) }, { text: "💾 Simpan Saja", callback: () => performSave(false) }]); });
    }
    
    // Global Access
    window.terimaLunas = (trxId) => {
        selOrderLunas.innerHTML = '<option value="">-- Pilih Order --</option>';
        supabase.from('transaksi').select('*').then(({data}) => {
            data.filter(t => t.total_deal > t.total_paid).forEach(t => { const opt = document.createElement('option'); opt.value = t.id; opt.textContent = `${t.id} - ${t.customer.nama} | Sisa: ${formatRp(t.total_deal-t.total_paid)}`; selOrderLunas.appendChild(opt); });
            if(trxId) { selOrderLunas.value = trxId; selOrderLunas.dispatchEvent(new Event('change')); }
        });
        modalLunas.classList.add('active');
    };

    if (selOrderLunas) {
        selOrderLunas.addEventListener('change', async () => {
            const { data: trx } = await supabase.from('transaksi').select('*').eq('id', selOrderLunas.value).single();
            if(!trx) return;
            detailOrderLunas.innerHTML = `ID: ${trx.id} | Sisa: ${formatRp(trx.total_deal-trx.total_paid)}`;
            let hist = ''; (trx.history_bayar || []).forEach(h => { hist += `<div>${formatTgl(h.tgl)} - ${formatRp(h.nominal)} <button onclick="deleteHistoryItem('${trx.id}','${h.payId}',${h.nominal})">🗑️</button></div>`; });
            historiPayLunas.innerHTML = hist;
            inpNominalLunas.value = formatNum(trx.total_deal - trx.total_paid);
            infoOrderLunas.style.display = 'block'; formInputLunas.style.display = 'block'; btnSimpanLunas.disabled = false;
        });
    }

    if (btnSimpanLunas) btnSimpanLunas.addEventListener('click', () => { performSaveLunas(parseNum(inpNominalLunas.value), selOrderLunas.value, inpChannelLunas.value, inpTglLunas.value, true); });

    const btnTambahGlobal = document.getElementById('btnTambahTerjual');
    if (btnTambahGlobal) btnTambahGlobal.addEventListener('click', () => { window.editingTrxId = null; initForm(); modalKeluar.classList.add('active'); });
    
    // Fix: Handle both btnCloseModal and btnCancelModal
    const closeMainModal = () => modalKeluar.classList.remove('active');
    const closeBtn1 = document.getElementById('btnCloseModal');
    const closeBtn2 = document.getElementById('btnCancelModal');
    if (closeBtn1) closeBtn1.addEventListener('click', closeMainModal);
    if (closeBtn2) closeBtn2.addEventListener('click', closeMainModal);
    
    const closeBtnLunas = document.getElementById('btnCloseLunasModal');
    if (closeBtnLunas) closeBtnLunas.addEventListener('click', () => modalLunas.classList.remove('active'));
    
    const btnBatalLunas = document.getElementById('btnBatalLunas');
    if (btnBatalLunas) btnBatalLunas.addEventListener('click', () => modalLunas.classList.remove('active'));
    
    if (inpSearchKambing) inpSearchKambing.addEventListener('change', async () => { await addKambingToCart(); });
    if (btnAddKambing) btnAddKambing.addEventListener('click', async () => { await addKambingToCart(); });
    if (inpAgenId) inpAgenId.addEventListener('change', async () => { await handleAgenChange(); });
    if (inpChannelDP) inpChannelDP.addEventListener('change', () => handleChannelChangeLocal(inpChannelDP.value, containerRekDP, inpRekIdDP, 'DP'));
    if (inpChannelLunas) inpChannelLunas.addEventListener('change', () => handleChannelChangeLocal(inpChannelLunas.value, containerRekLunas, inpRekIdLunas, 'Lunas'));

    const addKambingToCart = async () => {
        const db = await getKambingDb();
        const searchVal = inpSearchKambing.value.trim();
        
        // Cari kambing yang Tersedia dan cocok dengan signature (No.XX | Batch YY) 
        // ATAU cocok persis dengan No Tali jika hanya diketik angkanya
        const goat = db.find(k => {
            // Perbaikan: Izinkan pencarian kambing Terjual JIKA ia milik transaksi yang sedang diedit
            const isAssignedToThisTrx = k.transaction_id === window.editingTrxId;
            if (k.status_transaksi !== 'Tersedia' && !isAssignedToThisTrx) return false;

            const signature = `No.${k.no_tali} | ${k.batch}`;
            return signature === searchVal || String(k.no_tali) === searchVal;
        });

        if(goat) { 
            currentCart.push({ goatId: goat.id, noTali: goat.no_tali, batch: goat.batch, hargaKandang: goat.harga_kandang, hargaDeal: goat.harga_kandang, warnaTali: goat.warna_tali }); 
            renderCart(); 
            await refreshKambingDropdown(); 
            inpSearchKambing.value = ''; 
        } else if (searchVal) {
            window.showToast('Kambing tidak ditemukan atau sudah terjual.', 'warning');
        }
    };

    // Listener Pencarian Dinamis (Hanya Filter No Tali)
    inpSearchKambing?.addEventListener('input', (e) => {
        const val = e.target.value;
        // Hanya trigger refresh jika belum berupa pilihan lengkap (signature)
        if (!val.includes('|')) {
            refreshKambingDropdown(val);
        }
    });

    const btnExport = document.getElementById('btnExportCsv');
    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const { data: trxsRaw } = await supabase.from('transaksi').select('*');
            if (!trxsRaw) return;

            let trxs = [...trxsRaw];
            
            // Apply filtering logic (same as renderTable)
            if (!isAdmin) {
                const linkedAgen = profile?.permissions?.linkedAgen || '';
                const profileName = (profile?.full_name || '').toLowerCase();
                const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

                if (linkedAgen) {
                    const search = clean(linkedAgen);
                    trxs = trxs.filter(t => {
                        if (!t.agen) return false;
                        const name = clean(typeof t.agen === 'string' ? t.agen : (t.agen.nama || ''));
                        const id = clean(t.agen.id || '');
                        return name === search || id === search || name.includes(search) || search.includes(name);
                    });
                } else if (profileName) {
                    const search = clean(profileName);
                    trxs = trxs.filter(t => {
                        if (!t.agen) return false;
                        const name = clean(typeof t.agen === 'string' ? t.agen : (t.agen.nama || ''));
                        return name === search || name.includes(search);
                    });
                }
            }

            let exportData = [];
            
            // Fix: Ambil data kambing terbaru untuk fallback Warna Tali/Batch yang kosong di transaksi lama
            const allGoats = await getKambingDb();
            const goatMap = new Map(allGoats.map(g => [g.id, g]));

            trxs.forEach(t => {
                const sisa = (t.total_deal || 0) - (t.total_paid || 0);
                // Pecah data per item (kambing)
                (t.items || []).forEach((it, idx) => {
                    const dbGoat = goatMap.get(it.goatId);
                    const warnaActual = it.warnaTali || dbGoat?.warna_tali || '';
                    const batchActual = it.batch || dbGoat?.batch || '';
                    
                    const addr = t.customer?.alamat || {};
                    const fullAddress = `${addr.jalan || ''}, ${addr.desa || ''}, ${addr.kec || ''}, ${addr.kab || ''}`.replace(/^, |, $/g, '').replace(/, , /g, ', ');
                    
                    exportData.push({
                        'ID Transaksi': t.id,
                        'Tgl Transaksi': t.tgl_trx,
                        'Agen': t.agen?.nama || '-',
                        'Customer': t.customer?.nama || '-',
                        'WA 1': t.customer?.wa1 || '',
                        'WA 2': t.customer?.wa2 || '',
                        'Alamat Lengkap': fullAddress || '',
                        'Tgl Deli': t.delivery?.tgl || '',
                        'Tipe Deli': t.delivery?.tipe || '',
                        'No Tali': it.noTali || dbGoat?.no_tali || '',
                        'Warna Tali': warnaActual,
                        'Nama Sohibul': it.namaSohibul || '',
                        'Harga Deal Item': parseFloat(it.hargaDeal) || 0,
                        'Total Nota': idx === 0 ? (parseFloat(t.total_deal) || 0) : 0,
                        'Total DP/Bayar': idx === 0 ? (parseFloat(t.total_paid) || 0) : 0,
                        'Sisa Tagihan Nota': idx === 0 ? (parseFloat(sisa) || 0) : 0,
                        'Status Komisi': t.komisi?.status || ''
                    });
                });
            });

            if (typeof XLSX !== 'undefined') {
                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Histori Penjualan");
                XLSX.writeFile(wb, `Histori_Penjualan_Detail_${new Date().getTime()}.xlsx`);
            } else {
                window.showAlert("Library Export gagal dimuat.", 'danger');
            }
        });
    }

    if (inpCustKab && inpCustKec) {
        inpCustKab.addEventListener('change', () => {
            const kab = inpCustKab.value;
            inpCustKec.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
            if (kab && BB_REGIONS[kab]) {
                inpCustKec.disabled = false;
                BB_REGIONS[kab].forEach(kec => {
                    const opt = document.createElement('option');
                    opt.value = kec;
                    opt.textContent = kec;
                    inpCustKec.appendChild(opt);
                });
            } else {
                inpCustKec.disabled = true;
            }
        });
    }

    if (inpGlobalSearch) {
        inpGlobalSearch.addEventListener('input', debounce(() => {
            renderTable();
        }, 300));
    }

    // --- BULK ACTION & PRINT LABEL LOGIC ---
    const checkAll = document.getElementById('checkAll');
    const btnCetakLabel = document.getElementById('btnCetakLabel');
    const selectCount = document.getElementById('selectCount');

    const updateSelectionUI = () => {
        const checked = document.querySelectorAll('.trx-checkbox:checked');
        if (selectCount) selectCount.textContent = checked.length;
        if (btnCetakLabel) btnCetakLabel.style.display = checked.length > 0 ? 'inline-block' : 'none';
    };

    if (checkAll) {
        checkAll.addEventListener('change', () => {
            document.querySelectorAll('.trx-checkbox').forEach(cb => cb.checked = checkAll.checked);
            updateSelectionUI();
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('trx-checkbox')) {
            updateSelectionUI();
            if (!e.target.checked && checkAll) checkAll.checked = false;
        }
    });

    window.printLabels = async () => {
        const btn = document.getElementById('btnCetakLabel');
        const originalHtml = btn.innerHTML;
        
        try {
            // 1. Ambil ID yang dicentang
            const selectedIds = Array.from(document.querySelectorAll('.trx-checkbox:checked')).map(cb => cb.dataset.id);
            if (selectedIds.length === 0) {
                return window.showToast('Pilih setidaknya satu transaksi!', 'warning');
            }

            // 2. Feedback visual
            btn.innerHTML = '⏳ Menyiapkan...';
            btn.disabled = true;

            // 3. Buka jendela SEGERA (User Gesture Context)
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                return window.showAlert('⚠️ Jendela cetak diblokir browser! Klik ikon "Popup Blocked" di address bar (kanan atas) dan pilih "Selalu Izinkan".', 'danger');
            }
            printWindow.document.write('<html><body style="font-family:sans-serif; text-align:center; padding-top:100px;"><h2>Sedang menyiapkan label...</h2><p>Mohon tunggu sebentar.</p></body></html>');

            // 4. Tarik data segar dari Database
            const { data: selectedTrx, error: trxErr } = await supabase.from('transaksi').select('*').in('id', selectedIds);
            if (trxErr) throw trxErr;
            if (!selectedTrx || selectedTrx.length === 0) throw new Error("Data transaksi tidak ditemukan.");

            const labelData = [];
            for (const t of selectedTrx) {
                (t.items || []).forEach(it => {
                    const name1 = (it.namaSohibul || t.customer?.nama || t.agen?.nama || '---').trim().toUpperCase();
                    labelData.push({
                        sohibul: name1,
                        info: `No.${it.noTali} [${it.warnaTali || '-'}]`,
                        agen: t.agen?.nama || '-'
                    });
                });
            }

            if (labelData.length === 0) {
                printWindow.close();
                throw new Error("Tidak ada item kambing dalam transaksi terpilih.");
            }

            // 5. Tandai sudah dicetak di DB (Background)
            for (const trx of selectedTrx) {
                const updatedItems = (trx.items || []).map(it => ({ ...it, label_printed: true }));
                await supabase.from('transaksi').update({ items: updatedItems }).eq('id', trx.id);
            }
            setTimeout(() => renderTable(), 500);

            // 6. Tulis HTML Akhir
            const labelsHtml = labelData.map(l => `
                <div class="label-box">
                    <div class="sohibul">${l.sohibul}</div>
                    <div class="divider"></div>
                    <div class="footer">
                        <span>${l.info}</span>
                        <span style="opacity:0.7;">${l.agen}</span>
                    </div>
                </div>
            `).join('');

            const content = `
                <html>
                <head>
                    <title>Cetak Label Kalung</title>
                    <style>
                        @page { size: A4; margin: 1cm; }
                        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; }
                        .page-grid { 
                            display: grid; 
                            grid-template-columns: 7.5cm 7.5cm; 
                            column-gap: 1cm;
                            row-gap: 5px;
                        }
                        .label-box {
                            width: 7.5cm; 
                            height: 1.5cm;
                            border: 0.3pt solid #ddd;
                            padding: 0.1cm 0.3cm;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            overflow: hidden;
                            box-sizing: border-box;
                        }
                        .sohibul {
                            font-weight: 900;
                            font-size: 12pt;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            text-align: center;
                            line-height: 1.2;
                        }
                        .divider {
                            border-top: 0.5pt dashed #ccc;
                            margin: 2px 0;
                        }
                        .footer {
                            font-size: 8pt;
                            font-weight: 500;
                            color: #444;
                            display: flex;
                            justify-content: space-between;
                            white-space: nowrap;
                        }
                    </style>
                </head>
                <body onload="setTimeout(() => { window.print(); window.close(); }, 500);">
                    <div class="page-grid">
                        ${labelsHtml}
                    </div>
                </body>
                </html>
            `;

            printWindow.document.open();
            printWindow.document.write(content);
            printWindow.document.close();

        } catch (err) {
            console.error('Print Error:', err);
            window.showAlert('❌ GAGAL CETAK: ' + err.message, 'danger');
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    };

    if (btnCetakLabel) {
        btnCetakLabel.addEventListener('click', () => {
            window.printLabels();
        });
    }

    renderTable();
});
