/**
 * Main application entry point
 * Initializes the arc visualization with real data from JSON files
 */

import { ArcRenderer } from './arc-renderer.js';
import { loadAllData, countReferencesPerBook, getReferencesFromBook } from './data-loader.js';
import { handleOtStepEnter, handleNtStepEnter } from './scroll-sections.js';

// Global state
let data = null;
let renderer = null;
let currentSection = 'intro';

/**
 * Initialize the visualization
 */
async function init() {
    console.log('Initializing Bible Cross-Reference Visualization...');

    try {
        // Load real data from JSON files
        data = await loadAllData();

        // Initialize the main arc renderer with real data dimensions
        renderer = new ArcRenderer('#arc-viz', {
            totalVerses: data.books.totalVerses,
            otEndPosition: data.books.otEndPosition,
            ntStartPosition: data.books.ntStartPosition
        });

        renderer.init();
        renderer.setReferences(data.allCrossTestament);
        renderer.drawBookMarkers(data.books.books);
        renderer.renderArcs();

        console.log(`Rendered ${data.allCrossTestament.length} cross-testament references`);

        // Calculate reference counts per book
        const otRefCounts = countReferencesPerBook(data.otToNt.references, data.books);
        const ntRefCounts = countReferencesPerBook(data.ntToOt.references, data.books);

        // Generate dynamic book steps
        generateOtSteps(otRefCounts);
        generateNtSteps(ntRefCounts);

        // Log top books
        logTopBooks(otRefCounts, 'OT → NT');
        logTopBooks(ntRefCounts, 'NT → OT');

        // Handle resize
        window.addEventListener('resize', debounce(() => {
            renderer.resize();
        }, 250));

        // For testing: expose to console
        window.arcRenderer = renderer;
        window.vizData = data;

        // Initialize Scrollama
        initScrollama();

    } catch (error) {
        console.error('Failed to initialize visualization:', error);
        showError(error.message);
    }
}

/**
 * Format verse ID (e.g., GEN-3-15) to readable form (Genesis 3:15)
 */
function formatVerseRef(verseId, bookName = null) {
    const parts = verseId.split('-');
    if (parts.length >= 3) {
        const bookId = parts[0];
        const chapter = parts[1];
        const verse = parts[2];
        const name = bookName || bookId;
        return `${name} ${chapter}:${verse}`;
    }
    return verseId;
}

/**
 * Generate HTML for a single verse card
 */
function generateVerseCardHtml(verse, direction) {
    const book = data.books.books.find(b => b.id === verse.from_book);
    const bookName = book ? book.name : verse.from_book;
    const sourceRef = formatVerseRef(verse.from_id, bookName);

    // Build the target verses HTML
    let targetsHtml = '';
    if (verse.targets && verse.targets.length > 0) {
        const targetItems = verse.targets.slice(0, 3).map(target => {
            const targetBook = data.books.books.find(b => b.id === target.to_book);
            const targetBookName = targetBook ? targetBook.name : target.to_book;
            const targetRef = formatVerseRef(target.to_id, targetBookName);

            // Check for passage group members
            if (target.passage_members && target.passage_members.length > 1) {
                return `<div class="target-verse">
                    <span class="verse-ref">${targetRef}</span>
                    <span class="passage-group">(+ ${target.passage_members.length - 1} more in passage)</span>
                    <p class="verse-text">"${target.to_text}"</p>
                </div>`;
            }

            return `<div class="target-verse">
                <span class="verse-ref">${targetRef}</span>
                <p class="verse-text">"${target.to_text}"</p>
            </div>`;
        }).join('');

        targetsHtml = `<div class="target-verses">${targetItems}</div>`;
    }

    const sectionClass = direction === 'ot' ? 'verse-card--ot' : 'verse-card--nt';

    return `
        <div class="verse-card ${sectionClass}">
            <div class="source-verse">
                <span class="verse-ref">${sourceRef}</span>
                <p class="verse-text">"${verse.from_text}"</p>
            </div>
            ${targetsHtml}
        </div>
    `;
}

/**
 * Generate HTML for verse carousel of a book
 */
function generateVersesCarouselHtml(bookId, direction) {
    const versesData = direction === 'ot'
        ? data.topVerses.otToNt[bookId]
        : data.topVerses.ntToOt[bookId];

    if (!versesData || versesData.length === 0) {
        return '';
    }

    // Sort by count (most referenced first) - should already be sorted but ensure
    const sortedVerses = [...versesData].sort((a, b) => b.count - a.count);

    // Generate cards for all verses
    const cardsHtml = sortedVerses.map(verse => generateVerseCardHtml(verse, direction)).join('');

    const showIndicator = sortedVerses.length > 1 ? '' : 'style="display: none;"';

    return `
        <div class="verses-carousel">
            <div class="carousel-track">
                ${cardsHtml}
            </div>
            <div class="carousel-indicator" ${showIndicator}>
                <span class="carousel-hint">Scroll for more verses</span>
                <span class="carousel-count">${sortedVerses.length} verses</span>
            </div>
        </div>
    `;
}

/**
 * Generate OT book steps dynamically
 */
function generateOtSteps(refCounts) {
    const container = document.querySelector('#ot-scroll');
    if (!container) return;

    const otBooks = data.books.books.filter(b => b.testament === 'OT');

    otBooks.forEach(book => {
        const count = refCounts.get(book.id) || 0;
        if (count === 0) return; // Skip books with no cross-testament refs

        const carouselHtml = generateVersesCarouselHtml(book.id, 'ot');

        const step = document.createElement('div');
        step.className = 'step';
        step.dataset.step = `ot-${book.id}`;
        step.dataset.book = book.id;
        step.innerHTML = `
            <h3>${book.name}</h3>
            <p class="ref-count">${count} verse${count !== 1 ? 's' : ''} revealed in the New Testament</p>
            ${carouselHtml}
        `;
        container.appendChild(step);
    });
}

/**
 * Generate NT book steps dynamically
 */
function generateNtSteps(refCounts) {
    const container = document.querySelector('#nt-scroll');
    if (!container) return;

    const ntBooks = data.books.books.filter(b => b.testament === 'NT');

    ntBooks.forEach(book => {
        const count = refCounts.get(book.id) || 0;
        if (count === 0) return; // Skip books with no cross-testament refs

        const carouselHtml = generateVersesCarouselHtml(book.id, 'nt');

        const step = document.createElement('div');
        step.className = 'step';
        step.dataset.step = `nt-${book.id}`;
        step.dataset.book = book.id;
        step.innerHTML = `
            <h3>${book.name}</h3>
            <p class="ref-count">${count} verse${count !== 1 ? 's' : ''} hidden in the Old Testament</p>
            ${carouselHtml}
        `;
        container.appendChild(step);
    });
}

/**
 * Log top books by reference count
 */
function logTopBooks(refCounts, label) {
    const sorted = [...refCounts.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    console.log(`Top 10 books (${label}):`);
    sorted.forEach(([book, count], i) => {
        console.log(`  ${i + 1}. ${book}: ${count}`);
    });
}

/**
 * Initialize Scrollama for scroll-driven interactions
 */
function initScrollama() {
    if (typeof scrollama === 'undefined') {
        console.warn('Scrollama not loaded, skipping scroll setup');
        return;
    }

    const scroller = scrollama();

    scroller
        .setup({
            step: '.step',
            offset: 0.5,
            progress: false
        })
        .onStepEnter(response => {
            response.element.classList.add('is-active');
            handleStepEnter(response.element);
        })
        .onStepExit(response => {
            response.element.classList.remove('is-active');
        });

    // Handle resize
    window.addEventListener('resize', scroller.resize);

    console.log('Scrollama initialized');
}

/**
 * Handle step enter events
 */
function handleStepEnter(element) {
    const stepId = element.dataset.step;
    const bookId = element.dataset.book;

    console.log('Step enter:', stepId, bookId ? `(${bookId})` : '');

    // Determine which section we're in
    if (stepId.startsWith('ot-')) {
        currentSection = 'ot';
        if (bookId) {
            handleOtStepEnter(bookId, renderer, data);
            renderer.updateBookLabels('ot', bookId);
        } else {
            // Intro step - show all arcs
            renderer.clearHighlight();
            renderer.updateBookLabels('ot', null);
        }
    } else if (stepId.startsWith('nt-')) {
        currentSection = 'nt';
        if (bookId) {
            handleNtStepEnter(bookId, renderer, data);
            renderer.updateBookLabels('nt', bookId);
        } else {
            renderer.clearHighlight();
            renderer.updateBookLabels('nt', null);
        }
    } else if (stepId.startsWith('intro-')) {
        currentSection = 'intro';
        renderer.clearHighlight();
        renderer.updateBookLabels('intro');
    } else if (stepId.startsWith('timeline-')) {
        currentSection = 'timeline';
        renderer.clearHighlight();
        renderer.updateBookLabels('intro'); // Show all major labels
    } else if (stepId.startsWith('reformation-')) {
        currentSection = 'reformation';
        renderer.clearHighlight();
        renderer.updateBookLabels('intro'); // Show all major labels
    }
}

/**
 * Show error message to user
 */
function showError(message) {
    const container = document.querySelector('#arc-viz');
    if (container) {
        container.innerHTML = `
            <div style="color: #ff6b6b; padding: 2rem; text-align: center;">
                <h3>Failed to load visualization</h3>
                <p>${message}</p>
                <p style="font-size: 0.9em; opacity: 0.7;">
                    Make sure the data files exist in the data/ directory.
                </p>
            </div>
        `;
    }
}

/**
 * Debounce utility
 */
function debounce(fn, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
