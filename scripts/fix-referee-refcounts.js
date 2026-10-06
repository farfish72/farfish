const fs = require('fs');

// Parse .env.local
function loadEnv() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  return env;
}

const env = loadEnv();
let UPSTASH_URL = env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = env.UPSTASH_REDIS_REST_TOKEN;

// Remove quotes if present
if (UPSTASH_URL && (UPSTASH_URL.startsWith('"') || UPSTASH_URL.startsWith("'"))) {
  UPSTASH_URL = UPSTASH_URL.slice(1, -1);
}

// Remove trailing slash
if (UPSTASH_URL && UPSTASH_URL.endsWith('/')) {
  UPSTASH_URL = UPSTASH_URL.slice(0, -1);
}

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('❌ Missing Upstash credentials in .env.local');
  process.exit(1);
}

async function redisRequest(command) {
  const url = `${UPSTASH_URL}/${command}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await response.json();
  return data.result;
}

async function fixRefcounts() {
  console.log('=== FIXING REFEREE REFCOUNTS ===\n');
  
  // Load snapshot to identify who are referees (not referrers)
  const snapshot = JSON.parse(fs.readFileSync('.agents/tasks/redis-snapshot.json', 'utf8'));
  
  // Build list of all users who bound codes (referees)
  const allReferees = new Set();
  for (const [wallet, referrer] of Object.entries(snapshot.referrals)) {
    if (wallet.includes('REFERRER') || wallet.includes('1234567890')) continue;
    allReferees.add(wallet.toLowerCase());
  }
  
  // Build list of actual referrers (people who have referrals)
  const actualReferrers = new Set();
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
    
    if (referrerWallet && referrerWallet.startsWith('0x')) {
      actualReferrers.add(referrerWallet.toLowerCase());
    }
  }
  
  // Pure referees = those who bound codes but never referred anyone
  const pureReferees = Array.from(allReferees).filter(w => !actualReferrers.has(w));
  
  console.log(`Total referees (bound codes): ${allReferees.size}`);
  console.log(`Actual referrers (have referrals): ${actualReferrers.size}`);
  console.log(`Pure referees (bound but never referred): ${pureReferees.length}\n`);
  
  // Check and fix pure referees' refcounts
  let fixedCount = 0;
  let alreadyCorrect = 0;
  
  for (const wallet of pureReferees) {
    const refcount = await redisRequest(`get/refcount:${wallet}`);
    
    if (refcount && refcount > 0) {
      console.log(`❌ ${wallet}`);
      console.log(`   Current refcount: ${refcount} (WRONG - they never referred anyone)`);
      console.log(`   Action: Setting to 0`);
      
      await redisRequest(`set/refcount:${wallet}/0`);
      fixedCount++;
    } else {
      alreadyCorrect++;
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`✅ Fixed: ${fixedCount} pure referees`);
  console.log(`✓ Already correct: ${alreadyCorrect}`);
  console.log(`Total processed: ${pureReferees.length}`);
  
  console.log('\n💡 Note: Leaderboard scores are correct (they show total rewards)');
  console.log('   Only refcount was wrong, now fixed!');
}

fixRefcounts().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
