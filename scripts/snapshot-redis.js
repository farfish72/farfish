/**
 * Snapshot all Upstash Redis data for debugging leaderboard issues
 */

const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = '.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  
  lines.forEach(line => {
    line = line.trim();
    if (line.startsWith('#') || !line || !line.includes('=')) return;
    
    const eqIndex = line.indexOf('=');
    const key = line.substring(0, eqIndex).trim();
    let value = line.substring(eqIndex + 1).trim();
    
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }
    
    process.env[key] = value;
  });
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  process.exit(1);
}

const baseUrl = UPSTASH_URL.endsWith('/') ? UPSTASH_URL.slice(0, -1) : UPSTASH_URL;

async function upstashRequest(path) {
  const res = await fetch(`${baseUrl}/${path}`, {
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`
    }
  });
  
  if (!res.ok) {
    throw new Error(`Upstash request failed: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();
  return data.result;
}

async function getAllKeys(pattern) {
  try {
    const keys = await upstashRequest(`keys/${encodeURIComponent(pattern)}`);
    return Array.isArray(keys) ? keys : [];
  } catch (error) {
    console.error(`Error fetching keys for pattern ${pattern}:`, error.message);
    return [];
  }
}

async function getValue(key) {
  try {
    return await upstashRequest(`get/${encodeURIComponent(key)}`);
  } catch (error) {
    console.error(`Error fetching value for key ${key}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('📊 Starting Redis snapshot...\n');
  
  const snapshot = {
    timestamp: new Date().toISOString(),
    referrals: {},
    refcodes: {},
    refcounts: {},
    summary: {
      total_referral_keys: 0,
      total_refcode_keys: 0,
      total_refcount_keys: 0,
      users_with_referrals: 0,
      users_who_created_refcodes: 0,
      total_referral_count: 0
    }
  };
  
  // Fetch all referral:* keys and values
  console.log('🔍 Fetching referral:* keys...');
  const referralKeys = await getAllKeys('referral:*');
  snapshot.summary.total_referral_keys = referralKeys.length;
  console.log(`   Found ${referralKeys.length} referral:* keys`);
  
  for (const key of referralKeys) {
    const wallet = key.replace('referral:', '');
    const value = await getValue(key);
    snapshot.referrals[wallet] = value;
  }
  
  // Fetch all refcode:* keys and values
  console.log('🔍 Fetching refcode:* keys...');
  const refcodeKeys = await getAllKeys('refcode:*');
  snapshot.summary.total_refcode_keys = refcodeKeys.length;
  console.log(`   Found ${refcodeKeys.length} refcode:* keys`);
  
  for (const key of refcodeKeys) {
    const code = key.replace('refcode:', '');
    const wallet = await getValue(key);
    snapshot.refcodes[code] = wallet;
  }
  
  // Fetch all refcount:* keys and values
  console.log('🔍 Fetching refcount:* keys...');
  const refcountKeys = await getAllKeys('refcount:*');
  snapshot.summary.total_refcount_keys = refcountKeys.length;
  console.log(`   Found ${refcountKeys.length} refcount:* keys`);
  
  for (const key of refcountKeys) {
    const wallet = key.replace('refcount:', '');
    const count = await getValue(key);
    const numCount = Number(count);
    snapshot.refcounts[wallet] = numCount;
    if (numCount > 0) {
      snapshot.summary.users_with_referrals++;
      snapshot.summary.total_referral_count += numCount;
    }
  }
  
  snapshot.summary.users_who_created_refcodes = Object.keys(snapshot.refcodes).length;
  
  // Save to file
  const outputPath = path.join(process.cwd(), '.agents', 'tasks', 'redis-snapshot-new.json');
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
  
  console.log('\n✅ Snapshot complete!');
  console.log('\n📈 Summary:');
  console.log(`   Total referral:* keys: ${snapshot.summary.total_referral_keys}`);
  console.log(`   Total refcode:* keys: ${snapshot.summary.total_refcode_keys}`);
  console.log(`   Total refcount:* keys: ${snapshot.summary.total_refcount_keys}`);
  console.log(`   Users with referrals: ${snapshot.summary.users_with_referrals}`);
  console.log(`   Total referrals: ${snapshot.summary.total_referral_count}`);
  console.log(`\n💾 Snapshot saved to: ${outputPath}`);
}

main().catch(console.error);
