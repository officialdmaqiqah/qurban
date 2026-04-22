import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const featuredGrid = document.getElementById('featuredGoats');
    const footerWa = document.getElementById('footerWa');
    const floatingWa = document.getElementById('floatingWa');
    const navToggle = document.getElementById('navToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const heroConsultation = document.getElementById('heroConsultation');
    
    // 1. Affiliate & Contact Sync
    const urlParams = new URLSearchParams(window.location.search);
    const urlRef = urlParams.get('ref');
    
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
                .select('full_name, wa, email')
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
                    isAffiliate: true
                };
            }
        } catch (e) {
            console.error('Affiliate lookup failed', e);
        } finally {
            syncContactUI();
        }
    }

    function syncContactUI() {
        const waLink = `https://wa.me/${currentAgent.wa}?text=Halo, Kak ${currentAgent.name}, saya ingin bertanya tentang Qurban.`;
        if (floatingWa) floatingWa.href = waLink;
        if (heroConsultation) heroConsultation.href = waLink;
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

        // Close when clicking links or overlay
        sidebarOverlay.addEventListener('click', (e) => {
            if (e.target === sidebarOverlay || e.target.tagName === 'A') {
                sidebarOverlay.classList.remove('active');
                navToggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Navbar Scroll Effect
    const nav = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
    });

    // 3. Smooth Scroll Reveal Animations
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // 4. Fetch Featured Stock
    async function fetchFeaturedGoats() {
        if (!featuredGrid) return;

        const { data, error } = await supabase
            .from('stok_kambing')
            .select('*')
            .eq('status_transaksi', 'Tersedia')
            .limit(3)
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            featuredGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #94a3b8;">Belum ada stok unggulan saat ini.</div>';
            return;
        }

        renderFeatured(data);
    }

    function cleanUrl(url) {
        if (!url) return '';
        const matches = (url || '').match(/[-\w]{25,50}/g);
        if (matches) {
            const id = matches.reduce((a, b) => a.length > b.length ? a : b);
            return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
        }
        return url;
    }

    function renderFeatured(goats) {
        if (!featuredGrid) return;
        featuredGrid.innerHTML = '';
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

            const etalaseUrl = ref ? `etalase.html?ref=${ref}` : 'etalase.html';

            card.innerHTML = `
                <div class="goat-img">
                    <img src="${finalImg}" alt="Goat ${tagNum}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${fallbackImg}'">
                    <span class="goat-badge">${category}</span>
                </div>
                <div class="goat-info">
                    <div class="goat-title">Tag #${tagNum}</div>
                    <div class="goat-meta">
                        <span><i class="fas fa-palette"></i> ${goat.warna_tali || 'Putih'}</span>
                        <span><i class="fas fa-heartbeat"></i> Prima</span>
                    </div>
                    <a href="${etalaseUrl}" class="btn-premium" style="width:100%; border-radius: 12px; font-size: 0.85rem; justify-content:center; padding: 0.6rem 0;">Cek Detail &rarr;</a>
                </div>
            `;
            featuredGrid.appendChild(card);
            setTimeout(() => card.classList.add('active'), 50);
        });
    }

    fetchFeaturedGoats();

    // 5. Sync Target Logo dengan Logo Profil
    async function syncProfileLogo() {
        const navbarLogo = document.getElementById('navbarLogoImg');
        const footerLogo = document.getElementById('footerLogoImg');
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
