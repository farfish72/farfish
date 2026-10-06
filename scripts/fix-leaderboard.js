/**
 * Fix Leaderboard - Remove 'value' entry and recreate sorted set
 */

const fs = require('fs');
const path = require('path');

// Load .env.local (handle multiline values)
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  let currentKey = null;
  let currentValue = '';
  
  for (let line of lines) {
    line = line.trim();
    
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) continue;
    
    // New key=value pair
    if (line.includes('=')) {
      // Save previous key if exists
      if (currentKey) {
        process.env[currentKey] = currentValue.replace(/^["']|["']$/g, '');
      }
      
      const [key, ...valueParts] = line.split('=');
      currentKey = key;
      currentValue = valueParts.join('=');
    } else if (currentKey) {
      // Continuation of previous value
      currentValue += line;
    }
  }
  
  // Save last key
  if (currentKey) {
    process.env[currentKey] = currentValue.replace(/^["']|["']$/g, '');
  }
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  console.error('   Make sure .env.local exists with these variables');
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

async function main() {
  console.log('🔧 Fixing leaderboard sorted set...\n');
  
  // Step 1: Get current sorted set
  console.log('📊 Current sorted set:');
  const allEntries = await upstashRequest('zrevrange/leaderboard/0/-1/WITHSCORES');
  
  console.log(`   Found ${allEntries.length / 2} entries`);
  
  // Find invalid entries
  const invalidEntries = [];
  for (let i = 0; i < allEntries.length; i += 2) {
    const wallet = allEntries[i];
    const score = allEntries[i + 1];
    
    if (!wallet.match(/^0x[a-fA-F0-9]{40}$/i)) {
      console.log(`   ⚠️  Invalid entry: "${wallet}" with score ${score}`);
      invalidEntries.push(wallet);
    }
  }
  
  if (invalidEntries.length === 0) {
    console.log('   ✅ No invalid entries found!');
    return;
  }
  
  // Step 2: Remove invalid entries
  console.log(`\n🗑️  Removing ${invalidEntries.length} invalid entries...`);
  for (const wallet of invalidEntries) {
    await upstashRequest(`zrem/leaderboard/${encodeURIComponent(wallet)}`, {
      method: 'POST'
    });
    console.log(`   ✓ Removed: "${wallet}"`);
  }
  
  // Step 3: Verify top 10
  console.log('\n🏆 Verifying top 10 after cleanup:');
  const top10 = await upstashRequest('zrevrange/leaderboard/0/9/WITHSCORES');
  
  for (let i = 0; i < top10.length; i += 2) {
    const wallet = top10[i];
    const score = top10[i + 1];
    const rank = Math.floor(i / 2) + 1;
    console.log(`   #${rank}: ${wallet.slice(0, 10)}...${wallet.slice(-6)} - ${score} referrals`);
  }
  
  // Get total count
  const totalCount = await upstashRequest('zcard/leaderboard');
  console.log(`\n✅ Leaderboard fixed! Total users: ${totalCount}`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
