import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const goatGrid = document.getElementById('goatGrid');
    const loadingState = document.getElementById('loadingState');
    const affiliateBanner = document.getElementById('affiliateBanner');
    const agentNameEl = document.getElementById('agentName');
    const agentInitialEl = document.getElementById('agentInitial');
    const floatingWa = document.getElementById('floatingWa');
    
    // Modern Mobile Navigation
    const navToggle = document.getElementById('navToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    // Lightbox elements
    const lightbox = document.getElementById('photoLightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const searchInput = document.getElementById('searchInput');
    let allGoatsData = [];
    let currentAgent = {
        name: 'Mimin Qurban',
        wa: '6285335150001',
        isAffiliate: false
    };

    // 1. Affiliate & Contact Sync
    const urlParams = new URLSearchParams(window.location.search);
    const urlRef = urlParams.get('ref');
    
    if (urlRef) localStorage.setItem('qurban_ref', urlRef);
    const ref = urlRef || localStorage.getItem('qurban_ref');

    if (ref) {
        await lookupAgent(ref.toLowerCase());
        updateNavLinks(ref.toLowerCase());
    } else {
        syncContactUI();
    }

    function updateNavLinks(refValue) {
        document.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            if (href && (href.includes('etalase.html') || href.includes('index.html'))) {
                try {
                    const url = new URL(href, window.location.origin);
                    url.searchParams.set('ref', refValue);
                    link.setAttribute('href', url.pathname + url.search + url.hash);
                } catch(e) {}
            }
        });
    }

    async function lookupAgent(username) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, wa, photo_url')
                .or(`email.ilike.${username},email.ilike.${username}@%`)
                .limit(1)
                .maybeSingle();

            if (data && !error && data.wa) {
                let wa = data.wa.replace(/\D/g, '');
                if (wa.startsWith('0')) wa = '62' + wa.substring(1);
                else if (wa.startsWith('8')) wa = '62' + wa;

                currentAgent = {
                    name: data.full_name,
                    wa: wa,
                    isAffiliate: true,
                    photo: data.photo_url
                };
                
                if (affiliateBanner) {
                    affiliateBanner.classList.add('active');
                    if (agentNameEl) agentNameEl.textContent = data.full_name;
                    if (agentInitialEl) {
                        if (data.photo_url) {
                            agentInitialEl.innerHTML = `<img src="${data.photo_url}" alt="${data.full_name}">`;
                        } else {
                            agentInitialEl.textContent = data.full_name.charAt(0).toUpperCase();
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Affiliate check error:', e);
        } finally {
            syncContactUI();
        }
    }

    function syncContactUI() {
        const waLink = `https://wa.me/${currentAgent.wa}?text=Halo ${currentAgent.name}, saya tertarik dengan hewan qurban di etalase.`;
        if (floatingWa) floatingWa.href = waLink;
        
        const footerWa = document.getElementById('footerWa');
        if (footerWa) {
            const formatted = currentAgent.wa.startsWith('62') ? '0' + currentAgent.wa.slice(2) : currentAgent.wa;
            footerWa.textContent = formatted.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
        }
    }

    // 2. Modern Mobile Menu Toggle
    if (navToggle && sidebarOverlay) {
        navToggle.addEventListener('click', () => {
            sidebarOverlay.classList.toggle('active');
            navToggle.classList.toggle('active');
            document.body.style.overflow = sidebarOverlay.classList.contains('active') ? 'hidden' : '';
        });

        sidebarOverlay.addEventListener('click', (e) => {
            if (e.target === sidebarOverlay || e.target.tagName === 'A') {
                sidebarOverlay.classList.remove('active');
                navToggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // 3. Smooth Scroll Reveal Animations
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // 4. Fetch & Render Stock
    async function fetchGoats() {
        if (!goatGrid) return;
        const { data, error } = await supabase
            .from('stok_kambing')
            .select('*')
            .eq('status_transaksi', 'Tersedia')
            .order('no_tali', { ascending: true });

        if (loadingState) loadingState.style.display = 'none';

        if (error || !data || data.length === 0) {
            goatGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: #94a3b8;">Tidak ada data hewan qurban tersedia.</div>';
            return;
        }

        allGoatsData = data;
        renderGoats(data);
    }

    // 5. Search Filtering
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allGoatsData.filter(goat => {
                const tagNum = (goat.no_tali || '').toString().toLowerCase();
                const color = (goat.warna_tali || '').toLowerCase();
                return tagNum.includes(query) || color.includes(query);
            });
            renderGoats(filtered, query.length > 0);
        });

        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = searchInput.value.toLowerCase().trim();
                const filtered = allGoatsData.filter(goat => {
                    const tagNum = (goat.no_tali || '').toString().toLowerCase();
                    const color = (goat.warna_tali || '').toLowerCase();
                    return tagNum.includes(query) || color.includes(query);
                });
                renderGoats(filtered, query.length > 0);
            });
        }
    }

    function cleanUrl(url) {
        if (!url) return '';
        const matches = (url || '').match(/[-\w]{25,50}/g);
        if (matches) {
            const id = matches.reduce((a, b) => a.length > b.length ? a : b);
            return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
        }
        return url;
    }

    function renderGoats(goats, isSearching = false) {
        goatGrid.innerHTML = '';

        if (goats.length === 0) {
            goatGrid.innerHTML = `
                <div class="no-results reveal active" style="grid-column: 1/-1; text-align: center; padding: 5rem 2rem; border-radius: 24px; border: 1px dashed var(--glass-border);">
                    <i class="fas fa-search" style="font-size: 3rem; color: #475569; margin-bottom: 1.5rem;"></i>
                    <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem; color: #f1f5f9;">Hewan Tidak Ditemukan</h3>
                    <p style="color: #94a3b8;">Mohon maaf, nomor tag atau kriteria yang Anda cari tidak tersedia saat ini.</p>
                </div>
            `;
            return;
        }

        goats.forEach(goat => {
            const card = document.createElement('div');
            card.className = 'goat-card reveal';
            
            const rawImg = goat.foto_thumb || goat.foto_fisik;
            const goatImg = cleanUrl(rawImg);
            const tagNum = goat.no_tali || '??';
            const fallbackImg = `https://ui-avatars.com/api/?name=${tagNum}&background=random&color=fff&size=512`;
            const finalImg = goatImg || fallbackImg;

            let category = 'Reguler';
            if (goat.harga_kandang > 5000000) category = 'Premium';
            else if (goat.harga_kandang > 3500000) category = 'Super';

            const waText = `Halo ${currentAgent.name}, saya berminat dengan kambing Tag #${tagNum} (${goat.warna_tali || ''}). Apakah masih tersedia?`;
            const waLink = `https://wa.me/${currentAgent.wa}?text=${encodeURIComponent(waText)}`;

            card.innerHTML = `
                <div class="goat-img" style="cursor: zoom-in">
                    <img src="${finalImg}" alt="Goat ${tagNum}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${fallbackImg}'">
                    <span class="goat-badge">${category}</span>
                </div>
                <div class="goat-info">
                    <div class="goat-title">Tag #${tagNum}</div>
                    <div class="goat-meta">
                        <span><i class="fas fa-palette"></i> ${goat.warna_tali || 'Putih'}</span>
                        <span><i class="fas fa-check-circle"></i> Sehat & Terawat</span>
                    </div>
                    <a href="${waLink}" target="_blank" class="btn-premium" style="width:100%; border-radius: 12px; font-size: 0.85rem; justify-content:center; padding: 0.8rem;">
                        <i class="fab fa-whatsapp"></i> Pesan via WhatsApp
                    </a>
                </div>
            `;
            
            card.querySelector('.goat-img').addEventListener('click', () => {
                const fullId = (rawImg || '').match(/[-\w]{25,50}/g);
                if (fullId && lightbox && lightboxImg) {
                    const id = fullId.reduce((a, b) => a.length > b.length ? a : b);
                    lightboxImg.src = `https://drive.google.com/thumbnail?id=${id}&sz=w2000`;
                    lightbox.classList.add('active');
                }
            });

            goatGrid.appendChild(card);
            setTimeout(() => card.classList.add('active'), 10);
        });
    }

    // Lightbox Close
    if (lightbox) {
        lightbox.addEventListener('click', () => lightbox.classList.remove('active'));
    }

    fetchGoats();

    // 6. Sync Target Logo dengan Logo Profil
    async function syncProfileLogo() {
        const navbarLogo = document.getElementById('navbarLogoImgEtalase');
        const footerLogo = document.getElementById('footerLogoImgEtalase');
        try {
            const { data } = await supabase.from('master_data').select('val').eq('key', 'PROFILE').maybeSingle();
            if (data && data.val && data.val.logo) {
                if (navbarLogo) { navbarLogo.src = data.val.logo; navbarLogo.style.opacity = '1'; }
                if (footerLogo) { footerLogo.src = data.val.logo; footerLogo.style.opacity = '1'; }
            } else {
                if (navbarLogo) navbarLogo.style.opacity = '1';
                if (footerLogo) footerLogo.style.opacity = '1';
            }
        } catch (e) {
            console.error('Gagal mengambil logo profil:', e);
            if (navbarLogo) navbarLogo.style.opacity = '1';
            if (footerLogo) footerLogo.style.opacity = '1';
        }
    }
    syncProfileLogo();
});
