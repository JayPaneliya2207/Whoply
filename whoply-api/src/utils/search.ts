/**
 * A case-insensitive "contains" match for text a user typed into a search box.
 * The text is escaped, so characters like ( * + [ are searched for literally —
 * raw input as a regex could fail (400s) or build a pattern slow enough to
 * stall the database. Capped at 60 characters.
 */
export const containsText = (q: unknown) => ({
    $regex: String(q ?? '').trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    $options: 'i',
});
