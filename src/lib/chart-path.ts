/**
 * Build a smooth cubic-bezier SVG path through the given points so a data line
 * reads as gentle waves instead of sharp zig-zags. Returns '' for fewer than 2
 * points. Callers should pass only real data points (skip empty months) so the
 * line never plunges to the baseline between gaps.
 */
export function smoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return ''
    return pts.reduce((acc, p, i, arr) => {
        if (i === 0) return `M ${p.x},${p.y}`
        const prev = arr[i - 1]
        const dx = p.x - prev.x
        return `${acc} C ${prev.x + dx / 2},${prev.y} ${p.x - dx / 2},${p.y} ${p.x},${p.y}`
    }, '')
}
