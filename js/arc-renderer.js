/**
 * Arc Renderer - D3.js visualization for Bible cross-references
 *
 * Renders arcs connecting verses across the Bible timeline.
 * - X-axis: verse position (0 to totalVerses)
 * - Arcs above baseline: forward references (to later books)
 * - Arcs below baseline: backward references (to earlier books)
 */

export class ArcRenderer {
    constructor(selector, options = {}) {
        this.container = d3.select(selector);
        this.svg = null;
        this.g = null;

        // Default options
        this.options = {
            totalVerses: 35817,
            otEndPosition: 27862,  // Last verse position of OT (Malachi)
            ntStartPosition: 27863, // First verse position of NT (Matthew)
            margin: { top: 60, right: 40, bottom: 60, left: 40 },
            arcHeightRatio: 0.85,  // Arc height relative to width (slightly taller arcs)
            ...options
        };

        // State
        this.references = [];
        this.books = [];
        this.activeBook = null;
        this.revealedPosition = 0;

        // Scales
        this.xScale = null;
        this.width = 0;
        this.height = 0;
        this.baselineY = 0;
    }

    /**
     * Initialize the SVG and scales
     */
    init() {
        const containerNode = this.container.node();
        const rect = containerNode.getBoundingClientRect();

        this.width = rect.width - this.options.margin.left - this.options.margin.right;
        this.height = rect.height - this.options.margin.top - this.options.margin.bottom;
        this.baselineY = this.height / 2;

        // Clear existing content
        this.container.selectAll('*').remove();

        // Create SVG
        this.svg = this.container
            .append('svg')
            .attr('width', rect.width)
            .attr('height', rect.height);

        // Create main group with margins
        this.g = this.svg.append('g')
            .attr('transform', `translate(${this.options.margin.left}, ${this.options.margin.top})`);

        // Create scale
        this.xScale = d3.scaleLinear()
            .domain([0, this.options.totalVerses])
            .range([0, this.width]);

        // Draw baseline
        this.drawBaseline();

        // Draw testament divider
        this.drawTestamentDivider();

        return this;
    }

    /**
     * Draw the baseline (x-axis representing Bible timeline)
     */
    drawBaseline() {
        this.g.append('line')
            .attr('class', 'baseline')
            .attr('x1', 0)
            .attr('y1', this.baselineY)
            .attr('x2', this.width)
            .attr('y2', this.baselineY);
    }

    /**
     * Draw the OT/NT divider line
     */
    drawTestamentDivider() {
        const dividerX = this.xScale(this.options.ntStartPosition);

        this.g.append('line')
            .attr('class', 'testament-divider')
            .attr('x1', dividerX)
            .attr('y1', 0)
            .attr('x2', dividerX)
            .attr('y2', this.height);

        // Labels
        this.g.append('text')
            .attr('class', 'testament-label')
            .attr('x', dividerX - 10)
            .attr('y', 20)
            .attr('text-anchor', 'end')
            .text('Old Testament');

        this.g.append('text')
            .attr('class', 'testament-label')
            .attr('x', dividerX + 10)
            .attr('y', 20)
            .attr('text-anchor', 'start')
            .text('New Testament');
    }

    /**
     * Draw book tick marks and labels
     */
    drawBookMarkers(books) {
        this.books = books;

        // Major books to label (avoid clutter) - used for intro/default view
        this.majorBooks = new Set([
            // OT - Pentateuch & History
            'GEN', 'EXO', 'DEU', '1SA', '1KI', '2CH', 'JOB',
            // OT - Wisdom & Poetry
            'PSA', 'PRO', 'SIR',
            // OT - Prophets
            'ISA', 'JER', 'EZK', 'DAN', 'MAL',
            // NT
            'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', 'HEB', 'REV'
        ]);

        const bookGroup = this.g.append('g').attr('class', 'book-markers');

        books.forEach(book => {
            const x = this.xScale(book.startPosition);

            // Tick mark
            bookGroup.append('line')
                .attr('class', 'book-tick')
                .attr('x1', x)
                .attr('y1', this.baselineY - 5)
                .attr('x2', x)
                .attr('y2', this.baselineY + 5);

            // Label - add data attribute for filtering, and testament class
            const labelX = this.xScale(book.startPosition + book.verseCount / 2);
            bookGroup.append('text')
                .attr('class', `book-label book-label--${book.testament.toLowerCase()}`)
                .attr('data-book-id', book.id)
                .attr('data-testament', book.testament)
                .attr('x', labelX)
                .attr('y', this.baselineY + 20)
                .attr('text-anchor', 'middle')
                .attr('transform', `rotate(45, ${labelX}, ${this.baselineY + 20})`)
                .text(book.id)
                // Initially show only major books
                .style('opacity', this.majorBooks.has(book.id) ? 0.7 : 0);
        });
    }

    /**
     * Update book label visibility based on current section
     * @param {string} section - 'intro', 'ot', or 'nt'
     * @param {string} activeBookId - The currently active book (optional)
     */
    updateBookLabels(section, activeBookId = null) {
        const labels = this.g.selectAll('.book-label');

        if (section === 'intro') {
            // Show major books from both testaments
            // Use data attribute since we don't have bound data
            labels.each(function() {
                const el = d3.select(this);
                const bookId = el.attr('data-book-id');
                const isMajor = ['GEN', 'EXO', 'DEU', '1SA', '1KI', '2CH', 'JOB',
                    'PSA', 'PRO', 'SIR', 'ISA', 'JER', 'EZK', 'DAN', 'MAL',
                    'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', 'HEB', 'REV'].includes(bookId);
                el.style('opacity', isMajor ? 0.7 : 0);
            });
        } else if (section === 'ot') {
            // Hide OT labels except active book, show NT major labels
            labels.each(function() {
                const el = d3.select(this);
                const bookId = el.attr('data-book-id');
                const testament = el.attr('data-testament');

                if (testament === 'OT') {
                    // Only show the active book
                    el.style('opacity', bookId === activeBookId ? 1 : 0);
                } else {
                    // Show NT major books
                    const ntMajor = ['MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', 'HEB', 'REV'];
                    el.style('opacity', ntMajor.includes(bookId) ? 0.7 : 0);
                }
            });
        } else if (section === 'nt') {
            // Hide NT labels except active book, show OT major labels
            labels.each(function() {
                const el = d3.select(this);
                const bookId = el.attr('data-book-id');
                const testament = el.attr('data-testament');

                if (testament === 'NT') {
                    // Only show the active book
                    el.style('opacity', bookId === activeBookId ? 1 : 0);
                } else {
                    // Show OT major books
                    const otMajor = ['GEN', 'EXO', 'DEU', '1SA', '1KI', '2CH', 'JOB',
                        'PSA', 'PRO', 'SIR', 'ISA', 'JER', 'EZK', 'DAN', 'MAL'];
                    el.style('opacity', otMajor.includes(bookId) ? 0.7 : 0);
                }
            });
        }
    }

    /**
     * Generate SVG arc path between two positions
     * Uses true semicircular arcs (SVG arc command)
     * @param {number} fromPos - Start verse position
     * @param {number} toPos - End verse position
     * @returns {string} SVG path string
     */
    createArcPath(fromPos, toPos) {
        const x1 = this.xScale(fromPos);
        const x2 = this.xScale(toPos);
        const radius = Math.abs(x2 - x1) / 2;

        if (radius === 0) return null;

        // Determine direction: forward = above, backward = below
        const isForward = toPos > fromPos;

        // Apply height ratio to create elliptical arcs (rx, ry)
        const rx = radius;
        const ry = radius * this.options.arcHeightRatio;

        // SVG arc command: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
        // Forward refs (toPos > fromPos): arc above baseline
        // Backward refs (toPos < fromPos): arc below baseline
        //
        // When drawing left-to-right (x1 < x2), sweep=1 goes above
        // When drawing right-to-left (x1 > x2), sweep=0 goes below
        // But we always draw from fromPos to toPos, so:
        // - Forward: x1 < x2, sweep=1 -> above (correct)
        // - Backward: x1 > x2, sweep=0 -> but this draws above too!
        //
        // Solution: always draw left-to-right and adjust sweep based on direction
        const leftX = Math.min(x1, x2);
        const rightX = Math.max(x1, x2);

        // sweep=1 draws above, sweep=0 draws below (when going left to right)
        const sweepFlag = isForward ? 1 : 0;

        return `M ${leftX} ${this.baselineY} A ${rx} ${ry} 0 0 ${sweepFlag} ${rightX} ${this.baselineY}`;
    }

    /**
     * Set cross-reference data
     */
    setReferences(references) {
        this.references = references;
        return this;
    }

    /**
     * Calculate dynamic opacity based on reference count
     * Formula from notebook: max(0.02, min(0.2, 3000 / refCount))
     */
    calculateAutoAlpha() {
        const refCount = this.references.length;
        if (refCount === 0) return 0.15;
        return Math.max(0.02, Math.min(0.2, 3000 / refCount));
    }

    /**
     * Render all arcs
     * Uses path batching for performance with large datasets
     */
    renderArcs() {
        // Remove existing arcs
        this.g.selectAll('.arcs-group').remove();

        const arcsGroup = this.g.append('g').attr('class', 'arcs-group');

        // Calculate dynamic opacity based on reference count
        const autoAlpha = this.calculateAutoAlpha();
        console.log(`Using auto-alpha: ${autoAlpha.toFixed(3)} for ${this.references.length} references`);

        // Update CSS custom property - this allows CSS classes to override via !important or specificity
        document.documentElement.style.setProperty('--arc-opacity-base', autoAlpha);

        // Separate by target testament for coloring
        const otTargetRefs = this.references.filter(r => r.toPosition <= this.options.otEndPosition);
        const ntTargetRefs = this.references.filter(r => r.toPosition > this.options.otEndPosition);

        // Batch OT-target arcs into single path
        // Note: Don't use inline styles so CSS classes can override for highlighting
        if (otTargetRefs.length > 0) {
            const otPath = otTargetRefs
                .map(r => this.createArcPath(r.fromPosition, r.toPosition))
                .filter(Boolean)
                .join(' ');

            arcsGroup.append('path')
                .attr('class', 'arc-path arc-path--ot')
                .attr('d', otPath);
        }

        // Batch NT-target arcs into single path
        if (ntTargetRefs.length > 0) {
            const ntPath = ntTargetRefs
                .map(r => this.createArcPath(r.fromPosition, r.toPosition))
                .filter(Boolean)
                .join(' ');

            arcsGroup.append('path')
                .attr('class', 'arc-path arc-path--nt')
                .attr('d', ntPath);
        }

        return this;
    }

    /**
     * Highlight arcs from a specific book
     */
    highlightBook(bookId) {
        this.activeBook = bookId;
        const book = this.books.find(b => b.id === bookId);
        if (!book) {
            console.warn(`Book not found: ${bookId}`);
            return this;
        }

        // Get references from this book
        const bookRefs = this.references.filter(r =>
            r.fromPosition >= book.startPosition &&
            r.fromPosition <= book.endPosition
        );

        console.log(`Highlighting ${bookId}: ${bookRefs.length} arcs`);

        // Remove existing highlights
        this.g.selectAll('.arcs-highlight').remove();

        // Dim base arcs
        this.g.selectAll('.arc-path')
            .classed('arc-path--dim', true);

        // Draw highlighted arcs
        const highlightGroup = this.g.append('g').attr('class', 'arcs-highlight');

        const otHighlight = bookRefs.filter(r => r.toPosition <= this.options.otEndPosition);
        const ntHighlight = bookRefs.filter(r => r.toPosition > this.options.otEndPosition);

        if (otHighlight.length > 0) {
            const path = otHighlight.map(r => this.createArcPath(r.fromPosition, r.toPosition)).filter(Boolean).join(' ');
            highlightGroup.append('path')
                .attr('class', 'arc-path arc-path--ot arc-path--highlight')
                .attr('d', path);
        }

        if (ntHighlight.length > 0) {
            const path = ntHighlight.map(r => this.createArcPath(r.fromPosition, r.toPosition)).filter(Boolean).join(' ');
            highlightGroup.append('path')
                .attr('class', 'arc-path arc-path--nt arc-path--highlight')
                .attr('d', path);
        }

        return this;
    }

    /**
     * Remove all highlights, restore base opacity
     */
    clearHighlight() {
        this.activeBook = null;
        this.g.selectAll('.arcs-highlight').remove();
        this.g.selectAll('.arc-path')
            .classed('arc-path--dim', false);
        return this;
    }

    /**
     * Progressively reveal arcs up to a position
     * Used for scroll-based animation
     */
    revealToPosition(position) {
        this.revealedPosition = position;

        // Filter references up to this position
        const visibleRefs = this.references.filter(r => r.fromPosition <= position);

        // Re-render with only visible references
        const tempRefs = this.references;
        this.references = visibleRefs;
        this.renderArcs();
        this.references = tempRefs;

        return this;
    }

    /**
     * Handle window resize
     */
    resize() {
        this.init();
        if (this.books.length > 0) {
            this.drawBookMarkers(this.books);
        }
        this.renderArcs();
        if (this.activeBook) {
            this.highlightBook(this.activeBook);
        }
        return this;
    }
}
