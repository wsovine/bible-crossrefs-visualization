# Bible Cross-References Visualization

An interactive scrollytelling visualization showing cross-references between the Old and New Testaments.

**Live Site:** [wsovine.github.io/bible-crossrefs-visualization](https://wsovine.github.io/bible-crossrefs-visualization)

## About

This visualization draws arc connections between Old Testament and New Testament books based on cross-reference data from the Haydock Catholic Bible Commentary. As you scroll through each book, the arcs highlight connections to the opposite testament, with a verse carousel showing the most referenced passages.

**Data highlights:**
- 73 books (Catholic canon including Deuterocanonical books)
- 1,534 cross-testament references (754 OT→NT, 780 NT→OT)
- Full verse text from Haydock Commentary

## Tech Stack

- **D3.js v7** - Arc visualization
- **Scrollama 3.2.0** - Scroll-driven interactions
- **Vanilla JS/CSS** - No build tools or frameworks

## Project Structure

```
├── index.html
├── css/
│   ├── variables.css    # Design tokens
│   ├── main.css         # Core styles
│   └── responsive.css   # Mobile breakpoints
├── js/
│   ├── main.js          # Entry point, Scrollama setup
│   ├── arc-renderer.js  # D3 visualization
│   ├── data-loader.js   # JSON loading
│   └── scroll-sections.js
├── data/
│   ├── books.json
│   ├── crossrefs-ot-to-nt.json
│   ├── crossrefs-nt-to-ot.json
│   └── top-verses.json
└── export/              # Python scripts for Neo4j data export
```

## Part of LogosGraph

This visualization is part of the [LogosGraph](https://github.com/wsovine/LogosGraph) project, a Neo4j knowledge graph for exploring biblical cross-references.