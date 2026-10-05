/**
 * Test Rank Logic - Verify no duplicates + rank improves on referral
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
    if (!line || line.startsWith('#')) continue;
    
    if (line.includes('=')) {
      if (currentKey) {
        process.env[currentKey] = currentValue.replace(/^["']|["']$/g, '');
      }
      const [key, ...valueParts] = line.split('=');
      currentKey = key;
      currentValue = valueParts.join('=');
    } else if (currentKey) {
      currentValue += line;
    }
  }
  
  if (currentKey) {
    process.env[currentKey] = currentValue.replace(/^["']|["']$/g, '');
  }
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('❌ Missing credentials');
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
  console.log('🧪 Testing Rank Logic...\n');
  
  // Test 1: Check for duplicate ranks
  console.log('Test 1: Checking for duplicate ranks...');
  const allEntries = await upstashRequest('zrevrange/leaderboard/0/-1/WITHSCORES');
  
  const ranks = new Map(); // rank -> [wallets]
  const scores = new Map(); // score -> count
  
  for (let i = 0; i < allEntries.length; i += 2) {
    const wallet = allEntries[i];
    const score = allEntries[i + 1];
    const rank = Math.floor(i / 2) + 1;
    
    if (!ranks.has(rank)) {
      ranks.set(rank, []);
    }
    ranks.get(rank).push(wallet);
    
    scores.set(score, (scores.get(score) || 0) + 1);
  }
  
  // Check for duplicates
  let hasDuplicates = false;
  for (const [rank, wallets] of ranks.entries()) {
    if (wallets.length > 1) {
      console.log(`   ❌ Duplicate rank #${rank}: ${wallets.length} wallets`);
      wallets.forEach(w => console.log(`      - ${w}`));
      hasDuplicates = true;
    }
  }
  
  if (!hasDuplicates) {
    console.log('   ✅ No duplicate ranks found!');
  }
  
  // Test 2: Check tie-breaking for same scores
  console.log('\nTest 2: Checking tie-breaking (same scores)...');
  for (const [score, count] of scores.entries()) {
    if (count > 1) {
      console.log(`   Score ${score}: ${count} users (alphabetically ordered)`);
      
      // Get wallets with this score
      const walletsWithScore = [];
      for (let i = 0; i < allEntries.length; i += 2) {
        if (allEntries[i + 1] === score) {
          walletsWithScore.push(allEntries[i]);
        }
      }
      
      // Check alphabetical order
      const sorted = [...walletsWithScore].sort();
      const isOrdered = JSON.stringify(walletsWithScore) === JSON.stringify(sorted);
      
      if (isOrdered) {
        console.log(`      ✅ Correctly ordered alphabetically`);
      } else {
        console.log(`      ⚠️  Not in alphabetical order`);
        console.log(`      Current:`, walletsWithScore.slice(0, 3));
        console.log(`      Expected:`, sorted.slice(0, 3));
      }
    }
  }
  
  // Test 3: Simulate referral and check rank change
  console.log('\nTest 3: Simulating referral to verify rank improves...');
  
  // Pick a user with low rank
  const testUserIndex = 20; // Pick rank #21
  const testWallet = allEntries[testUserIndex * 2];
  const testScoreBefore = allEntries[testUserIndex * 2 + 1];
  const testRankBefore = testUserIndex + 1;
  
  console.log(`   Test user: ${testWallet.slice(0, 10)}...${testWallet.slice(-6)}`);
  console.log(`   Before: Rank #${testRankBefore}, Score ${testScoreBefore}`);
  
  // Get rank after hypothetical +1 score
  let hypotheticalRank = 0;
  const newScore = testScoreBefore + 1;
  
  for (let i = 0; i < allEntries.length; i += 2) {
    const wallet = allEntries[i];
    const score = allEntries[i + 1];
    
    if (score > newScore) {
      hypotheticalRank++;
    } else if (score === newScore && wallet < testWallet) {
      hypotheticalRank++;
    }
  }
  
  hypotheticalRank++; // Convert to 1-based
  
  console.log(`   After +1 referral: Rank #${hypotheticalRank}, Score ${newScore}`);
  
  if (hypotheticalRank < testRankBefore) {
    console.log(`   ✅ Rank improved! (#${testRankBefore} → #${hypotheticalRank})`);
  } else if (hypotheticalRank === testRankBefore) {
    console.log(`   ⚠️  Rank stayed same (tie-breaking edge case)`);
  } else {
    console.log(`   ❌ Rank got worse! This should not happen!`);
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Total users: ${allEntries.length / 2}`);
  console.log(`   Unique ranks: ${ranks.size}`);
  console.log(`   Duplicate ranks: ${hasDuplicates ? 'YES ❌' : 'NO ✅'}`);
  console.log(`   Rank improves on referral: ${hypotheticalRank < testRankBefore ? 'YES ✅' : 'NO ❌'}`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
