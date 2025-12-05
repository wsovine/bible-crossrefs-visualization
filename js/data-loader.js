/**
 * Data Loader - Loads JSON data files for the visualization
 */

const DATA_PATH = './data';

/**
 * Load book metadata
 * @returns {Promise<Object>} Book data with positions and metadata
 */
export async function loadBooks() {
    const response = await fetch(`${DATA_PATH}/books.json`);
    if (!response.ok) {
        throw new Error(`Failed to load books.json: ${response.status}`);
    }
    return response.json();
}

/**
 * Load OT to NT cross-references
 * @returns {Promise<Object>} Cross-reference data
 */
export async function loadOtToNtRefs() {
    const response = await fetch(`${DATA_PATH}/crossrefs-ot-to-nt.json`);
    if (!response.ok) {
        throw new Error(`Failed to load crossrefs-ot-to-nt.json: ${response.status}`);
    }
    return response.json();
}

/**
 * Load NT to OT cross-references
 * @returns {Promise<Object>} Cross-reference data
 */
export async function loadNtToOtRefs() {
    const response = await fetch(`${DATA_PATH}/crossrefs-nt-to-ot.json`);
    if (!response.ok) {
        throw new Error(`Failed to load crossrefs-nt-to-ot.json: ${response.status}`);
    }
    return response.json();
}

/**
 * Load top verses data with text and passage groups
 * @returns {Promise<Object>} Top verses data
 */
export async function loadTopVerses() {
    const response = await fetch(`${DATA_PATH}/top-verses.json`);
    if (!response.ok) {
        throw new Error(`Failed to load top-verses.json: ${response.status}`);
    }
    return response.json();
}

/**
 * Load all data needed for the visualization
 * @returns {Promise<Object>} Combined data object
 */
export async function loadAllData() {
    console.log('Loading visualization data...');

    const [booksData, otToNtData, ntToOtData, topVersesData] = await Promise.all([
        loadBooks(),
        loadOtToNtRefs(),
        loadNtToOtRefs(),
        loadTopVerses()
    ]);

    console.log(`Loaded ${booksData.books.length} books`);
    console.log(`Loaded ${otToNtData.references.length} OT→NT references`);
    console.log(`Loaded ${ntToOtData.references.length} NT→OT references`);
    console.log(`Loaded top verses data`);

    return {
        books: booksData,
        otToNt: otToNtData,
        ntToOt: ntToOtData,
        topVerses: topVersesData,
        // Combined references for full visualization
        allCrossTestament: [
            ...otToNtData.references,
            ...ntToOtData.references
        ]
    };
}

/**
 * Get references originating from a specific book
 * @param {Array} references - All references
 * @param {string} bookId - Book ID (e.g., 'GEN', 'PSA')
 * @param {Object} booksData - Book metadata
 * @returns {Array} Filtered references
 */
export function getReferencesFromBook(references, bookId, booksData) {
    const book = booksData.books.find(b => b.id === bookId);
    if (!book) return [];

    return references.filter(ref =>
        ref.fromPosition >= book.startPosition &&
        ref.fromPosition <= book.endPosition
    );
}

/**
 * Get references targeting a specific book
 * @param {Array} references - All references
 * @param {string} bookId - Book ID
 * @param {Object} booksData - Book metadata
 * @returns {Array} Filtered references
 */
export function getReferencesToBook(references, bookId, booksData) {
    const book = booksData.books.find(b => b.id === bookId);
    if (!book) return [];

    return references.filter(ref =>
        ref.toPosition >= book.startPosition &&
        ref.toPosition <= book.endPosition
    );
}

/**
 * Count references per book (as source)
 * @param {Array} references - All references
 * @param {Object} booksData - Book metadata
 * @returns {Map} Map of bookId -> count
 */
export function countReferencesPerBook(references, booksData) {
    const counts = new Map();

    booksData.books.forEach(book => {
        const count = references.filter(ref =>
            ref.fromPosition >= book.startPosition &&
            ref.fromPosition <= book.endPosition
        ).length;
        counts.set(book.id, count);
    });

    return counts;
}
