/**
 * A QR code for a short text (the link an authenticator app scans), made here
 * so the admin panel needs no extra package. Byte mode, error correction "M",
 * versions 1–9 — up to 180 characters, plenty for an otpauth:// link.
 *
 * Follows the QR Code standard (ISO/IEC 18004); the steps are the ones in
 * Project Nayuki's reference generator.
 */

/** Error-correction bytes per block, and blocks, at level M for versions 1–9. */
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5];
const MAX_VERSION = 9;

/** Data + error-correction bits that fit in a version, after the fixed patterns. */
function rawBits(version: number): number {
    let bits = (16 * version + 128) * version + 64;
    if (version >= 2) {
        const align = Math.floor(version / 7) + 2;
        bits -= (25 * align - 10) * align - 55;
        if (version >= 7) bits -= 36;
    }
    return bits;
}
const dataBytes = (version: number) => Math.floor(rawBits(version) / 8) - ECC_PER_BLOCK[version] * BLOCKS[version];

// Reed–Solomon over GF(2^8) / 0x11D
function mul(x: number, y: number): number {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}
function divisor(degree: number): number[] {
    const out = Array<number>(degree).fill(0);
    out[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            out[j] = mul(out[j], root);
            if (j + 1 < degree) out[j] ^= out[j + 1];
        }
        root = mul(root, 2);
    }
    return out;
}
function remainder(data: number[], div: number[]): number[] {
    const out = div.map(() => 0);
    for (const b of data) {
        const factor = b ^ (out.shift() as number);
        out.push(0);
        div.forEach((coef, i) => (out[i] ^= mul(coef, factor)));
    }
    return out;
}

/** Split the data into blocks, add each block's error correction, and weave the blocks together. */
function withErrorCorrection(data: number[], version: number): number[] {
    const blocks = BLOCKS[version];
    const eccLen = ECC_PER_BLOCK[version];
    const total = Math.floor(rawBits(version) / 8);
    const shortBlocks = blocks - (total % blocks);
    const shortLen = Math.floor(total / blocks);
    const div = divisor(eccLen);
    const parts: number[][] = [];
    for (let i = 0, at = 0; i < blocks; i++) {
        const part = data.slice(at, at + shortLen - eccLen + (i < shortBlocks ? 0 : 1));
        at += part.length;
        const ecc = remainder(part, div);
        if (i < shortBlocks) part.push(0);
        parts.push(part.concat(ecc));
    }
    const out: number[] = [];
    for (let i = 0; i < parts[0].length; i++) {
        parts.forEach((part, j) => {
            if (i !== shortLen - eccLen || j >= shortBlocks) out.push(part[i]);
        });
    }
    return out;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
    (x, y) => (x + y) % 2 === 0,
    (_x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/**
 * The QR code for `text` as rows of dark (true) and light (false) squares.
 * `forceMask` is for tests; left out, the mask that scans best is picked.
 */
export function qrMatrix(text: string, forceMask?: number): boolean[][] {
    const bytes = Array.from(new TextEncoder().encode(text));
    let version = 1;
    while (version <= MAX_VERSION && bytes.length > dataBytes(version) - 2) version++;
    if (version > MAX_VERSION) throw new Error('Too long for a QR code here');
    const size = version * 4 + 17;
    const capacity = dataBytes(version) * 8;

    // The data: "bytes follow", how many, the bytes, then padding to fill the version
    const bits: number[] = [];
    const put = (value: number, length: number) => {
        for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    };
    put(4, 4);
    put(bytes.length, 8);
    bytes.forEach((b) => put(b, 8));
    put(0, Math.min(4, capacity - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data: number[] = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((v, bit) => (v << 1) | bit, 0));
    const codewords = withErrorCorrection(data, version);

    const dark: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
    const fixed: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
    const set = (x: number, y: number, on: boolean) => {
        dark[y][x] = on;
        fixed[y][x] = true;
    };
    const bit = (value: number, i: number) => ((value >>> i) & 1) !== 0;

    // Timing lines, the three corner squares, the small alignment squares
    for (let i = 0; i < size; i++) {
        set(6, i, i % 2 === 0);
        set(i, 6, i % 2 === 0);
    }
    const finder = (cx: number, cy: number) => {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const dist = Math.max(Math.abs(dx), Math.abs(dy));
                const x = cx + dx;
                const y = cy + dy;
                if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
            }
        }
    };
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);
    const align: number[] = [];
    if (version > 1) {
        const count = Math.floor(version / 7) + 2;
        const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
        align.push(6);
        for (let pos = size - 7; align.length < count; pos -= step) align.splice(1, 0, pos);
    }
    align.forEach((cx, i) =>
        align.forEach((cy, j) => {
            const last = align.length - 1;
            if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return; // a corner square is there
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        })
    );

    /** The 15 format bits (error-correction level M = 0, and the mask), written twice. */
    const drawFormat = (mask: number) => {
        const value = mask; // (level M: 0) << 3 | mask
        let rem = value;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const format = ((value << 10) | rem) ^ 0x5412;
        for (let i = 0; i <= 5; i++) set(8, i, bit(format, i));
        set(8, 7, bit(format, 6));
        set(8, 8, bit(format, 7));
        set(7, 8, bit(format, 8));
        for (let i = 9; i < 15; i++) set(14 - i, 8, bit(format, i));
        for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(format, i));
        for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(format, i));
        set(8, size - 8, true);
    };
    drawFormat(0);
    if (version >= 7) {
        let rem = version;
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
        const info = (version << 12) | rem;
        for (let i = 0; i < 18; i++) {
            const a = size - 11 + (i % 3);
            const b = Math.floor(i / 3);
            set(a, b, bit(info, i));
            set(b, a, bit(info, i));
        }
    }

    // The codewords, in the zigzag from the bottom-right corner
    let at = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j;
                const upward = ((right + 1) & 2) === 0;
                const y = upward ? size - 1 - vert : vert;
                if (!fixed[y][x] && at < codewords.length * 8) {
                    dark[y][x] = bit(codewords[at >>> 3], 7 - (at & 7));
                    at++;
                }
            }
        }
    }

    const applyMask = (mask: number) => {
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[mask](x, y)) dark[y][x] = !dark[y][x];
    };

    /** How hard the picture is to scan (the standard's four rules) — lower is better. */
    const penalty = (): number => {
        let score = 0;
        const addRun = (run: number, history: number[]) => {
            if (history[0] === 0) run += size; // the light border before the first run
            history.pop();
            history.unshift(run);
        };
        const finderLike = (h: number[]): number => {
            const n = h[1];
            const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
            return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0);
        };
        const line = (get: (i: number) => boolean) => {
            let color = false;
            let run = 0;
            const history = [0, 0, 0, 0, 0, 0, 0];
            for (let i = 0; i < size; i++) {
                if (get(i) === color) {
                    run++;
                    if (run === 5) score += 3;
                    else if (run > 5) score++;
                } else {
                    addRun(run, history);
                    if (!color) score += finderLike(history) * 40;
                    color = get(i);
                    run = 1;
                }
            }
            if (color) {
                addRun(run, history);
                run = 0;
            }
            addRun(run + size, history);
            score += finderLike(history) * 40;
        };
        for (let y = 0; y < size; y++) line((x) => dark[y][x]);
        for (let x = 0; x < size; x++) line((y) => dark[y][x]);
        for (let y = 0; y < size - 1; y++) {
            for (let x = 0; x < size - 1; x++) {
                const c = dark[y][x];
                if (c === dark[y][x + 1] && c === dark[y + 1][x] && c === dark[y + 1][x + 1]) score += 3;
            }
        }
        const darkCount = dark.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
        const total = size * size;
        score += (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * 10;
        return score;
    };

    let mask = forceMask ?? -1;
    if (mask < 0) {
        let best = Infinity;
        for (let m = 0; m < 8; m++) {
            applyMask(m);
            drawFormat(m);
            const score = penalty();
            if (score < best) {
                best = score;
                mask = m;
            }
            applyMask(m); // the same mask again takes it off
        }
    }
    applyMask(mask);
    drawFormat(mask);
    return dark;
}

/** The squares as one SVG path (`M x y h 1 v 1 h -1 z` per dark square), with a light border of `border` squares. */
export function qrPath(matrix: boolean[][], border = 4): { path: string; size: number } {
    const parts: string[] = [];
    matrix.forEach((row, y) => row.forEach((on, x) => on && parts.push(`M${x + border},${y + border}h1v1h-1z`)));
    return { path: parts.join(''), size: matrix.length + border * 2 };
}
