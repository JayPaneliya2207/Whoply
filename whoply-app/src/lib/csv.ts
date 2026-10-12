/**
 * Reading an item list that was saved from Excel (or exported by another
 * billing program) as CSV: decode the file, split it into cells, and work out
 * which column is which from its heading.
 */

/** File bytes → text. Excel's "CSV UTF-8" and "Unicode Text" are read as they are; an older plain CSV falls back to Windows text. */
export function decodeText(buf: ArrayBuffer): string {
    const b = new Uint8Array(buf);
    if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
    if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
        return new TextDecoder('windows-1252').decode(buf);
    }
}

/** CSV text → rows of cells. Commas, semicolons or tabs; quoted cells may hold the separator, quotes ("") and line breaks. Empty lines are dropped. */
export function parseCsv(input: string): string[][] {
    const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
    const head = text.split(/\r?\n/, 1)[0] || '';
    const sep = [',', ';', '\t'].map((d) => [d, head.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    const endRow = () => {
        row.push(cell);
        cell = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
    };
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch !== '"') cell += ch;
            else if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
        } else if (ch === '"' && cell.trim() === '') { cell = ''; quoted = true; }
        else if (ch === sep) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; endRow(); }
        else cell += ch;
    }
    endRow();
    return rows;
}

/** The item fields the import understands, and the headings people use for them (compared without capitals, spaces or signs). */
const HEADINGS = {
    name: ['name', 'item', 'itemname', 'product', 'productname', 'description', 'particulars'],
    sku: ['sku', 'code', 'itemcode', 'productcode'],
    barcode: ['barcode', 'ean', 'upc'],
    category: ['category', 'group', 'department', 'dept'],
    unit: ['unit', 'units', 'uom'],
    hsn: ['hsn', 'hsncode', 'hsnsac'],
    costPrice: ['cost', 'costprice', 'purchaseprice', 'purchaserate', 'buyprice', 'buyingprice'],
    sellPrice: ['price', 'sellprice', 'sellingprice', 'saleprice', 'salesprice', 'salerate', 'salesrate', 'mrp', 'rate'],
    wholesalePrice: ['wholesale', 'wholesaleprice', 'wholesalerate'],
    gstRate: ['gst', 'gstrate', 'gstpercent', 'tax', 'taxrate', 'taxpercent'],
    stock: ['stock', 'qty', 'quantity', 'openingstock', 'currentstock', 'stockqty'],
    lowStock: ['lowstock', 'lowstockalert', 'minstock', 'minimumstock', 'reorderlevel'],
} as const;
export type ItemField = keyof typeof HEADINGS;
export type ItemRow = Partial<Record<ItemField, string>>;

const plain = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Cells → item rows. The first row is the headings. Returns the rows (each
 * with the file line it came from), the headings that matched nothing, and
 * whether the two needed columns — a name and a selling price — were found.
 */
export function toItemRows(cells: string[][]): { rows: (ItemRow & { line: number })[]; unused: string[]; ok: boolean } {
    const [head = [], ...body] = cells;
    const col: Partial<Record<ItemField, number>> = {};
    const unused: string[] = [];
    head.forEach((h, i) => {
        const field = (Object.keys(HEADINGS) as ItemField[]).find((f) => (HEADINGS[f] as readonly string[]).includes(plain(h)));
        if (field && col[field] === undefined) col[field] = i;
        else if (h.trim()) unused.push(h.trim());
    });
    const rows = body.map((r, i) => {
        const out: ItemRow & { line: number } = { line: i + 2 };
        for (const [field, at] of Object.entries(col) as [ItemField, number][]) out[field] = (r[at] ?? '').trim();
        return out;
    });
    return { rows, unused, ok: col.name !== undefined && col.sellPrice !== undefined };
}

/** A small file to start from: the headings and two example lines. */
export const SAMPLE_CSV = [
    'Name,Code,Barcode,Category,Unit,HSN,Cost price,Selling price,GST %,Stock,Low stock alert',
    'Basmati Rice 5kg,RICE-5,8901234567890,Grocery,bag,1006,400,460,5,25,5',
    'Tata Salt 1kg,,8901234567906,Grocery,pcs,2501,22,28,0,120,20',
].join('\n');
