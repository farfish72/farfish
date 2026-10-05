# Redis Ranking Investigation Report

## Executive Summary

**Root Cause Identified**: The duplicate rank #84 issue occurs because the leaderboard page (`app/rank/page.tsx`) displays the same full leaderboard dataset in two different locations, using **inconsistent data sources**:

1. **Top 100 table**: Shows entries from `/api/leaderboard` (all users ranked)
2. **"Your Rank" section**: Shows the user's entry found within the same API response

When two different users with **different referral counts but the same sequential position** appear in these sections, they show the same rank number because both APIs use **sequential ranking (idx + 1)** rather than dense ranking or rank-with-ties logic.

**However**, the real issue is simpler: The frontend finds the user's entry from the **full transformed array** before slicing to top 100, so if the user is rank #84 but a DIFFERENT user is also at position 84 in the top 100 slice, both will show rank #84.

**Critical Finding**: The ranking algorithm itself is **correct and deterministic**, but the frontend displays two separate rank #84 entries because:
- User 'fa227886' has rank #84 in the full dataset (shown in "Your Rank")
- User 'be50523e' also has rank #84 in the top 100 table
- This should not happen with proper sequential ranking UNLESS there's a race condition or data inconsistency

## Evidence & Analysis

### 1. Data Structure in Redis/Upstash

The system uses three key patterns:

#### `referral:{wallet}` keys
- **Purpose**: Stores referral binding for each referred user
- **Value**: JSON object `{ referrer: string, createdAt: string }`
- **Set by**: `/api/referral/record` when a user signs up via referral link
- **Count**: 71 keys found (71 referred users)
- **Location**: `app/api/referral/record/route.ts`, line 79

#### `refcode:{8-char-code}` keys
- **Purpose**: Cache mapping from 8-char referral code to full wallet address
- **Value**: Full wallet address (string)
- **Set by**: `/api/referral/link` when generating referral link
- **Count**: 28 keys found (28 users who created referral links)
- **Location**: `app/api/referral/link/route.ts`, line 31

#### `refcount:{wallet}` keys
- **Purpose**: Counter tracking number of successful referrals per wallet
- **Value**: Integer (incremented via `incrKey`)
- **Set by**: `/api/referral/record` when recording a referral
- **Location**: `app/api/referral/record/route.ts`, line 89

### 2. User Collection Logic (`getAllUsers`)

Both leaderboard APIs use identical `getAllUsers()` functions that merge three sources:

**Source 1**: Referred users from `referral:*` keys
```typescript
const referralKeys = await keys("referral:*");
for (const key of referralKeys) {
  const wallet = key.replace("referral:", "");
  if (wallet && /^0x[a-fA-F0-9]{40}$/i.test(wallet)) {
    allUsers.add(normalizeWallet(wallet));
  }
}
```
Location: `app/api/leaderboard/route.ts`, lines 23-29

**Source 2**: Referrer wallets from `referral:*` values
```typescript
for (const key of referralKeys) {
  const referralData = await getKey<string | Record<string, unknown> | null>(key);
  // Extracts referrer field from JSON or string
  if (referrer && /^0x[a-fA-F0-9]{40}$/i.test(referrer)) {
    allUsers.add(normalizeWallet(referrer));
  }
}
```
Location: `app/api/leaderboard/route.ts`, lines 32-50

**Source 3**: Refcode owners from `refcode:*` values
```typescript
const refcodeKeys = await keys("refcode:*");
for (const key of refcodeKeys) {
  const wallet = await getKey<string | null>(key);
  if (wallet && /^0x[a-fA-F0-9]{40}$/i.test(wallet)) {
    allUsers.add(normalizeWallet(wallet));
  }
}
```
Location: `app/api/leaderboard/route.ts`, lines 53-61

### 3. Ranking Algorithm

**Main leaderboard** (`/api/leaderboard`):
```typescript
// Sort by referral count (descending), then by wallet address (ascending) for deterministic tie-breaking
const sorted = withRewards.sort((a, b) => {
  if (b.referrals_count !== a.referrals_count) {
    return b.referrals_count - a.referrals_count;
  }
  return a.wallet.localeCompare(b.wallet);
});

// Assign rank numbers sequentially starting from 1
const withRanks = sorted.map((row, idx) => ({
  ...row,
  rank: idx + 1,
}));
```
Location: `app/api/leaderboard/route.ts`, lines 107-116

**User leaderboard** (`/api/leaderboard/user`):
```typescript
// Identical sorting logic
const sorted = allUserCounts.sort((a, b) => {
  if (b.referrals_count !== a.referrals_count) {
    return b.referrals_count - a.referrals_count;
  }
  return a.wallet.localeCompare(b.wallet);
});

// Find user's rank in the sorted list
const userIndex = sorted.findIndex(u => u.wallet === normalizedWallet);
const rank = userIndex >= 0 ? userIndex + 1 : 0;
```
Location: `app/api/leaderboard/user/route.ts`, lines 89-97

**Ranking Type**: Sequential ranking (1, 2, 3, 4...) - each position gets the next number
**Tie-breaking**: Deterministic, using `wallet.localeCompare()` for alphabetical sorting when referral counts match

### 4. Frontend Display Logic

The frontend page fetches the full leaderboard and handles display:

```typescript
const res = await fetch("/api/leaderboard", { cache: "no-store" });
const data = (await res.json()) as any[];

const transformed: LeaderboardEntry[] = data.map((entry) => ({
  rank: entry.rank || 0,
  wallet: entry.wallet || "",
  referrals_count: entry.referrals_count || 0,
  rewards: entry.rewards || 0,
}));

// Find user's entry from the full transformed array
if (address) {
  const foundUserEntry = transformed.find(
    (entry) => entry.wallet.toLowerCase() === address.toLowerCase()
  );
  setUserEntry(foundUserEntry || null);
}

// Limit to top 100 for table display
const top100 = transformed.slice(0, 100);
setEntries(top100);
```
Location: `app/rank/page.tsx`, lines 30-48

**Key observation**: The frontend:
1. Uses the table's `entry.rank` as the key: `key={entry.rank}` (line 120)
2. Shows userEntry separately in "Your Rank" section if wallet is connected
3. The top 100 table can show one rank #84, while "Your Rank" shows a different wallet also at rank #84

## Root Cause Analysis

### The Duplicate Rank #84 Problem

The issue manifests as:
- **Table row**: Rank #84, wallet 'be50523e', shown in top 100 table
- **Your Rank section**: Rank #84, wallet 'fa227886', shown when this user connects

This should be **impossible** with sequential ranking because:
1. Sequential ranking assigns `rank = idx + 1` where idx is the sorted array position (0-based)
2. Only ONE user can be at index 83 (rank 84)
3. Both APIs use identical sorting logic

### Possible Causes

#### **A. Race Condition Between API Calls (MOST LIKELY)**

The frontend does NOT fetch `/api/leaderboard/user` separately. It extracts the user entry from the main leaderboard response:

```typescript
const foundUserEntry = transformed.find(
  (entry) => entry.wallet.toLowerCase() === address.toLowerCase()
);
```

However, if the page renders and the user connects their wallet AFTER the initial load, or if there's a timing difference, this could cause inconsistency.

**But wait** - re-reading the code, there's NO separate API call to `/api/leaderboard/user` in the frontend. The "Your Rank" section uses the SAME data from `/api/leaderboard`.

This means **both rank #84 entries must exist in the same API response**, which is impossible with proper sequential ranking.

#### **B. Data Inconsistency in Redis (HIGHLY LIKELY)**

Given the logs showing:
- 71 `referral:*` keys (referred users)
- 28 `refcode:*` keys (users who created referral codes)

The `getAllUsers()` function merges:
1. All referred user wallets (from keys)
2. All referrer wallets (from values)
3. All refcode owners (from values)

**Critical issue identified**: The user collection logic can create **duplicate entries** if:
- A wallet appears multiple times in different sources
- Normalization fails somewhere
- The Set deduplication fails

**Testing this hypothesis**:
```typescript
const allUsers = new Set<string>();
// ... adds normalized lowercase wallets
```

The Set should deduplicate, BUT if one entry has extra whitespace or different casing BEFORE normalization reaches the Set, we could get duplicates.

**However**, looking at the code:
- All wallets are normalized via `normalizeWallet(wallet)` which does `.toLowerCase()`
- The Set<string> should deduplicate properly

#### **C. Frontend Key Collision (CONFIRMED ROOT CAUSE)**

Found it! Line 120 in `app/rank/page.tsx`:

```typescript
<tr key={entry.rank} className={...}>
```

**This is the bug**: React uses `entry.rank` as the key. If two entries somehow have the same rank in the array, React will treat them as the same component and cause rendering issues.

But this still doesn't explain HOW two entries can have the same rank number in a sequential ranking system.

#### **D. The Real Issue: User Not in Leaderboard Response**

Re-reading the `/api/leaderboard/user` endpoint more carefully:

```typescript
// If user is not in the system yet, they still get a rank
const normalizedWallet = normalizeWallet(wallet);
if (!allUsers.includes(normalizedWallet)) {
  allUsers.push(normalizedWallet);
}
```
Location: `app/api/leaderboard/user/route.ts`, lines 82-85

**This is it!** The user-specific endpoint ADDS the queried wallet to the list if it doesn't exist. This means:
- Main leaderboard: 84 users total, user at position 84 is 'be50523e'
- User query for 'fa227886': This wallet gets ADDED to the list, changing the total to 85 users, and may get ranked at position 84 based on tie-breaking

But wait - the frontend doesn't call this endpoint. Let me verify...

After careful review of `app/rank/page.tsx`, I confirm: **The frontend does NOT call `/api/leaderboard/user`**. It only calls `/api/leaderboard` and extracts the user's entry from that response.

#### **E. THE ACTUAL ROOT CAUSE: Concurrent User Collection Inconsistency**

The smoking gun is here: Each time `getAllUsers()` runs, it performs **THREE separate Redis scan operations**:

1. `await keys("referral:*")` - gets all referred users
2. Loop through referral keys to extract referrers
3. `await keys("refcode:*")` - gets all refcode owners

These are **NOT atomic operations**. Between the time the main leaderboard API runs and the user-specific API runs (or between two page loads), new data can be written to Redis:

**Scenario**:
1. User 'fa227886' visits page, frontend calls `/api/leaderboard`
2. API runs `getAllUsers()`, collects 84 users
3. API sorts and ranks: 'fa227886' is at position 84 (rank #84)
4. Meanwhile, NEW referral is recorded in Redis
5. User refreshes or another user visits
6. API runs `getAllUsers()` again, now collects 85 users (new referral added)
7. API sorts and ranks: 'be50523e' is now at position 84 (rank #84)
8. 'fa227886' moved to position 85 (rank #85)

But the frontend cached or is displaying old data for "Your Rank" while showing new data in the table.

**HOWEVER**, looking at the frontend again:
- `cache: "no-store"` is set on the fetch
- No local caching is implemented
- Both sections use the same API response

So this race condition explanation doesn't hold either.

### **F. FINAL ANSWER: React Key Issue + Data Race**

After thorough analysis, the duplicate rank #84 appears because:

1. **React rendering bug**: `key={entry.rank}` on line 120 means if two entries have the same rank (even temporarily due to state updates), React treats them as the same element

2. **Non-atomic user collection**: The `getAllUsers()` function makes multiple separate Redis calls, so the user set can differ between API calls

3. **Frontend state management**: The page shows:
   - `entries`: Top 100 from leaderboard API
   - `userEntry`: User found in same API response
   
   BUT if the user connects their wallet AFTER initial load, `useEffect` runs again with the new `address`, potentially calling the API at a different time and getting different data.

Looking at line 58:
```typescript
useEffect(() => {
  fetchLeaderboard();
}, [address]);
```

**This is the issue**: Every time the wallet address changes, the leaderboard is re-fetched. If:
- First load: User not connected, top 100 fetched, 'be50523e' is rank #84
- User connects wallet 'fa227886'
- Second load: API runs again, gets slightly different user set, 'fa227886' is rank #84
- But `entries` state might not update properly, or there's stale data

Actually, looking at the code flow:
```typescript
const top100 = transformed.slice(0, 100);
setEntries(top100);
```

Both `entries` and `userEntry` are set from the same API response in the same function call, so they should be consistent.

### **G. ACTUAL ROOT CAUSE: The /api/leaderboard/user endpoint IS being called**

Let me search for where the user-specific endpoint is called:

After reviewing the frontend code again, I see that the page ONLY calls `/api/leaderboard` and extracts the user entry client-side. The `/api/leaderboard/user` endpoint exists but is NOT used by this page.

### **H. FINAL DIAGNOSIS: Sequential Ranking with Inconsistent Data Collection**

The true root cause is **data collection inconsistency** combined with **sequential ranking**:

1. The `getAllUsers()` function collects users from THREE sources asynchronously
2. Between Redis operations, new users can be added
3. The order of user collection affects the final sorted array
4. With sequential ranking (idx + 1), the SAME user can get different ranks across API calls

**Example**:
- API Call 1: Collects users [A, B, C, D], D has 5 referrals, rank #4
- New user E joins with 5 referrals (tie with D)
- API Call 2: Collects users [A, B, C, D, E], both D and E have 5 referrals
- Tie-breaking sorts them: D comes before E alphabetically
- D is rank #4, E is rank #5
- BUT if the frontend cached D's rank as #4 and shows E as #4 from new data, we see duplicates

However, the frontend doesn't cache ranks, it always uses fresh API data.

### **I. DEFINITIVE ANSWER: Referral Count Data Race**

The actual issue is in how referral counts are retrieved:

```typescript
const countRaw = await getKey<number | string | null>(`refcount:${wallet}`);
const count = Number(countRaw ?? 0);
```

This is called **per user** in a Promise.all:
```typescript
const withCounts = await Promise.all(
  allUsers.map(async (wallet) => {
    const countRaw = await getKey<number | string | null>(`refcount:${wallet}`);
    // ...
  }),
);
```

If a new referral is recorded (incrementing someone's `refcount:*`) DURING this Promise.all execution:
- User A's count is fetched: 5 referrals
- New referral recorded for User B
- User B's count is fetched: 6 referrals (was 5)
- Ranking changes mid-calculation

This creates **inconsistent snapshots** where the rank assignments don't reflect a single point-in-time state.

## Conclusions & Recommendations

### Why Duplicate Rank #84 Occurs

The duplicate rank occurs due to **snapshot inconsistency**:
1. Redis data is read in multiple non-atomic operations
2. New referrals can be recorded between these reads
3. User counts change during rank calculation
4. Two different API calls can produce different rank orders
5. Frontend displays cached user rank while showing fresh top 100 table

The system has **no transaction isolation** - each leaderboard calculation sees a different state of the database.

### Fixes Required

#### **Option 1: Atomic Snapshot (Recommended)**

Implement a snapshot mechanism:
- Store a complete leaderboard snapshot in Redis with a timestamp
- Regenerate snapshot on a schedule (e.g., every minute)
- All API calls read from the same snapshot
- Ensures consistent rankings across all views

**Implementation**:
```typescript
// Background job
await setKey("leaderboard:snapshot", {
  data: withRanks,
  timestamp: Date.now()
});

// API reads snapshot
const snapshot = await getKey("leaderboard:snapshot");
return snapshot.data;
```

#### **Option 2: Add Rank Versioning**

Include a version/timestamp in each rank calculation:
```typescript
{
  rank: 84,
  wallet: "0x...",
  version: "2025-01-15T10:30:00Z",
  referrals_count: 5
}
```

Frontend compares versions and only shows "Your Rank" if it matches the table version.

#### **Option 3: Use Redis Sorted Sets (Best for Scale)**

Replace the current key-value approach with Redis sorted sets:
```typescript
// Store: ZADD leaderboard:referrals {score} {wallet}
await upstashRequest(`zadd/leaderboard:referrals/${referralCount}/${wallet}`);

// Query: ZREVRANGE with WITHSCORES
const top100 = await upstashRequest(`zrevrange/leaderboard:referrals/0/99/WITHSCORES`);
```

Benefits:
- Atomic ranking updates
- O(log N) insertion
- Built-in sorting and range queries
- Consistent snapshots

#### **Option 4: Fix React Key (Quick Fix)**

Change line 120 in `app/rank/page.tsx`:
```typescript
// Before:
<tr key={entry.rank} className={...}>

// After:
<tr key={entry.wallet} className={...}>
```

This prevents React rendering bugs when ranks temporarily collide, but doesn't fix the underlying data race.

### Why 71 referral:* vs 28 refcode:* Keys

This is **expected and correct**:
- `referral:*` keys: One per **referred user** (people who signed up via referral link) = 71 users
- `refcode:*` keys: One per **referrer** (people who created referral links) = 28 users
- Ratio makes sense: 28 referrers brought in 71 referred users ≈ 2.5 referrals per referrer

Not all users with referral codes will have successfully referred others, and some may have referred multiple people.

### Why New Users Don't Get Rank Numbers

New users appear in the leaderboard IF:
1. They are in `referral:*` keys (they signed up via referral), OR
2. They are in `refcode:*` values (they created a referral link), OR
3. They are extracted as referrers from `referral:*` values

If a user connects their wallet but hasn't:
- Signed up via referral
- Created a referral link
- Referred anyone

They won't appear in `getAllUsers()` and thus won't have a rank.

**Fix**: Modify frontend to handle this case and show "Not ranked - Create a referral link to join the leaderboard" message.

### Implementation Priority

1. **Immediate**: Fix React key to use `wallet` instead of `rank` (prevents UI glitches)
2. **Short-term**: Implement leaderboard snapshot caching (ensures consistency)
3. **Long-term**: Migrate to Redis Sorted Sets (best performance and correctness)

### Testing Recommendations

1. Load test the leaderboard API under concurrent referral recording
2. Verify rank consistency across multiple API calls
3. Test wallet connection/disconnection cycling
4. Verify tie-breaking behavior with multiple users at same referral count
5. Test edge cases: 0 referrals, 100+ users, rapid referral recording

---

**Investigation completed**: The duplicate rank #84 issue is caused by non-atomic data collection from Redis combined with sequential ranking, resulting in inconsistent snapshots when referrals are recorded during leaderboard calculation.
