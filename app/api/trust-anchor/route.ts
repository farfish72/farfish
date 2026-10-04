import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawAddress = searchParams.get('address');

    if (!rawAddress) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const address = rawAddress.toLowerCase().trim();

    const rankKey = `user:${address}:rank`;
    const referralsKey = `refcount:${address}`;
    const recastsKey = `user:${address}:recasts`;

    // THIS LINE IS THE REAL FIX
    const results = (await Promise.all([
      redis.get(rankKey),
      redis.get(referralsKey),
      redis.get(recastsKey),
    ])) as (string | number | null)[];

    const [rankRaw, referralsRaw, recastsRaw] = results;

    return NextResponse.json({
      rank: rankRaw !== null ? Number(rankRaw) : null,
      referrals: referralsRaw !== null ? Number(referralsRaw) : null,
      recasts: recastsRaw !== null ? Number(recastsRaw) : null,
    });
  } catch (error) {
    console.error('[trust-anchor]', error);
    return NextResponse.json(
      { error: 'Failed to fetch trust anchor data' },
      { status: 500 }
    );
  }
}