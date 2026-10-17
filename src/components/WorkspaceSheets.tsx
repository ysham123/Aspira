import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, CircleAlert, FileCheck2, MessageCircle, Pause, X } from 'lucide-react';
import { MarkdownMessage } from './MarkdownMessage';
import './WorkspaceSheets.css';

import type { AttentionItem } from '../plugins/models/workspaceAttention';
export { deriveAttentionItems } from '../plugins/models/workspaceAttention';
export type { AttentionItem, AttentionConversation } from '../plugins/models/workspaceAttention';

const modalStack: symbol[] = [];
let previousBodyOverflow = '';
const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableChildren(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => element.getClientRects().length > 0);
}

function useSheetFocus(open: boolean, modal: boolean, panelRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const token = Symbol('workspace-sheet');
    if (modal) {
      if (modalStack.length === 0) {
        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }
      modalStack.push(token);
    }
    const isTop = () => modal ? modalStack.at(-1) === token : modalStack.length === 0;
    (focusableChildren(panel)[0] ?? panel).focus();
    const keydown = (event: KeyboardEvent) => {
      if (!isTop() || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (modal && event.key === 'Tab') {
        const elements = focusableChildren(panel);
        const first = elements[0] ?? panel;
        const last = elements.at(-1) ?? panel;
        if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const focusin = (event: FocusEvent) => {
      if (modal && isTop() && event.target instanceof Node && !panel.contains(event.target)) {
        (focusableChildren(panel)[0] ?? panel).focus();
      }
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
      const index = modalStack.indexOf(token);
      if (index !== -1) {
        modalStack.splice(index, 1);
        if (modalStack.length === 0) document.body.style.overflow = previousBodyOverflow;
      }
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, modal, panelRef]);
}

export interface AttentionDrawerProps {
  open: boolean;
  onClose: () => void;
  items: AttentionItem[];
  onSelect: (item: AttentionItem) => void;
  onDismiss?: (id: string) => void;
  disabled?: boolean;
}

export function AttentionDrawer({ open, onClose, items, onSelect, onDismiss, disabled = false }: AttentionDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const headingId = useId();
  useSheetFocus(open, true, panelRef, onClose);
  if (!open) return null;
  return createPortal(
    <div className="aspira-sheet-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="aspira-attention-drawer" role="dialog" aria-modal="true" aria-labelledby={headingId} ref={panelRef} tabIndex={-1}>
        <header className="aspira-sheet-header">
          <div><p className="aspira-sheet-eyebrow">Across your conversations</p><h2 id={headingId}>Needs you {items.length > 0 && <span className="aspira-sheet-count">{items.length}</span>}</h2></div>
          <button className="aspira-sheet-close" type="button" onClick={onClose} aria-label="Close needs you"><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="aspira-attention-content">
          {items.length === 0 ? <div className="aspira-attention-empty"><MessageCircle size={26} aria-hidden="true" /><h3>You’re all caught up</h3><p>Changes awaiting review and conversations that need attention will appear here.</p></div> : <ul className="aspira-attention-list">{items.map((item) => {
            const Icon = item.kind === 'review' ? FileCheck2 : item.kind === 'interrupted' ? Pause : CircleAlert;
            return <li key={item.id} className="aspira-attention-row"><button className="aspira-attention-item" type="button" disabled={disabled} title={disabled ? 'Wait for the current response before switching conversations.' : undefined} onClick={() => { if (disabled) return; onSelect(item); onClose(); }}><span className={`aspira-attention-icon is-${item.kind}`}><Icon size={19} aria-hidden="true" /></span><span className="aspira-attention-item-copy"><strong>{item.title}</strong><span>{item.detail}</span><span className="aspira-attention-open">Open conversation <ArrowUpRight size={13} aria-hidden="true" /></span></span></button>{item.kind !== 'review' && onDismiss && <button className="aspira-sheet-close aspira-attention-dismiss" type="button" onClick={() => { onDismiss(item.id); panelRef.current?.querySelector<HTMLButtonElement>('.aspira-sheet-close')?.focus(); }} aria-label={`Dismiss notice: ${item.title}`} title="Dismiss notice"><X size={16} aria-hidden="true" /></button>}</li>;
          })}</ul>}
        </div>
        <footer className="aspira-sheet-footer">{disabled ? 'You can switch conversations when the current response finishes.' : 'Based on recorded activity in your saved conversations.'}</footer>
      </section>
    </div>, document.body,
  );
}

export interface ResultPreviewProps {
  result: { title: string; content: string } | null;
  onClose: () => void;
}

export function ResultPreview({ result, onClose }: ResultPreviewProps) {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1440px)').matches);
  const panelRef = useRef<HTMLElement>(null);
  const headingId = useId();
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1440px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useSheetFocus(Boolean(result), !wide, panelRef, onClose);
  if (!result) return null;
  const panel = <section className={`aspira-result-preview${wide ? ' is-inline' : ''}`} role={wide ? 'region' : 'dialog'} aria-modal={wide ? undefined : true} aria-labelledby={headingId} ref={panelRef} tabIndex={-1}>
    <header className="aspira-sheet-header"><div><p className="aspira-sheet-eyebrow">From this conversation</p><h2 id={headingId}>{result.title}</h2></div><button className="aspira-sheet-close" type="button" onClick={onClose} aria-label="Close result preview"><X size={20} aria-hidden="true" /></button></header>
    <div className="aspira-result-preview-content"><MarkdownMessage content={result.content} /></div>
  </section>;
  if (wide) return panel;
  return createPortal(<div className="aspira-sheet-overlay aspira-result-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>{panel}</div>, document.body);
}
