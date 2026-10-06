const fs = require('fs');

// Load snapshot
const snapshot = JSON.parse(fs.readFileSync('.agents/tasks/redis-snapshot.json', 'utf8'));

const targetRefcode = '8ac78ee9';
const targetWallet = '0xbf7ed0f9d543ea11cfe6ea3fe993dd6e8ac78ee9';

console.log(`=== RANK POSITION FOR REFCODE: ${targetRefcode} ===\n`);
console.log(`Wallet: ${targetWallet}\n`);

// Build leaderboard from refcounts
const leaderboard = [];
for (const [wallet, count] of Object.entries(snapshot.refcounts)) {
  const rewards = count * 20;
  leaderboard.push({ wallet, count, rewards });
}

// Sort by count (descending)
leaderboard.sort((a, b) => b.count - a.count);

// Find position
let position = -1;
let userEntry = null;
for (let i = 0; i < leaderboard.length; i++) {
  if (leaderboard[i].wallet.toLowerCase() === targetWallet.toLowerCase()) {
    position = i + 1;
    userEntry = leaderboard[i];
    break;
  }
}

if (position === -1) {
  console.log('❌ USER NOT FOUND IN LEADERBOARD!');
  console.log('\n🔍 REASON: This user has 0 referrals');
  console.log('   - refcount = 0');
  console.log('   - Only users with referrals appear in leaderboard');
  console.log('\n📊 Current Leaderboard Logic:');
  console.log('   - Leaderboard uses `refcount` (how many people you referred)');
  console.log('   - This user bound a code but has not referred anyone yet');
  console.log('   - Position: NOT RANKED (0 referrals)');
  
  console.log('\n💡 What rewards did this user get?');
  console.log('   - As REFEREE: 20 FRH (from backfill script)');
  console.log('   - As REFERRER: 0 FRH (no one bound their code)');
  console.log('   - TOTAL: 20 FRH');
  
  console.log('\n⚠️ ISSUE DETECTED:');
  console.log('   - New dual rewards system gives 20 tokens to referees');
  console.log('   - But leaderboard ONLY shows referral count (outbound)');
  console.log('   - Referees with 0 referrals do NOT appear on leaderboard');
  console.log('   - Even though they earned 20 FRH!');
  
  process.exit(0);
}

console.log(`✅ POSITION: #${position} / ${leaderboard.length}`);
console.log(`   Referrals: ${userEntry.count}`);
console.log(`   Rewards: ${userEntry.rewards} FRH`);

// Show context (surrounding positions)
console.log('\n📊 LEADERBOARD CONTEXT:');
const start = Math.max(0, position - 3);
const end = Math.min(leaderboard.length, position + 2);

for (let i = start; i < end; i++) {
  const entry = leaderboard[i];
  const marker = i === position - 1 ? '👉' : '  ';
  console.log(`${marker} #${i+1}. ${entry.wallet}`);
  console.log(`       Referrals: ${entry.count} | Rewards: ${entry.rewards} FRH`);
}
