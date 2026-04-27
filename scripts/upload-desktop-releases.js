/**
 * WynAI Listen & Learn Desktop — Upload release artifacts to Cloudflare R2
 *
 * Stable R2 keys (no version in name → download links never change):
 *   desktop-ll/ListenLearn-mac-x64.dmg
 *   desktop-ll/ListenLearn-mac-arm64.dmg
 *
 * Also uploads updater artifacts and generates latest.json at:
 *   desktop-ll/latest.json
 *
 * Usage:
 *   node scripts/upload-desktop-releases.js
 */

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET = process.env.R2_BUCKET_NAME || 'wordai';
const PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://static.wynai.pro';
const ROOT = path.join(__dirname, '..');
const BUNDLE = path.join(ROOT, 'src-tauri', 'target', 'release', 'bundle');
const CONF_PATH = path.join(ROOT, 'src-tauri', 'tauri.conf.json');

if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.error('❌ R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY missing in .env.local');
    process.exit(1);
}

async function upload(filePath, r2Key, contentType) {
    const body = fs.readFileSync(filePath);
    const sha256 = crypto.createHash('sha256').update(body).digest('hex');
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: r2Key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'no-cache',
    }));
    const url = `${PUBLIC_URL}/${r2Key}`;
    console.log(`  ✅ Uploaded → ${url}`);
    if (filePath.endsWith('.exe') || filePath.endsWith('.msi')) {
        console.log(`     SHA256   → ${sha256}  ← paste this into MS Partner Center`);
    }
    return url;
}

async function uploadText(text, r2Key, contentType) {
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: r2Key,
        Body: Buffer.from(text),
        ContentType: contentType,
        CacheControl: 'no-cache',
    }));
    const url = `${PUBLIC_URL}/${r2Key}`;
    console.log(`  ✅ Manifest  → ${url}`);
    return url;
}

// Detect macOS arch
const MAC_ARCH = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
const MAC_PLATFORM = `darwin-${MAC_ARCH}`;
const MAC_DMG_KEY = MAC_ARCH === 'aarch64'
    ? 'desktop-ll/ListenLearn-mac-arm64.dmg'
    : 'desktop-ll/ListenLearn-mac-x64.dmg';
const MAC_UPDATE_KEY = MAC_ARCH === 'aarch64'
    ? 'desktop-ll/ListenLearn-mac-arm64-update.tar.gz'
    : 'desktop-ll/ListenLearn-mac-x64-update.tar.gz';

function findFile(subdir, extFilter) {
    const dir = path.join(BUNDLE, subdir);
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter(f => {
        if (!fs.statSync(path.join(dir, f)).isFile()) return false;
        if (extFilter && !f.toLowerCase().endsWith(extFilter.toLowerCase())) return false;
        return true;
    });
    return files.length > 0 ? path.join(dir, files[0]) : null;
}

async function fetchExistingManifest() {
    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: 'desktop-ll/latest.json' }));
        const body = await res.Body.transformToString();
        return JSON.parse(body);
    } catch {
        return { version: '0.0.0', notes: '', pub_date: '', platforms: {} };
    }
}

async function main() {
    const conf = JSON.parse(fs.readFileSync(CONF_PATH, 'utf8'));
    const version = conf.version;
    console.log(`\n📦 Uploading Listen & Learn v${version} (${MAC_ARCH === 'aarch64' ? 'Apple Silicon' : 'Intel x64'})\n`);

    // 1. Upload DMG
    const dmgPath = findFile('dmg', '.dmg');
    if (dmgPath) {
        console.log(`  DMG: ${path.basename(dmgPath)}`);
        await upload(dmgPath, MAC_DMG_KEY, 'application/x-apple-diskimage');
    } else {
        console.warn('  ⚠️  No DMG found, skipping');
    }

    // 2. Upload updater tar.gz + sig
    const tarGzPath = findFile('macos', '.tar.gz');
    const sigPath = tarGzPath ? tarGzPath + '.sig' : null;

    let signature = '';
    if (tarGzPath && fs.existsSync(tarGzPath)) {
        console.log(`  Update tar.gz: ${path.basename(tarGzPath)}`);
        await upload(tarGzPath, MAC_UPDATE_KEY, 'application/gzip');
    }
    if (sigPath && fs.existsSync(sigPath)) {
        signature = fs.readFileSync(sigPath, 'utf8').trim();
        console.log(`  Signature: ${signature.substring(0, 40)}...`);
    }

    // 3. Merge into latest.json
    const existing = await fetchExistingManifest();
    existing.version = version;
    existing.notes = `WynAI Listen & Learn ${version}`;
    existing.pub_date = new Date().toISOString();
    if (!existing.platforms) existing.platforms = {};

    if (tarGzPath) {
        existing.platforms[MAC_PLATFORM] = {
            signature,
            url: `${PUBLIC_URL}/${MAC_UPDATE_KEY}`,
        };
    }

    const manifest = JSON.stringify(existing, null, 2);
    await uploadText(manifest, 'desktop-ll/latest.json', 'application/json');

    console.log(`\n✅ Done! v${version} uploaded to R2 (desktop-ll/)\n`);
    console.log('  Download URL:');
    console.log(`    ${PUBLIC_URL}/${MAC_DMG_KEY}`);
    console.log('  Updater manifest:');
    console.log(`    ${PUBLIC_URL}/desktop-ll/latest.json`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
