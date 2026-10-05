import React, { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, FileText } from 'lucide-react';
import ResumePreview from './ResumePreview';
import { useAppSelector } from '../../hooks';

const PreviewContainer: React.FC = () => {
  const [zoom, setZoom] = useState(75);
  const [fit, setFit] = useState(true);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [size, setSize] = useState({ width: 794, height: 1123, overflow: false });
  const viewportRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const data = useAppSelector(state => state.resume.data);
  const darkMode = useAppSelector(state => state.resume.settings.darkMode);
  const dm = darkMode;
  useEffect(() => {
    const viewport = viewportRef.current;
    const paper = documentRef.current?.querySelector<HTMLElement>('#resume-preview');
    if (!viewport || !paper) return;
    const measure = () => {
      const style = getComputedStyle(viewport);
      setAvailableWidth(Math.max(0, viewport.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0')));
      if (paper.offsetWidth > 0) setSize({ width: paper.offsetWidth, height: paper.offsetHeight, overflow: paper.scrollWidth > paper.clientWidth + 1 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [data]);
  const scale = fit && availableWidth > 0 ? Math.min(1.5, availableWidth / size.width) : zoom / 100;
  const percent = Math.round(scale * 100);
  const changeZoom = (value: number) => { setFit(false); setZoom(Math.max(10, Math.min(150, value))); };
  const pages = Math.max(1, Math.ceil((size.height - 1) / (size.width * 297 / 210)));

  return (
    <div className={`flex flex-col h-full ${dm ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <FileText className={`h-4 w-4 ${dm ? 'text-gray-400' : 'text-gray-500'}`} />
            <span className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-700'}`}>Preview</span>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${dm ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <button
              onClick={() => changeZoom(percent - 10)}
              disabled={percent <= 10}
              aria-label="Zoom out"
              title="Zoom out"
              className={`p-1 rounded transition-colors ${dm ? 'hover:bg-gray-600 text-gray-300 disabled:text-gray-600' : 'hover:bg-gray-200 text-gray-600 disabled:text-gray-300'}`}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span aria-live="polite" aria-label={`Zoom ${percent}%`} className={`text-xs font-mono min-w-[38px] text-center ${dm ? 'text-gray-300' : 'text-gray-600'}`}>{percent}%</span>
            <button
              onClick={() => changeZoom(percent + 10)}
              disabled={percent >= 150}
              aria-label="Zoom in"
              title="Zoom in"
              className={`p-1 rounded transition-colors ${dm ? 'hover:bg-gray-600 text-gray-300 disabled:text-gray-600' : 'hover:bg-gray-200 text-gray-600 disabled:text-gray-300'}`}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFit(true)}
            aria-label="Fit resume to available width"
            aria-pressed={fit}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${dm ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Fit
          </button>
          <button
            onClick={() => changeZoom(100)}
            aria-label="Reset zoom to 100 percent"
            aria-pressed={!fit && zoom === 100}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${dm ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            100%
          </button>
        </div>
      </div>

      <div className={`px-4 py-2 text-xs border-b ${dm ? 'text-gray-300 border-gray-700' : 'text-gray-600 border-gray-200'}`}>
        <p role="status">{pages > 1 ? `Content exceeds one A4 page (about ${pages} pages). Visual PDF may add pages to avoid splitting entries.` : 'A4 preview. Visual PDF preserves this design.'}{size.overflow ? ' Content exceeds the page width. Reduce font size or shorten long fields before exporting.' : ''}</p>
        <details>
          <summary className="cursor-pointer">Template and export limits</summary>
          <p>Visual PDF is an image, not selectable ATS text. ATS PDF uses a simple Helvetica layout and rejects unsupported Unicode; use DOCX for selectable Unicode text. DOCX uses the chosen font but a fixed layout, sizes and colors. TXT and Markdown carry content only. LaTeX uses a fixed layout; non-Latin scripts may need additional font and engine setup.</p>
          {data.styling.template === 'classic' && <p>Classic intentionally uses Times New Roman and black, regardless of font and color settings.</p>}
          {data.styling.template === 'compact' && <p>Compact uses a smaller font and groups sections into fixed main and sidebar columns; ordering applies within each column.</p>}
          {data.styling.template !== 'modern' && <p>The accent color is used by Modern only. This template uses its existing color scheme.</p>}
          <p>Oversized entries and overlapping two-column rows may split across pages. This continuous preview does not show exact PDF page breaks.</p>
        </details>
      </div>

      <div ref={viewportRef} className="flex-1 overflow-auto p-6 min-h-0" aria-label="Resume preview">
        <div style={{ width: size.width * scale, height: size.height * scale, margin: '0 auto', position: 'relative' }}>
          <div ref={documentRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: size.width, position: 'absolute' }}>
            <ResumePreview />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewContainer;
