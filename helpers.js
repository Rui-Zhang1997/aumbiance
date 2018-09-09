const resolveCallback = (cb) => (cb === undefined || cb === null) ? () => void(0) : cb;

exports.resolveCallback = resolveCallback;
