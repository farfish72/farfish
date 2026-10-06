const fs = require('fs');

// Load snapshot
const snapshot = JSON.parse(fs.readFileSync('.agents/tasks/redis-snapshot.json', 'utf8'));

const targetRefcode = '8ac78ee9';

console.log(`=== USER RECORD FOR REFCODE: ${targetRefcode} ===\n`);

// Find wallet from refcode
let userWallet = null;
for (const [code, wallet] of Object.entries(snapshot.refcodes)) {
  if (code === targetRefcode) {
    userWallet = wallet;
    break;
  }
}

if (!userWallet) {
  console.log('❌ Refcode not found!');
  process.exit(1);
}

console.log(`Wallet Address: ${userWallet}\n`);

// Check if this user bound anyone's code
console.log('=== REFERRAL INFO (Who did this user bind?) ===');
const boundTo = snapshot.referrals[userWallet];
if (boundTo) {
  let referrerWallet;
  let timestamp;
  
  if (typeof boundTo === 'string' && boundTo.startsWith('{')) {
    try {
      const parsed = JSON.parse(boundTo);
      referrerWallet = parsed.referrer;
      timestamp = parsed.createdAt;
    } catch (e) {
      const walletMatch = boundTo.match(/0x[a-fA-F0-9]{40}/);
      const dateMatch = boundTo.match(/(\d{4}-\d{2}-\d{2}T[\d:\.]+Z)/);
      if (walletMatch) referrerWallet = walletMatch[0];
      if (dateMatch) timestamp = dateMatch[1];
    }
  } else {
    referrerWallet = boundTo;
  }
  
  console.log(`✅ This user BOUND a code`);
  console.log(`   Referrer: ${referrerWallet}`);
  if (timestamp) {
    const date = new Date(timestamp);
    console.log(`   Date: ${date.toLocaleString()}`);
  }
  
  // Find referrer's refcode
  for (const [code, wallet] of Object.entries(snapshot.refcodes)) {
    if (wallet.toLowerCase() === referrerWallet.toLowerCase()) {
      console.log(`   Referrer's code: ${code}`);
      break;
    }
  }
} else {
  console.log('❌ This user did NOT bind any referral code (Root user)');
}

// Check how many people bound this user's code
console.log('\n=== REFERRAL COUNT (Who bound this user\'s code?) ===');
const refcount = snapshot.refcounts[userWallet] || 0;
console.log(`Total referrals: ${refcount}`);

if (refcount > 0) {
  console.log('\nReferees:');
  let count = 0;
  for (const [wallet, referrer] of Object.entries(snapshot.referrals)) {
    if (wallet.includes('REFERRER') || wallet.includes('1234567890')) continue;
    
    let referrerWallet;
    if (typeof referrer === 'string' && referrer.startsWith('{')) {
      try {
        const parsed = JSON.parse(referrer);
        referrerWallet = parsed.referrer;
      } catch (e) {
        const match = referrer.match(/0x[a-fA-F0-9]{40}/);
        if (match) referrerWallet = match[0];
      }
    } else {
      referrerWallet = referrer;
    }
    
    if (referrerWallet && referrerWallet.toLowerCase() === userWallet.toLowerCase()) {
      count++;
      console.log(`${count}. ${wallet}`);
    }
  }
}

// Calculate rewards
console.log('\n=== REWARDS CALCULATION ===');
let totalRewards = 0;

// Rewards as referrer
const referrerRewards = refcount * 20;
totalRewards += referrerRewards;
console.log(`As Referrer: ${refcount} referrals × 20 = ${referrerRewards} FRH`);

// Rewards as referee
const refereeRewards = boundTo ? 20 : 0;
totalRewards += refereeRewards;
console.log(`As Referee: ${boundTo ? '1 × 20 = 20 FRH' : '0 FRH (not a referee)'}`);

console.log(`\n💰 TOTAL REWARDS: ${totalRewards} FRH`);

// User status
console.log('\n=== USER STATUS ===');
console.log(`Role: ${!boundTo ? 'ROOT USER (Independent)' : 'REFERRED USER'}`);
console.log(`Has Refcode: ✅ YES (${targetRefcode})`);
console.log(`Referral Power: ${refcount > 0 ? `✅ ACTIVE (${refcount} referrals)` : '⚪ INACTIVE (no referrals yet)'}`);
