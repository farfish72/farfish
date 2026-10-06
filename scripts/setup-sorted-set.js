/**
 * Setup Redis Sorted Set for Leaderboard
 * - Restores backup data
 * - Fixes wrong refcounts
 * - Creates sorted set for atomic ranking
 */

const fs = require('fs');
const path = require('path');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  process.exit(1);
}

const baseUrl = UPSTASH_URL.endsWith('/') ? UPSTASH_URL.slice(0, -1) : UPSTASH_URL;

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
    throw new Error(`Upstash request failed (${res.status}): ${text}`);
  }
  
  const data = await res.json();
  return data.result;
}

async function setKey(key, value) {
  const encoded = encodeURIComponent(typeof value === 'string' ? value : JSON.stringify(value));
  return await upstashRequest(`set/${encodeURIComponent(key)}/${encoded}`, { method: 'POST' });
}

async function deleteKey(key) {
  return await upstashRequest(`del/${encodeURIComponent(key)}`, { method: 'POST' });
}

// Calculate actual refcounts from referral data
function calculateActualRefcounts(referrals) {
  const refcounts = {};
  
  for (const [referredWallet, referrerData] of Object.entries(referrals)) {
    // Skip invalid entries
    if (!referredWallet.match(/^0x[a-fA-F0-9]{40}$/i)) {
      console.log(`⚠️  Skipping invalid referred wallet: ${referredWallet}`);
      continue;
    }
    
    let referrer;
    
    // Extract referrer from data
    if (typeof referrerData === 'string') {
      if (referrerData.startsWith('{')) {
        try {
          // Handle escaped JSON
          const cleaned = referrerData.replace(/\\\\/g, '');
          const parsed = JSON.parse(cleaned);
          referrer = parsed.referrer;
        } catch (e) {
          // Try without escapes
          try {
            const parsed = JSON.parse(referrerData);
            referrer = parsed.referrer;
          } catch {
            // Plain string wallet
            referrer = referrerData;
          }
        }
      } else {
        referrer = referrerData;
      }
    }
    
    // Validate referrer
    if (!referrer || !referrer.match(/^0x[a-fA-F0-9]{40}$/i)) {
      console.log(`⚠️  Invalid referrer for ${referredWallet}: ${referrer}`);
      continue;
    }
    
    referrer = referrer.toLowerCase();
    refcounts[referrer] = (refcounts[referrer] || 0) + 1;
  }
  
  return refcounts;
}

async function main() {
  console.log('🚀 Starting Redis Sorted Set Setup...\n');
  
  // Load backup
  const snapshotPath = path.join(__dirname, '..', '.agents', 'tasks', 'redis-snapshot.json');
  if (!fs.existsSync(snapshotPath)) {
    console.error('❌ Backup file not found:', snapshotPath);
    process.exit(1);
  }
  
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  console.log('✅ Loaded backup from:', snapshot.timestamp);
  console.log(`   - ${snapshot.summary.total_referral_keys} referral keys`);
  console.log(`   - ${snapshot.summary.total_refcode_keys} refcode keys`);
  console.log(`   - ${snapshot.summary.total_refcount_keys} refcount keys\n`);
  
  // Step 1: Delete bad data
  console.log('🗑️  Step 1: Cleaning bad data...');
  const badKeys = [
    'referral:0xREFERRER_WALLET:0xREFERRED_WALLET',
    'referral:0x1234567890123456789012345678901234567890'
  ];
  
  for (const key of badKeys) {
    if (snapshot.referrals[key.replace('referral:', '')]) {
      await deleteKey(key);
      console.log(`   ✓ Deleted: ${key}`);
    }
  }
  
  // Step 2: Calculate correct refcounts
  console.log('\n📊 Step 2: Calculating correct refcounts...');
  const correctRefcounts = calculateActualRefcounts(snapshot.referrals);
  console.log(`   Found ${Object.keys(correctRefcounts).length} users with actual referrals:`);
  
  for (const [wallet, count] of Object.entries(correctRefcounts)) {
    const oldCount = snapshot.refcounts[wallet] || 0;
    const status = oldCount === count ? '✓' : '⚠️ ';
    console.log(`   ${status} ${wallet.slice(0, 10)}...${wallet.slice(-6)}: ${count} referrals ${oldCount !== count ? `(was ${oldCount})` : ''}`);
  }
  
  // Step 3: Update refcounts in Redis
  console.log('\n🔧 Step 3: Updating refcounts...');
  for (const [wallet, count] of Object.entries(correctRefcounts)) {
    await setKey(`refcount:${wallet}`, count.toString());
    console.log(`   ✓ SET refcount:${wallet.slice(0, 10)}...${wallet.slice(-6)} = ${count}`);
  }
  
  // Step 4: Collect all unique users
  console.log('\n👥 Step 4: Collecting all unique users...');
  const allUsers = new Set();
  
  // Add referred users
  for (const wallet of Object.keys(snapshot.referrals)) {
    if (wallet.match(/^0x[a-fA-F0-9]{40}$/i)) {
      allUsers.add(wallet.toLowerCase());
    }
  }
  
  // Add referrers
  for (const wallet of Object.keys(correctRefcounts)) {
    allUsers.add(wallet);
  }
  
  // Add refcode owners
  for (const wallet of Object.values(snapshot.refcodes)) {
    if (wallet && wallet.match(/^0x[a-fA-F0-9]{40}$/i)) {
      allUsers.add(wallet.toLowerCase());
    }
  }
  
  console.log(`   Found ${allUsers.size} unique users total`);
  
  // Step 5: Create sorted set
  console.log('\n🎯 Step 5: Creating leaderboard sorted set...');
  let addedCount = 0;
  
  for (const wallet of allUsers) {
    const score = correctRefcounts[wallet] || 0;
    
    // ZADD leaderboard {score} {wallet}
    await upstashRequest(`zadd/leaderboard/${score}/${encodeURIComponent(wallet)}`, {
      method: 'POST'
    });
    
    addedCount++;
    if (addedCount % 10 === 0) {
      console.log(`   Progress: ${addedCount}/${allUsers.size} users added...`);
    }
  }
  
  console.log(`   ✅ Added all ${allUsers.size} users to sorted set`);
  
  // Step 6: Verify top 10
  console.log('\n🏆 Step 6: Verifying top 10 leaderboard...');
  const top10 = await upstashRequest('zrevrange/leaderboard/0/9/WITHSCORES');
  
  console.log('   Top 10:');
  for (let i = 0; i < top10.length; i += 2) {
    const wallet = top10[i];
    const score = top10[i + 1];
    const rank = Math.floor(i / 2) + 1;
    console.log(`   #${rank}: ${wallet.slice(0, 10)}...${wallet.slice(-6)} - ${score} referrals`);
  }
  
  console.log('\n✅ Redis Sorted Set Setup Complete!');
  console.log('\n📋 Summary:');
  console.log(`   ✓ Cleaned bad data`);
  console.log(`   ✓ Fixed ${Object.keys(correctRefcounts).length} refcounts`);
  console.log(`   ✓ Created sorted set with ${allUsers.size} users`);
  console.log(`   ✓ Leaderboard ready for atomic queries`);
  console.log('\n💾 Next: Update code to use sorted set (ZREVRANGE)');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
