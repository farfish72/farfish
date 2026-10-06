/**
 * Complete Setup Script
 * 
 * This script does everything needed to fix the refcode system:
 * 1. Creates refcode:* entries for all existing users
 * 2. Initializes them in the leaderboard (if not already there)
 * 3. Ensures the system is ready for future auto-init
 * 
 * Run this BEFORE running backfill-referee-rewards.js
 * 
 * Usage: node scripts/setup-all-users.js
 * Make sure .env.local exists with UPSTASH credentials
 */

const fs = require('fs');

// Load .env.local manually
const envPath = '.env.local';
console.log('Loading environment from:', envPath);

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  
  lines.forEach(line => {
    // Skip comments and empty lines
    line = line.trim();
    if (line.startsWith('#') || !line || !line.includes('=')) return;
    
    const eqIndex = line.indexOf('=');
    const key = line.substring(0, eqIndex).trim();
    let value = line.substring(eqIndex + 1).trim();
    
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }
    
    process.env[key] = value;
    
    if (key.includes('UPSTASH')) {
      console.log(`Loaded: ${key} = ${value.substring(0, 30)}...`);
    }
  });
} else {
  console.error('❌ .env.local file not found!');
  process.exit(1);
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

console.log('UPSTASH_URL:', UPSTASH_URL ? 'Found' : 'Missing');
console.log('UPSTASH_TOKEN:', UPSTASH_TOKEN ? 'Found' : 'Missing');
console.log('');

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  console.error('   Make sure .env.local exists with these variables');
  process.exit(1);
}

const baseUrl = UPSTASH_URL.endsWith("/") ? UPSTASH_URL.slice(0, -1) : UPSTASH_URL;

async function upstashRequest(path, options = {}) {
  const res = await fetch(`${baseUrl}/${path}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  
  const data = await res.json();
  return data.result;
}

async function main() {
  console.log('🔧 Setting Up All Users (Refcodes + Leaderboard)...\n');
  
  // Load Redis snapshot
  const snapshotPath = '.agents\\tasks\\redis-snapshot.json';
  console.log(`📥 Loading snapshot from: ${snapshotPath}`);
  
  if (!fs.existsSync(snapshotPath)) {
    console.error('❌ Snapshot file not found!');
    process.exit(1);
  }
  
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  console.log(`✅ Snapshot loaded (${snapshot.timestamp})\n`);
  
  // Collect all unique wallet addresses
  const allWallets = new Set();
  
  // 1. From referral:* keys (referred users)
  console.log('📥 Collecting wallets from referral:* keys...');
  const referrals = snapshot.referrals;
  Object.keys(referrals).forEach(key => {
    if (key.match(/^0x[a-fA-F0-9]{40}$/i)) {
      allWallets.add(key.toLowerCase());
    }
  });
  console.log(`   Found ${allWallets.size} referred users`);
  
  // 2. From referral:* values (referrers)
  console.log('📥 Collecting wallets from referral:* values (referrers)...');
  Object.values(referrals).forEach(value => {
    let referrer;
    try {
      if (typeof value === 'string' && value.startsWith('{')) {
        referrer = JSON.parse(value).referrer;
      } else {
        referrer = value;
      }
    } catch {
      referrer = value;
    }
    
    if (referrer && referrer.match && referrer.match(/^0x[a-fA-F0-9]{40}$/i)) {
      allWallets.add(referrer.toLowerCase());
    }
  });
  console.log(`   Total unique wallets: ${allWallets.size}`);
  
  // 3. From refcount:* keys
  console.log('📥 Collecting wallets from refcount:* keys...');
  const refcounts = snapshot.refcounts;
  Object.keys(refcounts).forEach(wallet => {
    if (wallet.match(/^0x[a-fA-F0-9]{40}$/i)) {
      allWallets.add(wallet.toLowerCase());
    }
  });
  console.log(`   Total unique wallets: ${allWallets.size}\n`);
  
  // Statistics
  let refcodesCreated = 0;
  let refcodesExisted = 0;
  let leaderboardAdded = 0;
  let errors = 0;
  
  console.log(`✨ Processing ${allWallets.size} wallets...\n`);
  
  for (const wallet of allWallets) {
    try {
      const refCode = wallet.slice(-8);
      
      // 1. Create refcode:* entry if doesn't exist
      const existingRefcode = await upstashRequest(`get/refcode:${refCode}`);
      
      if (!existingRefcode) {
        await upstashRequest(`set/refcode:${refCode}/${wallet}`, {
          method: 'POST'
        });
        console.log(`✅ Created refcode:${refCode} → ${wallet.slice(0, 10)}...${wallet.slice(-6)}`);
        refcodesCreated++;
      } else {
        console.log(`⏭️  Refcode:${refCode} already exists`);
        refcodesExisted++;
      }
      
      // 2. Add to leaderboard with score 0 if not exists (nx = only if not exists)
      await upstashRequest(`zadd/leaderboard/nx/0/${encodeURIComponent(wallet)}`, {
        method: 'POST'
      });
      leaderboardAdded++;
      
    } catch (error) {
      console.error(`❌ Error processing ${wallet.slice(0, 10)}...${wallet.slice(-6)}: ${error.message}`);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 SETUP SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Wallets Processed:    ${allWallets.size}`);
  console.log(`Refcodes Created:           ${refcodesCreated}`);
  console.log(`Refcodes Already Existed:   ${refcodesExisted}`);
  console.log(`Leaderboard Entries Added:  ${leaderboardAdded}`);
  console.log(`Errors:                     ${errors}`);
  console.log('='.repeat(80));
  console.log('\n✅ Setup complete!');
  console.log('\n📌 Next steps:');
  console.log('   1. Run: node scripts/backfill-referee-rewards.js');
  console.log('   2. Deploy the updated code to production');
  console.log('   3. Future users will auto-init when they connect wallet\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
