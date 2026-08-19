/**
 * Lightweight, zero-dependency concurrency limiter for async functions.
 * @param {number} concurrency - Maximum number of concurrent async tasks
 * @returns {Function} Function wrapper to limit concurrency
 */
export function pLimit(concurrency) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError("Expected `concurrency` to be an integer greater than 0");
  }

  const queue = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      const task = queue.shift();
      task();
    }
  };

  const run = async (fn, resolve, reject, args) => {
    activeCount++;
    try {
      const result = await fn(...args);
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      next();
    }
  };

  const enqueue = (fn, resolve, reject, args) => {
    queue.push(run.bind(null, fn, resolve, reject, args));
    if (activeCount < concurrency && queue.length > 0) {
      const task = queue.shift();
      task();
    }
  };

  const generator = (fn, ...args) =>
    new Promise((resolve, reject) => {
      enqueue(fn, resolve, reject, args);
    });

  Object.defineProperties(generator, {
    activeCount: {
      get: () => activeCount,
    },
    pendingCount: {
      get: () => queue.length,
    },
    clearQueue: {
      value: () => {
        queue.length = 0;
      },
    },
  });

  return generator;
}
