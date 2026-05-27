import { supabase } from './supabase.js';

// Aspek Penilaian mapping untuk rendering chart & modal
const ASPECT_NAMES = {
    // Sohibul Qurban
    'hewan': 'Kualitas & Kesehatan Hewan',
    'kandang': 'Kondisi & Kebersihan Kandang',
    'pelayanan': 'Keramahan & Kejelasan Pelayanan',
    'transaksi': 'Administrasi & Kemudahan Transaksi',
    'pengiriman': 'Ketepatan & Keamanan Pengiriman',
    // Agen
    'aplikasi': 'Akses Informasi Stok & Harga',
    'marketing': 'Kualitas Dukungan Marketing',
    'komisi': 'Transparansi & Ketepatan Komisi',
    'koordinasi': 'Kerjasama & Respon Tim Kandang',
    'stok': 'Kualitas Stok Hewan Kurban',
    'konsumen': 'Kepuasan Konsumen Agen'
};

const ASPECT_KEYS_SOHIBUL = ['hewan', 'kandang', 'pelayanan', 'transaksi', 'pengiriman'];
const ASPECT_KEYS_AGEN = ['aplikasi', 'marketing', 'komisi', 'koordinasi', 'stok', 'konsumen'];

let rawSurveyData = [];
let filteredSurveyData = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Pastikan session sudah terverifikasi (ditangani oleh layout_v53.js)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout_v53 akan mengarahkan ke login.html

    initEvents();
    await fetchSurveyData();
});

function initEvents() {
    // Input filter events
    document.getElementById('inpFilterSearch').addEventListener('input', applyFilters);
    document.getElementById('inpFilterRole').addEventListener('change', applyFilters);
    document.getElementById('inpFilterScore').addEventListener('change', applyFilters);

    // Export CSV click
    document.getElementById('btnExportCSV').addEventListener('click', handleExportCSV);

    // Modal Close
    document.getElementById('mdlFbCloseBtn').addEventListener('click', () => {
        document.getElementById('modalFbDetailOverlay').classList.remove('active');
    });
    
    // Close modal when clicking overlay bg
    document.getElementById('modalFbDetailOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalFbDetailOverlay') {
            document.getElementById('modalFbDetailOverlay').classList.remove('active');
        }
    });
}

// Mengambil data survey dari Supabase
async function fetchSurveyData() {
    const loading = document.getElementById('feedbackLoading');
    try {
        console.log('[Hasil Survey] Mengambil data dari Supabase...');
        const { data, error } = await supabase
            .from('survey_kepuasan')
            .select('*')
            .order('tgl_survey', { ascending: false });

        if (error) throw error;

        rawSurveyData = data || [];
        console.log(`[Hasil Survey] Berhasil meload ${rawSurveyData.length} baris data.`);

        if (loading) loading.style.display = 'none';

        // Proses & render seluruh laporan
        processStats();
        renderAspectCharts();
        applyFilters(); // Render feedback cards with initial empty filters

    } catch (err) {
        console.error('[Hasil Survey] Gagal memuat data:', err);
        if (loading) {
            loading.innerHTML = `<span style="color:var(--danger)">❌ Gagal sinkronisasi data: ${err.message || err}</span>`;
        }
        if (window.showToast) {
            window.showToast('Gagal memuat data survey!', 'danger');
        }
    }
}

// Memproses agregat KPI statistik kartu
function processStats() {
    const total = rawSurveyData.length;
    const sohibulCount = rawSurveyData.filter(d => d.tipe_responden === 'Sohibul Qurban').length;
    const agenCount = rawSurveyData.filter(d => d.tipe_responden === 'Agen').length;

    let avgRating = 0;
    if (total > 0) {
        const sum = rawSurveyData.reduce((s, d) => s + parseFloat(d.rating_rata || 0), 0);
        avgRating = parseFloat((sum / total).toFixed(2));
    }

    // Bind ke HTML
    document.getElementById('valTotalRes').textContent = total;
    document.getElementById('valAvgRating').textContent = avgRating.toFixed(2);
    document.getElementById('valSohibulCount').textContent = sohibulCount;
    document.getElementById('valAgenCount').textContent = agenCount;

    // Badge chart totals
    document.getElementById('valChartSohibulTotal').textContent = `${sohibulCount} Respon`;
    document.getElementById('valChartAgenTotal').textContent = `${agenCount} Respon`;
}

// Menggambar grafik rating rata-rata per aspek
function renderAspectCharts() {
    // 1. Chart Sohibul Qurban
    const sohibulData = rawSurveyData.filter(d => d.tipe_responden === 'Sohibul Qurban');
    const chartSohibul = document.getElementById('chartSohibulContainer');
    chartSohibul.innerHTML = '';

    if (sohibulData.length === 0) {
        chartSohibul.innerHTML = '<div style="opacity:0.5; text-align:center; padding:2rem; font-size:0.85rem;">Belum ada respon masuk untuk Sohibul Qurban.</div>';
    } else {
        ASPECT_KEYS_SOHIBUL.forEach(key => {
            const avgScore = calculateAspectAvg(sohibulData, key);
            const fillWidth = (avgScore / 5) * 100;
            
            const barItem = document.createElement('div');
            barItem.className = 'bar-item';
            barItem.innerHTML = `
                <div class="bar-label-row">
                    <span class="bar-title">${ASPECT_NAMES[key]}</span>
                    <span class="bar-value">⭐ ${avgScore.toFixed(2)} / 5</span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${fillWidth}%;"></div>
                </div>
            `;
            chartSohibul.appendChild(barItem);
        });
    }

    // 2. Chart Agen
    const agenData = rawSurveyData.filter(d => d.tipe_responden === 'Agen');
    const chartAgen = document.getElementById('chartAgenContainer');
    chartAgen.innerHTML = '';

    if (agenData.length === 0) {
        chartAgen.innerHTML = '<div style="opacity:0.5; text-align:center; padding:2rem; font-size:0.85rem;">Belum ada respon masuk untuk Mitra Agen.</div>';
    } else {
        ASPECT_KEYS_AGEN.forEach(key => {
            const avgScore = calculateAspectAvg(agenData, key);
            const fillWidth = (avgScore / 5) * 100;

            const barItem = document.createElement('div');
            barItem.className = 'bar-item';
            barItem.innerHTML = `
                <div class="bar-label-row">
                    <span class="bar-title">${ASPECT_NAMES[key]}</span>
                    <span class="bar-value" style="color:#3b82f6;">⭐ ${avgScore.toFixed(2)} / 5</span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${fillWidth}%; background:linear-gradient(90deg, #3b82f6, #60a5fa)"></div>
                </div>
            `;
            chartAgen.appendChild(barItem);
        });
    }
}

// Helper kalkulasi rata-rata aspek
function calculateAspectAvg(dataset, key) {
    if (dataset.length === 0) return 0;
    const sum = dataset.reduce((s, d) => {
        const rating = d.rating_aspek?.[key] || 0;
        return s + parseFloat(rating);
    }, 0);
    return sum / dataset.length;
}

// Menjalankan live filter ulasan
function applyFilters() {
    const searchText = document.getElementById('inpFilterSearch').value.toLowerCase().trim();
    const filterRole = document.getElementById('inpFilterRole').value;
    const filterScore = document.getElementById('inpFilterScore').value;

    filteredSurveyData = rawSurveyData.filter(d => {
        // 1. Text Search (Nama, Alamat, Catatan)
        const name = (d.nama || '').toLowerCase();
        const address = (d.alamat || '').toLowerCase();
        const notes = (d.catatan || '').toLowerCase();
        const matchSearch = !searchText || name.includes(searchText) || address.includes(searchText) || notes.includes(searchText);

        // 2. Role Filter
        const matchRole = !filterRole || d.tipe_responden === filterRole;

        // 3. Score Filter
        const score = parseFloat(d.rating_rata || 0);
        let matchScore = true;
        if (filterScore === 'excellent') matchScore = score >= 4.5;
        else if (filterScore === 'good') matchScore = score >= 3.5 && score < 4.5;
        else if (filterScore === 'fair') matchScore = score >= 2.5 && score < 3.5;
        else if (filterScore === 'poor') matchScore = score < 2.5;

        return matchSearch && matchRole && matchScore;
    });

    renderFeedbackCards();
}

// Render feed ulasan pelanggan/agen
function renderFeedbackCards() {
    const container = document.getElementById('feedbackGrid');
    container.innerHTML = '';

    if (filteredSurveyData.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:4rem; color:var(--text-muted); opacity:0.7; font-size:0.95rem;">Tidak menemukan tanggapan survey yang sesuai dengan filter pencarian.</div>';
        return;
    }

    filteredSurveyData.forEach(d => {
        const isSohibul = d.tipe_responden === 'Sohibul Qurban';
        const roleBadgeClass = isSohibul ? 'fb-badge sohibul' : 'fb-badge agen';
        const roleIconHtml = isSohibul ? '<i class="fa-solid fa-user-heart"></i>' : '<i class="fa-solid fa-handshake"></i>';
        
        // Format Nama & Wilayah
        const displayNama = d.nama || 'Hamba Allah';
        const displayAlamat = d.alamat ? `📍 ${d.alamat}` : '🔒 Anonim (Hamba Allah)';
        
        // Format Date
        const rawDate = d.tgl_survey || d.created_at;
        const formattedDate = formatIndonesianDate(rawDate);

        // Text essay truncation
        const fullCatatan = d.catatan ? d.catatan.trim() : '';
        let displayCatatan = fullCatatan;
        let showExpand = false;
        
        if (fullCatatan.length > 150) {
            displayCatatan = fullCatatan.substring(0, 150) + '...';
            showExpand = true;
        }

        const card = document.createElement('div');
        card.className = 'feedback-card';
        card.innerHTML = `
            <div class="feedback-user-info">
                <div>
                    <div class="fb-user-title">${displayNama}</div>
                    <div class="fb-user-sub">${displayAlamat}</div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                    <span class="${roleBadgeClass}">${roleIconHtml} ${d.tipe_responden}</span>
                    <div class="fb-rating-badge">
                        <i class="fa-solid fa-star"></i>
                        <span>${parseFloat(d.rating_rata || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>
            
            <div class="fb-body ${!fullCatatan ? 'empty' : ''}">
                ${fullCatatan ? `“ ${displayCatatan} ”` : 'Tidak menuliskan pesan tertulis / essay.'}
                ${showExpand ? `<br><button class="expand-btn" data-id="${d.id}">Baca Selengkapnya <i class="fa-solid fa-chevron-right"></i></button>` : ''}
            </div>

            <div class="fb-footer">
                <span>🕒 ${formattedDate}</span>
                <button class="expand-btn detail-trigger" data-id="${d.id}" style="color:var(--primary);">
                    <i class="fa-solid fa-list-check"></i> Rincian Skor
                </button>
            </div>
        `;
        container.appendChild(card);

        // Bind click events on this card's triggers
        const triggers = card.querySelectorAll('.expand-btn, .detail-trigger');
        triggers.forEach(btn => {
            btn.onclick = () => showFeedbackDetails(d.id);
        });
    });
}

// Menampilkan popup detail ulasan & star-breakdown
function showFeedbackDetails(id) {
    const feedback = rawSurveyData.find(d => d.id === id);
    if (!feedback) return;

    const overlay = document.getElementById('modalFbDetailOverlay');
    const title = document.getElementById('mdlFbTitle');
    const aspectsList = document.getElementById('mdlFbAspectsList');
    const catatan = document.getElementById('mdlFbCatatan');

    const displayNama = feedback.nama || 'Hamba Allah';
    const displayAlamat = feedback.alamat ? ` (${feedback.alamat})` : '';
    title.innerHTML = `<span style="font-weight:700;">${displayNama}</span><small style="display:block; font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Role: ${feedback.tipe_responden}${displayAlamat}</small>`;

    // Render list aspek bintang
    aspectsList.innerHTML = '';
    const keys = feedback.tipe_responden === 'Sohibul Qurban' ? ASPECT_KEYS_SOHIBUL : ASPECT_KEYS_AGEN;
    
    keys.forEach(key => {
        const rating = feedback.rating_aspek?.[key] || 0;
        
        // Generate Star icons
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                starsHtml += '<i class="fa-solid fa-star" style="color:var(--warning); margin-right:2px;"></i>';
            } else {
                starsHtml += '<i class="fa-solid fa-star" style="color:rgba(255,255,255,0.06); margin-right:2px;"></i>';
            }
        }

        const aspectItem = document.createElement('div');
        aspectItem.className = 'modal-aspect-item';
        aspectItem.innerHTML = `
            <span style="font-weight:600; color:var(--text-muted); font-size:0.8rem;">${ASPECT_NAMES[key]}</span>
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="font-size:0.9rem;">${starsHtml}</div>
                <span style="font-weight:700; color:var(--text-main); font-size:0.8rem;">(${rating})</span>
            </div>
        `;
        aspectsList.appendChild(aspectItem);
    });

    // Ulasan Essay
    if (feedback.catatan) {
        catatan.textContent = `“ ${feedback.catatan.trim()} ”`;
        catatan.style.fontStyle = 'normal';
        catatan.style.opacity = '1';
    } else {
        catatan.textContent = 'Responden tidak meninggalkan pesan tertulis (essay).';
        catatan.style.fontStyle = 'italic';
        catatan.style.opacity = '0.5';
    }

    overlay.classList.add('active');
}

// Ekspor Data ke CSV
function handleExportCSV() {
    if (rawSurveyData.length === 0) {
        if (window.showAlert) window.showAlert('Tidak ada data survey yang bisa diekspor.', 'warning');
        else alert('Tidak ada data survey yang bisa diekspor.');
        return;
    }

    try {
        console.log('[Export] Generating CSV file...');
        const separator = ',';
        const keysSohibul = ASPECT_KEYS_SOHIBUL;
        const keysAgen = ASPECT_KEYS_AGEN;

        // Build header
        const headers = [
            'Tanggal',
            'Tipe Responden',
            'Nama Responden',
            'Alamat / Kota',
            'Skor Rata-rata',
            'Ulasan Essay / Pesan Tertulis',
            ...ASPECT_KEYS_SOHIBUL.map(k => `Sohibul - ${ASPECT_NAMES[k]}`),
            ...ASPECT_KEYS_AGEN.map(k => `Agen - ${ASPECT_NAMES[k]}`)
        ];

        let csvContent = '\uFEFF'; // UTF-8 BOM to fix Excel character issue
        csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(separator) + '\n';

        rawSurveyData.forEach(d => {
            const rawDate = d.tgl_survey || d.created_at;
            const formattedDate = formatIndonesianDate(rawDate);
            const isSohibul = d.tipe_responden === 'Sohibul Qurban';
            
            // Core columns
            const rowData = [
                formattedDate,
                d.tipe_responden,
                d.nama || 'Hamba Allah',
                d.alamat || '-',
                parseFloat(d.rating_rata || 0).toFixed(2),
                d.catatan ? d.catatan.replace(/\r?\n|\r/g, ' ') : '' // replace newlines with space
            ];

            // Add ratings for Sohibul Qurban aspects
            keysSohibul.forEach(k => {
                rowData.push(isSohibul ? (d.rating_aspek?.[k] || '') : '');
            });

            // Add ratings for Agen aspects
            keysAgen.forEach(k => {
                rowData.push(!isSohibul ? (d.rating_aspek?.[k] || '') : '');
            });

            // Format line
            csvContent += rowData.map(val => {
                const cleanVal = String(val === null || val === undefined ? '' : val);
                return `"${cleanVal.replace(/"/g, '""')}"`;
            }).join(separator) + '\n';
        });

        // Trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `Hasil_Survey_DMQurban_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.showToast) {
            window.showToast('✅ Berhasil mengekspor berkas CSV.', 'success');
        }
    } catch (err) {
        console.error('[Export] Error:', err);
        alert('Gagal mengekspor data: ' + err.message);
    }
}

// Helper formatting Indonesian date: "28 Mei 2026, 05:40"
function formatIndonesianDate(dateString) {
    if (!dateString) return '-';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    
    const d = new Date(dateString);
    const date = d.getDate().toString().padStart(2, '0');
    const monthName = months[d.getMonth()];
    const year = d.getFullYear();
    
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    
    return `${date} ${monthName} ${year}, ${hours}:${minutes}`;
}
