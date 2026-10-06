const fs = require('fs');

// Load snapshot
const snapshot = JSON.parse(fs.readFileSync('.agents/tasks/redis-snapshot.json', 'utf8'));

const targetWallet = '0x7a090ae8135977f81a8279853bde66b32a829cca';

console.log(`=== Who bound ${targetWallet}'s code? ===\n`);

let count = 0;
for (const [wallet, referrer] of Object.entries(snapshot.referrals)) {
  // Skip test entries
  if (wallet.includes('REFERRER') || wallet.includes('1234567890')) continue;
  
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
  
  if (referrerWallet && referrerWallet.toLowerCase() === targetWallet.toLowerCase()) {
    count++;
    console.log(`${count}. ${wallet}`);
    
    // Check if this user also referred others
    const theirRefcount = snapshot.refcounts[wallet] || 0;
    if (theirRefcount > 0) {
      console.log(`   └─ This user then referred ${theirRefcount} more people`);
    }
  }
}

console.log(`\nTotal: ${count} users bound this code`);
console.log(`\n=== Refcode Info ===`);

// Find refcode
for (const [code, wallet] of Object.entries(snapshot.refcodes)) {
  if (wallet.toLowerCase() === targetWallet.toLowerCase()) {
    console.log(`Refcode: ${code}`);
    break;
  }
}
