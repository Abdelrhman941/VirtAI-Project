# Batch 11 Review: Frontend Diagram UI & Mermaid

## Execution Checklist
- [x] **Safe Mermaid Rendering**: Developed `useMermaidRender.ts` hook. Implemented safe asynchronous rendering via `mermaid.render()` within a `try-catch` block inside a `useEffect`. It updates the DOM directly via a `useRef` to bypass standard React string escaping securely and sets an error state gracefully if syntax parsing fails.
- [x] **Lazy Load Mermaid**: Dynamically imported `mermaid` inside the `useMermaidRender` hook's execution path to explicitly split the massive chunk out of the core application bundle, adhering to performance constraints.
- [x] **Document Picker**: Built `DocumentPicker.tsx` and nested it securely within `DiagramContainer.tsx`. The picker only renders documents assigned to the current `session_id` and forces strict single-selection through functional HTML Radio inputs.
- [x] **SVG + PNG Export Pipeline**: Developed reliable client-side export features in `DiagramViewer.tsx`. SVG is exported via raw source Blob. PNG is exported by loading the SVG Blob into an HTML `Image` object and drawing it onto an off-screen `Canvas2D` to securely derive the `toDataURL('image/png')`.
- [x] **Expand & ESC UX**: Implemented a `position: fixed` fullscreen expand mode for `DiagramViewer.tsx`. Hooked a `keydown` global listener to listen for `Escape` which unwinds the expanded view before entirely closing the diagram modal.

Batch 11 frontend implementation successfully executed and integrated.
