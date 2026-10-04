function thresholdImage(img) {
    const canvas = document.createElement('canvas');
    const origWidth = img.naturalWidth || img.width || 220;
    const origHeight = img.naturalHeight || img.height || 350;
    const maxWidth = 440;
    const scale = origWidth > maxWidth ? maxWidth / origWidth : 1;
    canvas.width = Math.round(origWidth * scale);
    canvas.height = Math.round(origHeight * scale);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const threshold = Number(img.dataset.threshold || 20);

    for (let i = 0; i < pixels.length; i += 4) {
        const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        if (brightness < threshold) {
            pixels[i] = 39;
            pixels[i + 1] = 129;
            pixels[i + 2] = 196;
            pixels[i + 3] = 255;
        } else {
            pixels[i + 3] = 0;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
}

async function loadOriginal(original) {
    if (original.dataset.loaded) return;
    original.dataset.loaded = 'true';
    original.src = original.dataset.src;
    if (!original.complete) await original.decode().catch(() => {});
}

async function processPoster(wrapper) {
    const img = wrapper.querySelector('img.threshold-hover');
    if (!img || img.dataset.processed || !img.dataset.src) return;

    img.dataset.loading = 'true';
    try {
        img.src = img.dataset.src;
        img.style.opacity = '1';
        if (!img.complete) await img.decode().catch(() => {});
        if (!img.naturalWidth) throw new Error('poster failed to load');

        img.src = thresholdImage(img);
        img.dataset.processed = 'true';
        img.classList.add('processed');
    } catch (error) {
        img.src = img.dataset.src;
        img.classList.add('processed');
    } finally {
        delete img.dataset.loading;
    }
}

function setupThresholdImages() {
    const images = document.querySelectorAll('.threshold-hover');
    const queue = [];
    let processing = false;

    function enqueue(wrapper) {
        if (wrapper.dataset.queued || wrapper.dataset.processed) return;
        wrapper.dataset.queued = 'true';
        queue.push(wrapper);
        processQueue();
    }

    async function processQueue() {
        if (processing) return;
        processing = true;
        while (queue.length) {
            const wrapper = queue.shift();
            delete wrapper.dataset.queued;
            await processPoster(wrapper);
        }
        processing = false;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                enqueue(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '200px 0px' });

    images.forEach(img => {
        if (img.dataset.initialized) return;
        img.dataset.initialized = 'true';

        const grid = img.parentNode;
        const wrapper = document.createElement('div');
        wrapper.className = 'threshold-hover-wrapper';
        wrapper.dataset.category = img.dataset.category || '';
        if (img.dataset.score) wrapper.dataset.score = img.dataset.score;
        wrapper.style.aspectRatio = `${img.width || 220} / ${img.height || 350}`;

        const posterSrc = img.dataset.src;
        grid.insertBefore(wrapper, img);
        img.removeAttribute('src');
        wrapper.appendChild(img);
        img.style.opacity = '0';

        const original = document.createElement('img');
        original.className = 'original-hover';
        original.alt = img.alt || '';
        original.dataset.src = posterSrc;
        original.dataset.threshold = img.dataset.threshold || '20';
        wrapper.appendChild(original);

        if (img.dataset.rating) {
            const ratingBar = document.createElement('div');
            ratingBar.textContent = img.dataset.rating;
            ratingBar.className = 'rating-bar';
            wrapper.appendChild(ratingBar);
        }

        wrapper.addEventListener('mouseenter', () => loadOriginal(original), { once: true });
        wrapper.addEventListener('touchstart', () => loadOriginal(original), { once: true, passive: true });
        wrapper.addEventListener('click', (e) => {
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768) {
                document.querySelectorAll('.threshold-hover-wrapper.active').forEach(w => {
                    if (w !== wrapper) w.classList.remove('active');
                });
                wrapper.classList.toggle('active');
                loadOriginal(original);
                e.stopPropagation();
            }
        });

        observer.observe(wrapper);
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.threshold-hover-wrapper.active').forEach(w => w.classList.remove('active'));
    });
}

function refreshThresholdImages() {}

document.addEventListener('DOMContentLoaded', setupThresholdImages);
