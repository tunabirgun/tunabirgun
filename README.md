<div align="center">

# Tuna Birgün

**computational biology · transcriptomics · genomics · reproducible scientific software**

MSc Biotechnology, Istanbul Technical University · Research Assistant, Istanbul Yeni Yuzyil University

[tunabirgun.com](https://tunabirgun.com) · [Email](mailto:tunabirgun@gmail.com) · [LinkedIn](https://www.linkedin.com/in/tunabirgun/) · [X](https://x.com/tunabirgun) · [ORCID](https://orcid.org/0009-0009-1827-7933)

</div>

---

## About

I work across transcriptomics, functional genomics, and single-cell analysis. My research includes bulk RNA-seq, microarrays, differential expression, functional enrichment, protein–protein interaction networks, and HPC-based single-cell and single-nucleus RNA-seq. I often work with crops, filamentous fungi, and yeasts that lack ready-made Bioconductor annotation, including *Fusarium graminearum* in wheat and barley.

I turn these methods into reproducible, local-first scientific software in R and Python. My projects span no-code expression analysis, transposable-element annotation and primer design, leakage-aware multi-omics benchmarking, and knowledge tools for researchers. I care about interface design, typography, and visual craft as much as technical correctness.

I am also interested in epistemology and the methodology and history of science: how knowledge is justified, how methods earn trust, and how software can preserve the evidence behind a result.

## Toolbox

- **Languages & application development:** R · Python · TypeScript · JavaScript · Rust · Bash · PySide6 / Qt · Tauri · Svelte · React · WebGPU
- **Transcriptomics & machine learning:** Bioconductor · DESeq2 · limma · edgeR · Seurat · Scanpy · scvi-tools · PyTorch · scikit-learn
- **Sequencing & genomics:** STAR / STARsolo · HISAT2 · Salmon / alevin · fastp · FastQC / MultiQC · SAMtools · featureCounts · HMMER · RepeatMasker · Dfam · Primer3 · minimap2
- **Networks, annotation & visualization:** STRING · GO · KEGG · g:Profiler · clusterProfiler · Reactome · Ensembl · eggNOG · igraph · ggraph · ggplot2 · Plotly
- **Reproducibility & quality assurance:** Snakemake · conda / mamba · renv · Docker · WSL2 · GitHub Actions · pytest · Vitest · Playwright

## Selected work

**[Arf](https://github.com/tunabirgun/arf)** — a local-first second brain for scientists and coders: plain-Markdown notes with `[[wikilinks]]`, LaTeX and syntax-highlighted code, a knowledge graph, and on-device embeddings (MiniLM) that surface related but unlinked notes. Native desktop app for Windows, macOS, and Linux. [Download](https://github.com/tunabirgun/arf/releases/latest).

**[Litehouse](https://github.com/tunabirgun/litehouse)** ([live](https://tunabirgun.github.io/litehouse/)) — a browser-only scholarly literature-review tool: it retrieves works from open APIs (OpenAlex, Crossref, DataCite, Europe PMC, Semantic Scholar, Library of Congress), then writes an evidence-locked, cited synthesis with a local WebGPU model (Qwen3), attaches SHA-256 integrity receipts, and exports a classic Computer Modern LaTeX report. No server and no install — retrieval, the model, and rendering all run in the browser.

**[BulkSeq Studio](https://github.com/tunabirgun/bulkseq-studio)** — a no-code desktop app for Windows and x86-64 Linux for reproducible bulk RNA-seq and microarray analysis: STAR / HISAT2 / Salmon alignment, DESeq2 / limma, GO / KEGG / g:Profiler enrichment, and STRING interaction networks, with first-class support for crops and fungi that lack a Bioconductor OrgDb.

**[TEagle](https://github.com/tunabirgun/TEagle)** — a native desktop app for transposable-element annotation and TE-aware PCR primer design: evidence-traceable structural and protein-domain (HMMER) classification, an interactive genome viewer, Primer3 design checked by pair-aware in-silico PCR, a local whole-genome off-target scan (UCSC isPcr against a downloaded assembly), and Dfam / RepeatMasker family annotation and minimap2 splice detection through a managed WSL backend — with every result sealed by content-addressed provenance (database and tool versions plus checksums) so it reproduces exactly. Windows, no command line. [Download](https://github.com/tunabirgun/TEagle/releases/latest).

**[omicau](https://github.com/tunabirgun/omicau)** — a reproducible, leakage-aware multi-omics data-audit CLI: format-agnostic ingestion and alignment, SHA-256 data provenance, missingness-bias and batch-effect diagnostics, group-aware cross-validated classical and PyTorch masked-pooling fusion benchmarks with leakage-aware feature attribution, and a dual clinical/research dashboard. Built for the [Build with Claude: Life Sciences](https://cerebralvalley.ai/e/built-with-claude-life-sciences) hackathon (Anthropic × Gladstone Institutes, Jul 7–13 2026).

---

<div align="center">

Beyond code, I write essays, in Turkish and English, at [tunabirgun.com](https://tunabirgun.com).

</div>
