const maskAssets = {
    dark: { path: '/bad-apple-mask-full.gif', buffer: null, loading: null },
    light: { path: '/shigure-ui-dance.gif', buffer: null, loading: null }
};
let activeMaskUrl = null;

function preloadMask(theme) {
    const asset = maskAssets[theme];
    if (asset.buffer) return Promise.resolve(asset.buffer);
    if (asset.loading) return asset.loading;

    asset.loading = fetch(asset.path, { cache: 'force-cache' })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load ${asset.path}`);
            return response.arrayBuffer();
        })
        .then(buffer => {
            asset.buffer = buffer;
            return buffer;
        })
        .catch(() => null);

    return asset.loading;
}

function setMask(theme, buffer) {
    if (!buffer) {
        document.documentElement.style.removeProperty('--current-mask-gif');
        return null;
    }

    const url = URL.createObjectURL(new Blob([buffer], { type: 'image/gif' }));
    document.documentElement.style.setProperty('--current-mask-gif', `url("${url}")`);
    activeMaskUrl = url;
    return url;
}

function clearMask() {
    document.documentElement.style.removeProperty('--current-mask-gif');
    if (activeMaskUrl) {
        URL.revokeObjectURL(activeMaskUrl);
        activeMaskUrl = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
        preloadMask('dark');
        preloadMask('light');
    }

    // Inject the combined SVG switcher if not present
    if (!toggleBtn.querySelector('.solar-switch')) {
        const combinedSVG = `<svg width="20" height="20" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg" class="solar-switch">
        <g class="sun-icon">
            <path d="M12.4058 17.7625C15.1672 17.7625 17.4058 15.5239 17.4058 12.7625C17.4058 10.0011 15.1672 7.76251 12.4058 7.76251C9.64434 7.76251 7.40576 10.0011 7.40576 12.7625C7.40576 15.5239 9.64434 17.7625 12.4058 17.7625Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
            <path d="M12.4058 1.76251V3.76251" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
            <path d="M12.4058 21.7625V23.7625" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
            <path d="M4.62598 4.98248L6.04598 6.40248" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
            <path d="M18.7656 19.1225L20.1856 20.5425" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
            <path d="M1.40576 12.7625H3.40576" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
            <path d="M21.4058 12.7625H23.4058" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
            <path d="M4.62598 20.5425L6.04598 19.1225" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
            <path d="M18.7656 6.40248L20.1856 4.98248" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
        </g>
        <g class="moon-icon">
            <path d="M21.1918 13.2013C21.0345 14.9035 20.3957 16.5257 19.35 17.8781C18.3044 19.2305 16.8953 20.2571 15.2875 20.8379C13.6797 21.4186 11.9398 21.5294 10.2713 21.1574C8.60281 20.7854 7.07479 19.9459 5.86602 18.7371C4.65725 17.5283 3.81774 16.0003 3.4457 14.3318C3.07367 12.6633 3.18451 10.9234 3.76526 9.31561C4.346 7.70783 5.37263 6.29868 6.72501 5.25307C8.07739 4.20746 9.69959 3.56862 11.4018 3.41132C10.4052 4.75958 9.92564 6.42077 10.0503 8.09273C10.175 9.76469 10.8957 11.3364 12.0812 12.5219C13.2667 13.7075 14.8384 14.4281 16.5104 14.5528C18.1823 14.6775 19.8435 14.1979 21.1918 13.2013Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
        </g>
    </svg>`;
        toggleBtn.innerHTML = combinedSVG;
    }

    updateToggleUI();

    let transitionInProgress = false;

    toggleBtn.addEventListener('click', () => {
        (async () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            if (transitionInProgress) return;
            transitionInProgress = true;

            // Add theme-toggled class to enable animations
            document.documentElement.classList.add('theme-toggled');

            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const noTransition = reduceMotion || toggleBtn.hasAttribute('data-no-transition');

            if (noTransition || !document.startViewTransition) {
                clearMask();
                await setTheme(newTheme);
                document.documentElement.classList.remove('theme-toggled');
                transitionInProgress = false;
                return;
            }

            const maskBuffer = await preloadMask(newTheme);
            clearMask();
            setMask(newTheme, maskBuffer);

            const transition = document.startViewTransition(async () => {
                await setTheme(newTheme);
            });

            try {
                await transition.finished;
            } catch (e) {
                // ignore
            } finally {
                clearMask();
                transitionInProgress = false;
                document.documentElement.classList.remove('theme-toggled');
                if (typeof refreshThresholdImages === "function") {
                    try {
                        await refreshThresholdImages();
                    } catch (e) {}
                }
            }
        })();
    });
});

async function setTheme(newTheme) {
    document.documentElement.setAttribute('data-theme', newTheme);

    if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    localStorage.setItem('theme', newTheme);
    updateToggleUI();
}

function updateToggleUI() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

    if (currentTheme === 'dark') {
        toggleBtn.setAttribute('aria-label', 'Switch to light mode');
    } else {
        toggleBtn.setAttribute('aria-label', 'Switch to dark mode');
    }
}