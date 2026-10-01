import {
  AlignCenter, Bold, ChevronsUpDown, Indent, Italic, List, ListOrdered, Outdent, Quote, Redo2,
  RemoveFormatting, Strikethrough, Type, Underline, Undo2,
} from 'lucide-react';
import { forwardRef, ReactNode, useImperativeHandle, useRef, useState } from 'react';

export interface EditorHandle { getHtml: () => string; getText: () => string }

// document.execCommand is deprecated but universally supported and perfect for a small toolbar like this.
const run = (cmd: string, value?: string) => document.execCommand(cmd, false, value);

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      className="rounded-lg p-2 text-slate-600 transition hover:bg-surface hover:text-slate-900">
      {children}
    </button>
  );
}
const Sep = () => <span className="mx-1.5 h-6 w-px bg-slate-200" />;

const SIZES: [string, string][] = [['Small', '2'], ['Normal', '3'], ['Large', '5'], ['Huge', '6']];
const ALIGN = ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'];

export const RichTextEditor = forwardRef<EditorHandle, { onChange?: (hasText: boolean) => void }>(({ onChange }, ref) => {
  const el = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);
  const [sizeMenu, setSizeMenu] = useState(false);
  const alignIdx = useRef(0);

  useImperativeHandle(ref, () => ({
    getHtml: () => el.current?.innerHTML ?? '',
    getText: () => el.current?.innerText.trim() ?? '',
  }));

  const sync = () => {
    const has = (el.current?.innerText.trim().length ?? 0) > 0;
    setEmpty(!has);
    onChange?.(has);
  };

  return (
    <div className="min-h-[560px] rounded-2xl bg-canvas p-5">
      <div className={`px-2 pb-3 text-[17px] text-slate-400 ${empty ? '' : 'invisible'}`} onClick={() => el.current?.focus()}>
        Type Your Reply...
      </div>

      <div className="relative flex flex-wrap items-center rounded-full bg-white px-3 py-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]">
        <Tool label="Undo" onClick={() => run('undo')}><Undo2 size={20} /></Tool>
        <Tool label="Redo" onClick={() => run('redo')}><Redo2 size={20} /></Tool>
        <Sep />
        <div className="relative">
          <Tool label="Font size" onClick={() => setSizeMenu((m) => !m)}>
            <span className="flex items-center gap-1"><Type size={20} /><ChevronsUpDown size={12} /></span>
          </Tool>
          {sizeMenu && (
            <div className="absolute left-0 top-full z-20 mt-1 w-28 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              {SIZES.map(([label, v]) => (
                <button key={v} type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { run('fontSize', v); setSizeMenu(false); sync(); }}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-surface">{label}</button>
              ))}
            </div>
          )}
        </div>
        <Sep />
        <Tool label="Bold" onClick={() => run('bold')}><Bold size={20} /></Tool>
        <Tool label="Italic" onClick={() => run('italic')}><Italic size={20} /></Tool>
        <Tool label="Underline" onClick={() => run('underline')}><Underline size={20} /></Tool>
        <Sep />
        <Tool label="Align (click to cycle)" onClick={() => { alignIdx.current = (alignIdx.current + 1) % ALIGN.length; run(ALIGN[alignIdx.current]); }}>
          <AlignCenter size={20} />
        </Tool>
        <Sep />
        <Tool label="Numbered list" onClick={() => run('insertOrderedList')}><ListOrdered size={20} /></Tool>
        <Tool label="Bulleted list" onClick={() => run('insertUnorderedList')}><List size={20} /></Tool>
        <Tool label="Indent" onClick={() => run('indent')}><Indent size={20} /></Tool>
        <Tool label="Outdent" onClick={() => run('outdent')}><Outdent size={20} /></Tool>
        <Tool label="Quote" onClick={() => run('formatBlock', 'blockquote')}><Quote size={20} /></Tool>
        <Tool label="Clear formatting" onClick={() => { run('removeFormat'); run('formatBlock', 'div'); }}><RemoveFormatting size={20} /></Tool>
        <Sep />
        <Tool label="Strikethrough" onClick={() => run('strikeThrough')}><Strikethrough size={20} /></Tool>
        <Tool label="Line spacing" onClick={() => { if (el.current) el.current.style.lineHeight = el.current.style.lineHeight === '2' ? '1.6' : '2'; }}>
          <ChevronsUpDown size={20} />
        </Tool>
      </div>

      <div
        ref={el}
        contentEditable
        role="textbox"
        aria-label="Email body"
        aria-multiline
        suppressContentEditableWarning
        onInput={sync}
        className="rich min-h-[380px] px-2 py-5 text-[17px] outline-none"
      />
    </div>
  );
});
RichTextEditor.displayName = 'RichTextEditor';
