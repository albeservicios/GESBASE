// Helpers internos compartidos
export function stripMeta(doc) {
    if (!doc) return {};
    const { _id, _parent, _v, ...data } = doc;
    return data;
}
