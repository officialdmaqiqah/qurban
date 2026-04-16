import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const goatGrid = document.getElementById('goatGrid');
    const loadingState = document.getElementById('loadingState');
    const affiliateBanner = document.getElementById('affiliateBanner');
    const agentNameEl = document.getElementById('agentName');
    const agentInitialEl = document.getElementById('agentInitial');
    const floatingWa = document.getElementById('floatingWa');
    const navToggle = document.getElementById('navToggle');
    const sidebarMenu = document.getElementById('sidebarMenu');
    
    // Lightbox elements
    const lightbox = document.getElementById('photoLightbox');
    const lightboxImg = document.getElementById('lightboxImg');

    // 1. Affiliate & Contact Sync
    const urlParams = new URLSearchParams(window.location.search);
    const urlRef = urlParams.get('ref');
    
    // Consistency: Store in localStorage if present, otherwise try to retrieve it
    if (urlRef) localStorage.setItem('qurban_ref', urlRef);
    const ref = urlRef || localStorage.getItem('qurban_ref');

    let currentAgent = {
        name: 'Mimin Qurban',
        wa: '6285335150001',
        isAffiliate: false
    };

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
                const url = new URL(href, window.location.origin);
                url.searchParams.set('ref', refValue);
                link.setAttribute('href', url.pathname + url.search + url.hash);
            }
        });
    }

    async function lookupAgent(username) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, wa')
                .or(`email.ilike.${username},email.ilike.${username}@%`)
                .limit(1)
                .maybeSingle();

            if (data && !error && data.wa) {
                let wa = data.wa.replace(/\D/g, '');
                // Auto-fix format: 08xx -> 628xx atau 8xx -> 628xx
                if (wa.startsWith('0')) wa = '62' + wa.substring(1);
                else if (wa.startsWith('8')) wa = '62' + wa;

                currentAgent = {
                    name: data.full_name,
                    wa: wa,
                    isAffiliate: true
                };
                
                if (affiliateBanner) {
                    affiliateBanner.classList.add('active');
                    if (agentNameEl) agentNameEl.textContent = data.full_name;
                    if (agentInitialEl) agentInitialEl.textContent = data.full_name.charAt(0).toUpperCase();
                }
            }
        } catch (e) {
            console.error('Affiliate check error:', e);
        } finally {
            syncContactUI(); // Always sync, using defaults if agent not found
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

    // 2. Mobile Menu Logic
    if (navToggle && sidebarMenu) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            sidebarMenu.classList.toggle('active');
        });
        sidebarMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navToggle.classList.remove('active');
                sidebarMenu.classList.remove('active');
            });
        });
    }

    // 3. Scroll Reveal Animations
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('section, .section-header').forEach(el => {
        el.classList.add('reveal');
        revealObserver.observe(el);
    });

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

        renderGoats(data);
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

    function renderGoats(goats) {
        goatGrid.innerHTML = '';
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
                    <div class="goat-title">Tag #${tagNum} - ${goat.warna_tali || 'Kambing Qurban'}</div>
                    <div class="goat-meta">
                        <span title="Warna Tali"><i class="fas fa-tag" style="font-size: 0.8rem"></i> Warna Tali: ${goat.warna_tali || ''}</span>
                    </div>
                    <a href="${waLink}" target="_blank" class="btn-premium" style="width:100%; font-size: 0.85rem; justify-content:center;">
                        <i class="fab fa-whatsapp" style="margin-right: 8px"></i> Pesan via WhatsApp
                    </a>
                </div>
            `;
            
            // Image Preview logic
            const imgContainer = card.querySelector('.goat-img');
            imgContainer.addEventListener('click', () => {
                const fullId = (rawImg || '').match(/[-\w]{25,50}/g);
                if (fullId && lightbox && lightboxImg) {
                    const id = fullId.reduce((a, b) => a.length > b.length ? a : b);
                    // Use high-res thumbnail to avoid Google Drive view blocks
                    lightboxImg.src = `https://drive.google.com/thumbnail?id=${id}&sz=w2000`;
                    lightbox.classList.add('active');
                }
            });

            goatGrid.appendChild(card);
            revealObserver.observe(card);
        });
    }

    // Lightbox Close
    if (lightbox) {
        lightbox.addEventListener('click', () => {
            lightbox.classList.remove('active');
        });
    }

    fetchGoats();
});
