#!/usr/bin/env node
// bootstrap.js — Remote loader
// User cuma butuh file ini File utama di-fetch dari GitHub

const https = require('https');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const Module = require('module');

const MANIFEST_URL = 'https://raw.githubusercontent.com/padlanfaitulrahman-droid/hama-ngapain/main/manifest.json';
const CACHE_DIR = path.join(os.homedir(), '.cache-my-tool');
const CACHE_TTL = 1000 * 60 * 60; // 1 jam doang

function fetchUrl(url, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'loader/1.0', 'Cache-Control': 'no-cache' }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        return fetchUrl(res.headers.location, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} → ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function cachePath(n) { return path.join(CACHE_DIR, n); }
function readCache(n, ttl = CACHE_TTL) {
  const p = cachePath(n);
  if (!fs.existsSync(p)) return null;
  if (Date.now() - fs.statSync(p).mtimeMs > ttl) return null;
  return fs.readFileSync(p);
}
function writeCache(n, buf) {
  ensureDir(CACHE_DIR);
  fs.writeFileSync(cachePath(n), buf);
}

const C = { reset:'\x1b[0m', cyan:'\x1b[36m', green:'\x1b[32m', red:'\x1b[31m', gray:'\x1b[90m' };
const log = {
  info: (m) => console.log(`${C.cyan}[•]${C.reset} ${m}`),
  ok:   (m) => console.log(`${C.green}[✓]${C.reset} ${m}`),
  err:  (m) => console.log(`${C.red}[✗]${C.reset} ${m}`),
  dim:  (m) => console.log(`${C.gray}    ${m}${C.reset}`),
};

function runCode(code, manifest) {
  const fakeFile = path.join(CACHE_DIR, 'main.js');
  const m = new Module(manifest.name || 'main', null);
  m.filename = fakeFile;
  m.paths = Module._nodeModulePaths(path.dirname(fakeFile));

  const wrapped = Module.wrap(code);
  const compiled = vm.runInThisContext(wrapped, { filename: m.filename });

  const dirname = path.dirname(fakeFile);
  compiled.call(m.exports, m.exports, m.require.bind(m), m, m.filename, dirname);

  return m.exports;
}

async function main() {
  console.log('');
  log.info('Memuat aplikasi...');

  let mBuf = readCache('manifest.json', 60 * 1000);
  if (!mBuf) {
    mBuf = await fetchUrl(MANIFEST_URL);
    writeCache('manifest.json', mBuf);
  }
  const manifest = JSON.parse(mBuf.toString('utf-8'));
  log.ok(`Versi: ${manifest.version}`);

  const cacheKey = `main-${manifest.hash || manifest.version}.js`;
  let code = readCache(cacheKey, 1000 * 60 * 60 * 24 * 7);

  if (!code) {
    log.info('Download file utama...');
    const raw = await fetchUrl(manifest.main);

    if (manifest.hash) {
      const actual = sha256(raw);
      if (actual !== manifest.hash) {
        throw new Error(
          `Hash mismatch!\n  expected: ${manifest.hash}\n  actual:   ${actual}`
        );
      }
      log.ok('Hash terverifikasi');
    }

    code = raw.toString('utf-8');
    writeCache(cacheKey, Buffer.from(code));
  } else {
    log.ok('Pakai cache');
  }

  log.info('Menjalankan...');
  console.log('');
  runCode(code, manifest);
}

main().catch((e) => {
  log.err(e.message);
  process.exit(1);
});