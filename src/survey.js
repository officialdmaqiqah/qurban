import { supabase } from './supabase.js';

// Aspek Penilaian untuk masing-masing Tipe Responden
const ASPECTS = {
    'Sohibul Qurban': [
        {
            key: 'hewan',
            title: 'Kualitas & Kesehatan Hewan Kurban',
            desc: 'Menilai kondisi fisik, kebersihan, nafsu makan, keaktifan, dan kesempurnaan fisik hewan kurban.'
        },
        {
            key: 'kandang',
            title: 'Kondisi & Kebersihan Kandang',
            desc: 'Menilai kebersihan, sanitasi, keteraturan, dan kenyamanan lingkungan kandang Daarul Mahabbah.'
        },
        {
            key: 'pelayanan',
            title: 'Keramahan & Kejelasan Pelayanan',
            desc: 'Menilai keramahan, kesopanan, kesigapan petugas, serta kejelasan informasi penjelasan.'
        },
        {
            key: 'transaksi',
            title: 'Administrasi & Kemudahan Transaksi',
            desc: 'Menilai kemudahan proses pemesanan, konfirmasi pembayaran, serta kelancaran pencatatan administrasi.'
        },
        {
            key: 'pengiriman',
            title: 'Ketepatan & Keamanan Pengiriman',
            desc: 'Menilai ketepatan waktu pengiriman, keramahan pengirim/sopir, serta keselamatan hewan hidup agar tidak stres saat tiba.'
        }
    ],
    'Agen': [
        {
            key: 'aplikasi',
            title: 'Akses Informasi Stok & Harga',
            desc: 'Menilai kemudahan dan kestabilan aplikasi untuk memantau ketersediaan stok kurban yang belum laku dan kejelasan harga kandang.'
        },
        {
            key: 'marketing',
            title: 'Kualitas Dukungan Marketing',
            desc: 'Menilai kelengkapan brosur, foto hewan ter-update di etalase, serta materi promosi yang disediakan.'
        },
        {
            key: 'komisi',
            title: 'Transparansi & Perhitungan Komisi',
            desc: 'Menilai transparansi pencatatan, ketepatan perhitungan komisi hasil penjualan sesuai skema kemitraan yang disepakati, serta kelancaran proses pencairannya.'
        },
        {
            key: 'koordinasi',
            title: 'Kerjasama & Respon Tim Kandang',
            desc: 'Menilai kecepatan respon dan kelancaran koordinasi tim kandang Daarul Mahabbah saat dikontak agen.'
        },
        {
            key: 'stok',
            title: 'Kualitas Stok Hewan Kurban',
            desc: 'Menilai variasi pilihan, kesehatan fisik, dan kesiapan stok hewan kurban yang disediakan kandang.'
        },
        {
            key: 'konsumen',
            title: 'Kepuasan Konsumen Anda (Agen)',
            desc: 'Menilai kepuasan rata-rata pembeli Anda terhadap pelayanan yang diberikan Daarul Mahabbah.'
        }
    ]
};

// Label rating teks berdasarkan jumlah bintang
const RATING_LABELS = {
    1: 'Sangat Kurang 😠',
    2: 'Kurang 😟',
    3: 'Cukup 😐',
    4: 'Baik 🙂',
    5: 'Sangat Baik! 😍'
};

let currentRole = 'Sohibul Qurban';
let isAnonymous = false;
const selectedRatings = {}; // format: { hewan: 5, kandang: 4, ... }

document.addEventListener('DOMContentLoaded', () => {
    initElements();
    renderAspects();
});

function initElements() {
    // 1. Selector Peran (Role Selector)
    const roleCards = document.querySelectorAll('.role-card');
    roleCards.forEach(card => {
        card.addEventListener('click', () => {
            roleCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentRole = card.dataset.role;
            
            // Re-render aspek
            renderAspects();
        });
    });

    // 2. Toggle Switch Anonim
    const anonToggle = document.getElementById('anonToggle');
    const identityInputs = document.getElementById('identityInputs');
    const inpNama = document.getElementById('inpNama');
    const inpAlamat = document.getElementById('inpAlamat');

    anonToggle.addEventListener('click', () => {
        isAnonymous = !isAnonymous;
        if (isAnonymous) {
            anonToggle.classList.add('active');
            identityInputs.style.opacity = '0';
            setTimeout(() => {
                identityInputs.style.display = 'none';
                inpNama.removeAttribute('required');
                inpAlamat.removeAttribute('required');
                inpNama.value = 'Hamba Allah';
                inpAlamat.value = '';
            }, 200);
        } else {
            anonToggle.classList.remove('active');
            identityInputs.style.display = 'grid';
            setTimeout(() => {
                identityInputs.style.opacity = '1';
                inpNama.setAttribute('required', '');
                inpAlamat.setAttribute('required', '');
                inpNama.value = '';
                inpAlamat.value = '';
            }, 50);
        }
    });

    // 3. Form Submission
    const form = document.getElementById('surveyForm');
    form.addEventListener('submit', handleFormSubmit);
}

function renderAspects() {
    const container = document.getElementById('aspectsContainer');
    container.innerHTML = '';
    
    // Reset selected ratings
    const aspectsList = ASPECTS[currentRole];
    aspectsList.forEach(aspect => {
        selectedRatings[aspect.key] = 0; // Default: belum dinilai
    });

    // Render aspek per aspek
    aspectsList.forEach(aspect => {
        const row = document.createElement('div');
        row.className = 'aspect-row';
        row.innerHTML = `
            <div class="aspect-info">
                <div class="aspect-title">${aspect.title}</div>
                <div class="aspect-desc">${aspect.desc}</div>
            </div>
            <div class="rating-box">
                <div class="stars" data-key="${aspect.key}">
                    <span class="star" data-value="1"><i class="fa-solid fa-star"></i></span>
                    <span class="star" data-value="2"><i class="fa-solid fa-star"></i></span>
                    <span class="star" data-value="3"><i class="fa-solid fa-star"></i></span>
                    <span class="star" data-value="4"><i class="fa-solid fa-star"></i></span>
                    <span class="star" data-value="5"><i class="fa-solid fa-star"></i></span>
                </div>
                <span class="rating-text" id="label-${aspect.key}">Ketuk untuk menilai</span>
            </div>
        `;
        container.appendChild(row);

        // Bind events for stars inside this row
        const starElList = row.querySelectorAll('.star');
        const textLabel = row.querySelector('.rating-text');

        starElList.forEach(star => {
            // Hover enter
            star.addEventListener('mouseenter', () => {
                const hoverValue = parseInt(star.dataset.value);
                highlightStars(starElList, hoverValue, true);
            });

            // Hover leave
            star.addEventListener('mouseleave', () => {
                const selectedValue = selectedRatings[aspect.key] || 0;
                highlightStars(starElList, selectedValue, false);
            });

            // Click
            star.addEventListener('click', () => {
                const selectedValue = parseInt(star.dataset.value);
                selectedRatings[aspect.key] = selectedValue;
                
                // Update text label with modern visual
                textLabel.textContent = RATING_LABELS[selectedValue];
                textLabel.classList.add('active');
                
                highlightStars(starElList, selectedValue, false);
            });
        });
    });
}

// Menangani visualisasi bintang menyala
function highlightStars(starList, value, isHover) {
    starList.forEach(star => {
        const starVal = parseInt(star.dataset.value);
        if (starVal <= value) {
            if (isHover) {
                star.classList.add('hovered');
            } else {
                star.classList.add('selected');
                star.classList.remove('hovered');
            }
        } else {
            star.classList.remove('selected', 'hovered');
        }
    });
}

// Handler pengiriman form
async function handleFormSubmit(e) {
    e.preventDefault();

    const btnSubmit = document.getElementById('btnSubmit');
    const originalBtnText = btnSubmit.innerHTML;
    
    // 1. Validasi: Pastikan seluruh aspek telah dinilai
    const aspectsList = ASPECTS[currentRole];
    let isAllRated = true;
    let totalScore = 0;
    
    const unratedAspects = [];
    aspectsList.forEach(aspect => {
        const rating = selectedRatings[aspect.key];
        if (!rating || rating === 0) {
            isAllRated = false;
            unratedAspects.push(aspect.title);
        } else {
            totalScore += rating;
        }
    });

    if (!isAllRated) {
        alert(`Harap isi semua aspek penilaian!\nAspek yang belum dinilai:\n- ${unratedAspects.join('\n- ')}`);
        return;
    }

    // 2. Persiapan Data
    const nama = isAnonymous ? 'Hamba Allah' : document.getElementById('inpNama').value.trim();
    const alamat = isAnonymous ? '' : document.getElementById('inpAlamat').value.trim();
    const ratingRata = parseFloat((totalScore / aspectsList.length).toFixed(2));
    const catatan = document.getElementById('inpEssay').value.trim();

    const payload = {
        tipe_responden: currentRole,
        nama: nama || 'Hamba Allah',
        alamat: alamat,
        rating_aspek: selectedRatings,
        rating_rata: ratingRata,
        catatan: catatan
    };

    try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `Mengirim... <span class="spinner"></span>`;

        console.log('[Survey] Mengirim survey ke Supabase:', payload);
        const { data, error } = await supabase.from('survey_kepuasan').insert([payload]);

        if (error) {
            throw error;
        }

        // Tampilkan layar sukses
        document.getElementById('surveyFormBlock').style.display = 'none';
        document.getElementById('surveySuccessBlock').style.display = 'flex';
        
        // Scroll ke atas card agar animasi terlihat jelas
        document.querySelector('.survey-card').scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        console.error('[Survey] Gagal menyimpan data:', err);
        alert('Gagal mengirimkan survey: ' + (err.message || err));
        
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
    }
}
