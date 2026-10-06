/**
 * Backfill Script: Reward Existing Referees
 * 
 * This script gives 20 tokens to all users who were referred (bound a referral code)
 * in the existing Redis backup data.
 * 
 * It does NOT give tokens to referrers - only to referees (those who bound codes).
 * 
 * Run once after deploying the new reward system.
 * 
 * Usage: node scripts/backfill-referee-rewards.js
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
  });
} else {
  console.error('❌ .env.local file not found!');
  process.exit(1);
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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
  console.log('🔄 Starting Referee Reward Backfill...\n');
  
  // Load Redis snapshot
  const snapshotPath = '.agents\\tasks\\redis-snapshot.json';
  console.log(`📥 Loading snapshot from: ${snapshotPath}`);
  
  if (!fs.existsSync(snapshotPath)) {
    console.error('❌ Snapshot file not found!');
    process.exit(1);
  }
  
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  console.log(`✅ Snapshot loaded (${snapshot.timestamp})\n`);
  
  // Get all referees (users who bound a referral code)
  const referrals = snapshot.referrals;
  const referees = Object.keys(referrals).filter(key => {
    // Only valid wallet addresses
    return key.match(/^0x[a-fA-F0-9]{40}$/i);
  });
  
  console.log(`📊 Found ${referees.length} referees (users who bound codes)\n`);
  
  // Statistics
  let rewarded = 0;
  let alreadyRewarded = 0;
  let errors = 0;
  
  console.log('💰 Rewarding referees with 20 tokens each...\n');
  
  for (const referee of referees) {
    try {
      // Check current score
      const currentScore = await upstashRequest(`zscore/leaderboard/${encodeURIComponent(referee)}`);
      
      if (currentScore !== null && currentScore > 0) {
        console.log(`⏭️  ${referee.slice(0, 10)}...${referee.slice(-6)} - Already has ${currentScore} tokens, skipping`);
        alreadyRewarded++;
        continue;
      }
      
      // Give 20 tokens (increment by 1, since each increment = 20 tokens)
      await upstashRequest(`zincrby/leaderboard/1/${encodeURIComponent(referee)}`, {
        method: 'POST'
      });
      
      // DO NOT set refcount - they didn't refer anyone, just bound a code!
      // Refcount should only be set when someone refers others
      
      console.log(`✅ ${referee.slice(0, 10)}...${referee.slice(-6)} - Rewarded 20 tokens (welcome bonus)`);
      rewarded++;
      
    } catch (error) {
      console.error(`❌ ${referee.slice(0, 10)}...${referee.slice(-6)} - Error: ${error.message}`);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Referees Found:     ${referees.length}`);
  console.log(`Newly Rewarded:           ${rewarded} (20 tokens each)`);
  console.log(`Already Had Rewards:      ${alreadyRewarded}`);
  console.log(`Errors:                   ${errors}`);
  console.log(`Total Tokens Distributed: ${rewarded * 20} FRH`);
  console.log('='.repeat(80));
  console.log('\n✅ Backfill complete!\n');
  
  // Show top 10 from leaderboard after backfill
  console.log('📈 Top 10 Leaderboard After Backfill:');
  console.log('─'.repeat(80));
  const leaderboard = await upstashRequest('zrevrange/leaderboard/0/9/WITHSCORES');
  
  for (let i = 0; i < leaderboard.length && i < 20; i += 2) {
    const wallet = leaderboard[i];
    const score = leaderboard[i + 1];
    const rank = Math.floor(i / 2) + 1;
    console.log(`#${rank}  ${wallet.slice(0, 10)}...${wallet.slice(-6)} - ${score} referrals (${score * 20} FRH)`);
  }
  console.log('─'.repeat(80));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
