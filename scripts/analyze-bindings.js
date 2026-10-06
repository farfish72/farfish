const fs = require('fs');

// Load snapshot
const snapshot = JSON.parse(fs.readFileSync('.agents/tasks/redis-snapshot.json', 'utf8'));

const allUsers = new Set();
const usersWithReferralBound = new Set();
const usersWithRefcode = new Set();

// Get all users from referrals (these are users who BOUND a code)
for (const [wallet, referrer] of Object.entries(snapshot.referrals)) {
  // Skip test entries
  if (wallet.includes('REFERRER') || wallet.includes('1234567890')) continue;
  
  usersWithReferralBound.add(wallet.toLowerCase());
  allUsers.add(wallet.toLowerCase());
  
  // Extract referrer from JSON format or direct string
  let referrerWallet;
  if (typeof referrer === 'string' && referrer.startsWith('{')) {
    try {
      const parsed = JSON.parse(referrer);
      referrerWallet = parsed.referrer;
    } catch (e) {
      // Try to extract manually
      const match = referrer.match(/0x[a-fA-F0-9]{40}/);
      if (match) referrerWallet = match[0];
    }
  } else {
    referrerWallet = referrer;
  }
  
  if (referrerWallet && referrerWallet.startsWith('0x')) {
    allUsers.add(referrerWallet.toLowerCase());
  }
}

// Get all users with refcodes
for (const [code, wallet] of Object.entries(snapshot.refcodes)) {
  usersWithRefcode.add(wallet.toLowerCase());
  allUsers.add(wallet.toLowerCase());
}

// Get all users from refcounts
for (const wallet of Object.keys(snapshot.refcounts)) {
  allUsers.add(wallet.toLowerCase());
}

// Analysis
const totalUsers = allUsers.size;
const boundUsers = usersWithReferralBound.size;
const notBoundUsers = totalUsers - boundUsers;

// Find users who have NOT bound any code
const usersNotBound = Array.from(allUsers).filter(w => !usersWithReferralBound.has(w));

console.log('=== REFERRAL BINDING ANALYSIS ===\n');
console.log(`Total Unique Users: ${totalUsers}`);
console.log(`Users who BOUND a referral code: ${boundUsers} (${((boundUsers/totalUsers)*100).toFixed(1)}%)`);
console.log(`Users who did NOT bind: ${notBoundUsers} (${((notBoundUsers/totalUsers)*100).toFixed(1)}%)`);

console.log('\n=== USERS WITHOUT REFERRAL BINDING ===');
usersNotBound.forEach((wallet, i) => {
  const hasRefcode = usersWithRefcode.has(wallet);
  const refcount = snapshot.refcounts[wallet] || 0;
  console.log(`${i+1}. ${wallet}`);
  console.log(`   - Has refcode: ${hasRefcode ? 'YES' : 'NO'}`);
  console.log(`   - Referral count: ${refcount}`);
});

console.log('\n=== SUMMARY ===');
console.log(`✅ Bound users: ${boundUsers}`);
console.log(`❌ Not bound users: ${notBoundUsers}`);

// Check if these are root users (referrers who never bound anyone's code)
console.log('\n=== ROOT USERS (Never bound, only referred others) ===');
const rootUsers = usersNotBound.filter(w => {
  const refcount = snapshot.refcounts[w] || 0;
  return refcount > 0;
});

rootUsers.forEach(wallet => {
  console.log(`- ${wallet} (Referred: ${snapshot.refcounts[wallet]} users)`);
});

console.log(`\nTotal Root Users: ${rootUsers.length}`);
