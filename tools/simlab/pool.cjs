"use strict";
const os = require("os");
const path = require("path");
const { Worker } = require("worker_threads");

/**
 * A worker per core, each running whole histories.
 *
 * The engine is branchy sequential math on typed arrays — flood fills,
 * union-find, priority-flood — so there is nothing here a GPU would accelerate.
 * Cores are the resource that matters, and one history per worker keeps them
 * saturated without any shared state to coordinate.
 */
function runPool(jobs, engineDir, { workers, onResult } = {}) {
  const n = Math.max(1, Math.min(workers || os.cpus().length, jobs.length));
  return new Promise((resolve, reject) => {
    const results = [];
    let next = 0, done = 0, failed = 0;
    const pool = [];

    const dispatch = (w) => {
      if (next >= jobs.length) { w.terminate(); return; }
      w.postMessage(jobs[next++]);
    };

    for (let i = 0; i < n; i++) {
      const w = new Worker(path.join(__dirname, "worker.cjs"), {
        workerData: { engineDir },
      });
      w.on("message", (msg) => {
        done++;
        if (!msg.ok) failed++;
        results.push(msg);
        if (onResult) onResult(msg, done, jobs.length);
        dispatch(w);
      });
      w.on("error", (e) => { failed++; done++; reject(e); });
      w.on("exit", () => {
        pool.splice(pool.indexOf(w), 1);
        if (pool.length === 0) resolve({ results, failed });
      });
      pool.push(w);
      dispatch(w);
    }
  });
}

module.exports = { runPool, cpuCount: () => os.cpus().length };
