function formatDoc(doc) {
    if (!doc) return null;
    if (Array.isArray(doc)) return doc.map(formatDoc);

    const obj = doc.toObject ? doc.toObject() : { ...doc };

    if (obj._id) {
        obj.id = obj._id.toString();
        delete obj._id;
    }

    ['user_id', 'subscription_id'].forEach((field) => {
        if (obj[field] && typeof obj[field] === 'object' && obj[field]._id) {
            obj[field] = obj[field]._id.toString();
        } else if (obj[field]) {
            obj[field] = obj[field].toString();
        }
    });

    delete obj.__v;
    delete obj.password;
    return obj;
}

module.exports = formatDoc;
