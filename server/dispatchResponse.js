// JSON remains available to older clients; the workspace requests line-delimited
// events so action receipts can arrive before the provider's final answer.
export function createDispatchResponse(req, res) {
  const streaming = String(req.headers.accept || '').split(',')
    .some((value) => value.trim().split(';')[0] === 'application/x-ndjson');

  const emit = (event) => {
    if (!streaming || res.writableEnded || res.destroyed) return;
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
    }
    res.write(`${JSON.stringify(event)}\n`);
  };

  return {
    emit,
    complete(status, data) {
      if (res.writableEnded || res.destroyed) return;
      if (streaming) {
        if (!res.headersSent) res.statusCode = status;
        emit({ type: 'result', status, data });
        res.end();
      } else {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(data));
      }
    },
  };
}
