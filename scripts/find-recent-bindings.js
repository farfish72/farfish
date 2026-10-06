const fs = require('fs');

// Load snapshot
const snapshot = JSON.parse(fs.readFileSync('.agents/tasks/redis-snapshot.json', 'utf8'));

console.log('=== RECENT REFERRAL BINDINGS ===\n');

const bindings = [];

for (const [wallet, referrer] of Object.entries(snapshot.referrals)) {
  // Skip test entries
  if (wallet.includes('REFERRER') || wallet.includes('1234567890')) continue;
  
  // Extract referrer and timestamp from JSON format
  let referrerWallet;
  let timestamp;
  
  if (typeof referrer === 'string' && referrer.startsWith('{')) {
    try {
      const parsed = JSON.parse(referrer);
      referrerWallet = parsed.referrer;
      timestamp = parsed.createdAt;
    } catch (e) {
      // Try to extract manually
      const walletMatch = referrer.match(/0x[a-fA-F0-9]{40}/);
      const dateMatch = referrer.match(/(\d{4}-\d{2}-\d{2}T[\d:\.]+Z)/);
      
      if (walletMatch) referrerWallet = walletMatch[0];
      if (dateMatch) timestamp = dateMatch[1];
    }
  } else {
    referrerWallet = referrer;
    timestamp = null; // Old format, no timestamp
  }
  
  if (timestamp) {
    bindings.push({
      wallet,
      referrer: referrerWallet,
      timestamp,
      date: new Date(timestamp)
    });
  }
}

// Sort by date (newest first)
bindings.sort((a, b) => b.date - a.date);

// Show recent bindings
console.log('Most Recent Bindings:\n');
bindings.slice(0, 10).forEach((b, i) => {
  const dateStr = b.date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  console.log(`${i+1}. Wallet: ${b.wallet}`);
  console.log(`   Bound code of: ${b.referrer}`);
  console.log(`   Date: ${dateStr}`);
  console.log(`   Timestamp: ${b.timestamp}\n`);
});

// Find yesterday's bindings
const now = new Date();
const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);

const yesterdayBindings = bindings.filter(b => {
  const bindDate = new Date(b.date);
  bindDate.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);
  return bindDate.getTime() === yesterday.getTime();
});

console.log(`\n=== Yesterday's Bindings (${yesterday.toLocaleDateString()}) ===`);
if (yesterdayBindings.length === 0) {
  console.log('No bindings found for yesterday.');
  console.log('\nNote: Most bindings in your data are from earlier dates (Jan-May 2026)');
} else {
  yesterdayBindings.forEach((b, i) => {
    console.log(`${i+1}. ${b.wallet} bound ${b.referrer}'s code`);
  });
}

console.log(`\n=== Summary ===`);
console.log(`Total bindings with timestamps: ${bindings.length}`);
console.log(`Most recent: ${bindings[0] ? bindings[0].date.toLocaleDateString() : 'N/A'}`);
console.log(`Today's date: ${now.toLocaleDateString()}`);
