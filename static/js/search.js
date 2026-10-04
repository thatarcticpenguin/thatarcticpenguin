(() => {
    let indexPromise;
    let index;
    let rawSearchIndex;
    let palette;
    let input;
    let results;
    let activeIndex = -1;
    let previousFocus;
    let searchRequestId = 0;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function loadSearchIndex() {
        if (indexPromise) return indexPromise;
        indexPromise = (async () => {
            if (!window.elasticlunr) {
                await loadScript(window.SEARCH_ELASTICLUNR_URL || '/elasticlunr.min.js');
            }
            await loadScript(window.SEARCH_INDEX_URL || '/search_index.en.js');
            rawSearchIndex = window.searchIndex;
            if (!rawSearchIndex) throw new Error('Search index did not load');
            index = window.elasticlunr.Index.load(rawSearchIndex);
            return index;
        })();
        return indexPromise;
    }

    function getDoc(result) {
        if (!index || !index.documentStore) return {};
        return index.documentStore.getDoc(result.ref) || {};
    }

    function makeSnippet(doc, query) {
        const body = String(doc.body || doc.content || '').replace(/\s+/g, ' ').trim();
        if (!body) return '';
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        let start = 0;
        for (const term of terms) {
            const found = body.toLowerCase().indexOf(term);
            if (found >= 0) {
                start = Math.max(0, found - 55);
                break;
            }
        }
        const snippet = body.slice(start, start + 150);
        return `${start > 0 ? '…' : ''}${snippet}${start + 150 < body.length ? '…' : ''}`;
    }

    function getAllDocs() {
        if (!index?.documentStore?.docs) return [];
        return Object.entries(index.documentStore.docs).map(([ref, doc]) => ({ ref, doc }));
    }

    function fuzzyFallback(query) {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length) return [];

        return getAllDocs()
            .map(({ ref, doc }) => {
                const title = String(doc.title || '').toLowerCase();
                const body = String(doc.body || doc.content || '').toLowerCase();
                const haystack = `${title} ${body}`;
                let score = 0;

                for (const term of terms) {
                    const titleIndex = title.indexOf(term);
                    const bodyIndex = body.indexOf(term);
                    if (titleIndex < 0 && bodyIndex < 0) return null;
                    if (titleIndex >= 0) score += 8;
                    else score += 2;
                    if (title.startsWith(term)) score += 4;
                }

                return { ref, doc, score };
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
            .map(({ ref, score }) => ({ ref, score: score / 10 }))
            .slice(0, 8);
    }

    async function renderResults(query) {
        const requestId = ++searchRequestId;
        const normalizedQuery = query.trim();
        results.replaceChildren();
        activeIndex = -1;
        if (!normalizedQuery) return;

        try {
            await loadSearchIndex();
        } catch (error) {
            if (requestId !== searchRequestId || normalizedQuery !== input.value.trim()) return;
            const empty = document.createElement('div');
            empty.className = 'search-empty';
            empty.textContent = 'search index unavailable :|';
            results.appendChild(empty);
            return;
        }

        if (requestId !== searchRequestId || normalizedQuery !== input.value.trim()) return;

        let matches = [];
        try {
            const options = {
                bool: 'AND',
                expand: true,
                fields: {
                    title: { boost: 2 },
                    body: { boost: 1 }
                }
            };
            matches = index.search(normalizedQuery, options).slice(0, 8);
            if (!matches.length) {
                matches = fuzzyFallback(normalizedQuery);
            }
        } catch (error) {
            matches = fuzzyFallback(normalizedQuery);
        }

        if (!matches.length) {
            const empty = document.createElement('div');
            empty.className = 'search-empty';
            empty.textContent = 'no results :|';
            results.appendChild(empty);
            return;
        }

        matches.forEach((match, i) => {
            const doc = getDoc(match);
            const item = document.createElement('a');
            item.className = 'search-result';
            item.href = doc.permalink || match.ref;
            item.id = `search-result-${i}`;
            item.setAttribute('role', 'option');

            const title = document.createElement('strong');
            title.textContent = doc.title || 'Untitled';
            const snippet = document.createElement('span');
            snippet.textContent = makeSnippet(doc, normalizedQuery);
            item.append(title, snippet);
            item.addEventListener('mouseenter', () => setActive(i));
            item.addEventListener('click', close);
            results.appendChild(item);
        });
    }

    function setActive(next) {
        const items = [...results.querySelectorAll('.search-result')];
        if (!items.length) return;
        activeIndex = Math.max(0, Math.min(next, items.length - 1));
        items.forEach((item, i) => {
            item.classList.toggle('active', i === activeIndex);
            item.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
        });
        items[activeIndex].scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', items[activeIndex].id);
    }

    function open() {
        if (!palette) {
            palette = document.createElement('div');
            palette.className = 'search-palette';
            palette.innerHTML = `
                <div class="search-dialog" role="dialog" aria-modal="true" aria-label="Site search">
                    <div class="search-input-wrap">
                        <span aria-hidden="true">⌕</span>
                        <input type="search" class="search-input" role="combobox"
                            aria-expanded="true" aria-controls="search-results"
                            aria-autocomplete="list" autocomplete="off"
                            placeholder="search..." />
                        <kbd>Esc</kbd>
                    </div>
                    <div id="search-results" class="search-results" role="listbox" aria-label="Search results"></div>
                </div>`;
            document.body.appendChild(palette);
            input = palette.querySelector('.search-input');
            results = palette.querySelector('.search-results');

            let timer;
            input.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(() => renderResults(input.value), 120);
            });
            palette.addEventListener('mousedown', event => {
                if (event.target === palette) close();
            });
        }

        previousFocus = document.activeElement;
        palette.hidden = false;
        document.body.classList.add('search-open');
        input.value = '';
        results.replaceChildren();
        requestAnimationFrame(() => input.focus());
        loadSearchIndex().catch(() => {
            results.innerHTML = '<div class="search-empty">search index unavailable :|</div>';
        });
    }

    function close() {
        if (!palette || palette.hidden) return;
        palette.hidden = true;
        document.body.classList.remove('search-open');
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    }

    function trapFocus(event) {
        if (!palette || palette.hidden || event.key !== 'Tab') return;
        const focusables = [...palette.querySelectorAll('input, button, a[href], [tabindex]:not([tabindex="-1"])')];
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    document.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            open();
            return;
        }
        if (!palette || palette.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(activeIndex + 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(activeIndex <= 0 ? 0 : activeIndex - 1);
        } else if (event.key === 'Enter' && activeIndex >= 0) {
            const item = results.querySelectorAll('.search-result')[activeIndex];
            if (item) {
                event.preventDefault();
                item.click();
            }
        } else {
            trapFocus(event);
        }
    });

    document.addEventListener('click', event => {
        const trigger = event.target.closest('.search-trigger');
        if (trigger) {
            event.preventDefault();
            open();
        }
    });
})();
