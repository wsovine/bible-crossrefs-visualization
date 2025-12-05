/**
 * Scroll Section Handlers
 * Manages interactions between scroll events and the arc visualization
 */

import { getReferencesFromBook, countReferencesPerBook } from './data-loader.js';

/**
 * Handle entering an OT book step
 * Highlights arcs originating from that book
 */
export function handleOtStepEnter(bookId, renderer, data) {
    if (!bookId || bookId.startsWith('ot-intro')) {
        // Intro step - show all OT->NT arcs
        renderer.clearHighlight();
        return;
    }

    // Highlight arcs from this book
    renderer.highlightBook(bookId);

    // Log for debugging
    const refs = getReferencesFromBook(data.otToNt.references, bookId, data.books);
    console.log(`${bookId}: ${refs.length} references to NT`);
}

/**
 * Handle entering an NT book step
 * Highlights arcs originating from that book (going back to OT)
 */
export function handleNtStepEnter(bookId, renderer, data) {
    if (!bookId || bookId.startsWith('nt-intro')) {
        // Intro step - show all NT->OT arcs
        renderer.clearHighlight();
        return;
    }

    // Highlight arcs from this book
    renderer.highlightBook(bookId);

    // Log for debugging
    const refs = getReferencesFromBook(data.ntToOt.references, bookId, data.books);
    console.log(`${bookId}: ${refs.length} references to OT`);
}

/**
 * Handle timeline event step
 */
export function handleTimelineEvent(eventId, renderer, data) {
    console.log('Timeline event:', eventId);
    // TODO: Implement timeline highlighting
}

/**
 * Handle reformation step
 */
export function handleReformationStep(stepId, renderer, data) {
    console.log('Reformation step:', stepId);
    // TODO: Implement deuterocanonical highlighting/removal
}

/**
 * Generate step content for a book
 */
export function generateBookStepContent(book, refCount, direction = 'to NT') {
    const directionText = direction === 'to NT'
        ? 'references to the New Testament'
        : 'references to the Old Testament';

    return `
        <h3>${book.name}</h3>
        <p class="ref-count">${refCount} ${directionText}</p>
    `;
}

/**
 * Get books grouped for display
 * Some smaller books are grouped together to reduce scroll steps
 */
export function getOtBookGroups(books) {
    const groups = [];

    // Define groupings - individual books vs grouped
    const individualBooks = new Set([
        'GEN', 'EXO', 'LEV', 'NUM', 'DEU',  // Pentateuch
        'JOS', 'JDG',                        // Early history
        '1SA', '2SA', '1KI', '2KI',          // Samuel & Kings
        '1CH', '2CH',                        // Chronicles
        'JOB', 'PSA', 'PRO', 'ECC', 'SNG',  // Wisdom
        'WIS', 'SIR',                        // Deuterocanonical wisdom
        'ISA', 'JER', 'LAM', 'BAR', 'EZK', 'DAN'  // Major prophets
    ]);

    const minorProphets = ['HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'];
    const postExilic = ['EZR', 'NEH', 'TOB', 'JDT', 'EST', '1MA', '2MA'];

    books.filter(b => b.testament === 'OT').forEach(book => {
        if (individualBooks.has(book.id)) {
            groups.push({ type: 'single', books: [book] });
        } else if (minorProphets.includes(book.id)) {
            // Check if we already have the minor prophets group
            const existing = groups.find(g => g.type === 'group' && g.name === 'Minor Prophets');
            if (existing) {
                existing.books.push(book);
            } else {
                groups.push({ type: 'group', name: 'Minor Prophets', books: [book] });
            }
        } else if (postExilic.includes(book.id)) {
            // Check if we already have the post-exilic group
            const existing = groups.find(g => g.type === 'group' && g.name === 'Post-Exilic Books');
            if (existing) {
                existing.books.push(book);
            } else {
                groups.push({ type: 'group', name: 'Post-Exilic Books', books: [book] });
            }
        }
    });

    return groups;
}

/**
 * Get NT books for display (most are shown individually)
 */
export function getNtBookGroups(books) {
    const groups = [];

    // Most NT books shown individually, but group some epistles
    const individualBooks = new Set([
        'MAT', 'MRK', 'LUK', 'JHN', 'ACT',  // Gospels & Acts
        'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL',  // Major Pauline
        'HEB', 'JAS', '1PE', '2PE',  // General epistles
        'REV'  // Revelation
    ]);

    const pastoralEpistles = ['1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM'];
    const johannineEpistles = ['1JN', '2JN', '3JN', 'JUD'];

    books.filter(b => b.testament === 'NT').forEach(book => {
        if (individualBooks.has(book.id)) {
            groups.push({ type: 'single', books: [book] });
        } else if (pastoralEpistles.includes(book.id)) {
            const existing = groups.find(g => g.type === 'group' && g.name === 'Pastoral Epistles');
            if (existing) {
                existing.books.push(book);
            } else {
                groups.push({ type: 'group', name: 'Pastoral Epistles', books: [book] });
            }
        } else if (johannineEpistles.includes(book.id)) {
            const existing = groups.find(g => g.type === 'group' && g.name === 'Short Epistles');
            if (existing) {
                existing.books.push(book);
            } else {
                groups.push({ type: 'group', name: 'Short Epistles', books: [book] });
            }
        }
    });

    return groups;
}
