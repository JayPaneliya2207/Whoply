'use client';
import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { api, apiErr } from '@/lib/api';
import { downloadFile } from '@/lib/bill';
import { decodeText, parseCsv, toItemRows, SAMPLE_CSV, type ItemRow } from '@/lib/csv';
import { Modal } from '@/components/Modal';
import { useT } from '@/i18n';

/** Rows per request — the API takes at most this many (IMPORT_MAX_ROWS). */
const CHUNK = 500;
/** How many problem lines to list before "and N more". */
const SHOWN = 40;

interface Issue { line: number; name: string; reason: string; why?: string; what?: string }
interface Result { ready: number; created: number; skipped: Issue[]; errors: Issue[]; newCategories: string[] }
type Stage = 'pick' | 'checking' | 'checked' | 'adding' | 'done';

/**
 * Add many items at once from a CSV file (an Excel list saved as "CSV UTF-8").
 * The file is read here, checked by the API without saving anything, and only
 * after the shopkeeper has seen "N ready, N already there, N with a problem"
 * are the good rows added. It only adds: items already in the list are left
 * exactly as they are.
 */
export function ProductImport({ open, onClose, base, onDone }: { open: boolean; onClose: () => void; base: string; onDone: () => void }) {
    const t = useT();
    const input = useRef<HTMLInputElement>(null);
    const [stage, setStage] = useState<Stage>('pick');
    const [rows, setRows] = useState<(ItemRow & { line: number })[]>([]);
    const [unused, setUnused] = useState<string[]>([]);
    const [result, setResult] = useState<Result | null>(null);
    const [progress, setProgress] = useState(0);
    const [err, setErr] = useState('');
    const n = (key: string, count: number) => t(key).replace('{n}', String(count));

    const reset = () => { setStage('pick'); setRows([]); setUnused([]); setResult(null); setProgress(0); setErr(''); };
    const close = () => { if (stage === 'checking' || stage === 'adding') return; const added = stage === 'done'; reset(); onClose(); if (added) onDone(); };

    /** Send the rows in pieces; `check` asks what would happen without saving. Lines are the file's own line numbers. */
    const send = async (all: (ItemRow & { line: number })[], check: boolean): Promise<Result> => {
        const total: Result = { ready: 0, created: 0, skipped: [], errors: [], newCategories: [] };
        for (let at = 0; at < all.length; at += CHUNK) {
            const part = all.slice(at, at + CHUNK);
            const { data } = await api.post(`${base}/products/import`, { rows: part.map(({ line: _line, ...r }) => r), check });
            const d = data.data;
            const lineOf = (x: any): Issue => ({ line: part[x.row - 1]?.line ?? 0, name: x.name, reason: x.reason, why: x.why, what: x.what });
            total.ready += d.ready;
            total.created += d.created;
            total.skipped.push(...d.skipped.map(lineOf));
            total.errors.push(...d.errors.map(lineOf));
            for (const c of d.newCategories) if (!total.newCategories.includes(c)) total.newCategories.push(c);
            setProgress(Math.min(all.length, at + CHUNK));
        }
        return total;
    };

    const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setErr(''); setResult(null); setProgress(0);
        try {
            const parsed = toItemRows(parseCsv(decodeText(await file.arrayBuffer())));
            if (!parsed.ok) { setErr(t('importNeedCols')); return; }
            if (!parsed.rows.length) { setErr(t('importBadFile')); return; }
            setRows(parsed.rows); setUnused(parsed.unused); setStage('checking');
            setResult(await send(parsed.rows, true));
            setStage('checked');
        } catch (x) {
            setErr(apiErr(x) || t('importBadFile'));
            setStage('pick');
        }
    };

    const add = async () => {
        setStage('adding'); setErr(''); setProgress(0);
        try {
            setResult(await send(rows, false));
            setStage('done');
        } catch (x) {
            // Some pieces may already be in: checking again shows what is left, and a second try never doubles an item.
            setErr(apiErr(x));
            setStage('checked');
        }
    };

    /** The reason in the app's language (the API sends a code for each one); its English text if the code is new to this app. */
    const why = (x: Issue) => {
        const key = `importWhy_${x.why}`;
        const said = x.why ? t(key) : key;
        return said === key ? x.reason : said.replace('{what}', x.what || '');
    };
    const issues = (title: string, list: Issue[], tone: string) => !!list.length && (
        <div className="mt-3">
            <p className="text-sm font-semibold" style={{ color: tone }}>{title} · {list.length}</p>
            <ul className="mt-1.5 space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {list.slice(0, SHOWN).map((x, i) => <li key={i}><b className="tabular">{t('importLine')} {x.line}</b>{x.name ? ` · ${x.name}` : ''} — {why(x)}</li>)}
                {list.length > SHOWN && <li style={{ color: 'var(--text-muted)' }}>{n('importMore', list.length - SHOWN)}</li>}
            </ul>
        </div>
    );
    const busy = stage === 'checking' || stage === 'adding';

    return (
        <Modal open={open} onClose={close} title={t('importTitle')}
            footer={
                stage === 'checked' && result && result.ready > 0 ? <button className="wp-btn wp-btn-primary w-full" onClick={add}><Upload size={16} /> {n('importAdd', result.ready)}</button>
                    : stage === 'done' ? <button className="wp-btn wp-btn-primary w-full" onClick={close}>{t('close')}</button>
                        : undefined
            }>
            <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={pick} />

            {stage === 'pick' && (
                <>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('importIntro')}</p>
                    <p className="text-xs mt-2 rounded-xl p-3" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{t('importColumns')}</p>
                    <div className="flex flex-wrap gap-2 mt-4">
                        <button className="wp-btn wp-btn-primary" onClick={() => input.current?.click()}><FileSpreadsheet size={16} /> {t('importChoose')}</button>
                        <button className="wp-btn wp-btn-ghost" onClick={() => downloadFile('whoply-items-sample.csv', SAMPLE_CSV)}><Download size={16} /> {t('importSample')}</button>
                    </div>
                </>
            )}

            {busy && (
                <div className="py-8 text-center">
                    <Loader2 size={28} className="animate-spin mx-auto" style={{ color: 'var(--brand-text)' }} />
                    <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>{t(stage === 'checking' ? 'importChecking' : 'importAdding')}</p>
                    <p className="text-xs mt-1 tabular" style={{ color: 'var(--text-muted)' }}>{progress} / {rows.length}</p>
                </div>
            )}

            {(stage === 'checked' || stage === 'done') && result && (
                <>
                    {stage === 'done'
                        ? <p className="flex items-center gap-2 text-base font-bold" style={{ color: 'var(--success)' }}><CheckCircle2 size={20} /> {n('importDone', result.created)}</p>
                        : (
                            <div className="grid grid-cols-3 gap-2 text-center">
                                {([['importReady', result.ready, 'var(--success)'], ['importSkippedShort', result.skipped.length, 'var(--text-secondary)'], ['importProblemsShort', result.errors.length, result.errors.length ? 'var(--danger)' : 'var(--text-secondary)']] as const).map(([k, v, c]) => (
                                    <div key={k} className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
                                        <p className="text-2xl font-extrabold tabular leading-none" style={{ color: c }}>{v}</p>
                                        <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{t(k)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    {stage === 'checked' && result.ready === 0 && <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>{t('importNothing')}</p>}
                    {stage === 'checked' && result.newCategories.length > 0 && <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}><b>{t('importNewCats')}:</b> {result.newCategories.join(', ')}</p>}
                    {stage === 'checked' && unused.length > 0 && <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}><b>{t('importIgnored')}:</b> {unused.join(', ')}</p>}
                    {issues(t('importProblems'), result.errors, 'var(--danger)')}
                    {issues(t('importSkipped'), result.skipped, 'var(--text-secondary)')}
                    {stage === 'checked' && <button className="wp-btn wp-btn-ghost text-sm mt-4" onClick={() => { reset(); setTimeout(() => input.current?.click(), 0); }}><FileSpreadsheet size={15} /> {t('importAnother')}</button>}
                </>
            )}

            {err && <p className="flex items-start gap-2 text-sm mt-3" style={{ color: 'var(--danger)' }} role="alert"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> {err}</p>}
        </Modal>
    );
}
