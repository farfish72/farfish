# Wallet Connection Migration Guide

This guide explains the wallet connection changes from the Farcaster Mini App to the standalone Android APK.

## Overview

**Before:** Farcaster Mini App connector (embedded wallet)  
**After:** WalletConnect v2 + Injected + Coinbase Wallet connectors

This change enables mobile users to connect any compatible Web3 wallet on Ethereum mainnet and Base networks.

## What Changed

### Farcaster Mini App (Original)

**Connector:** `farcasterMiniApp()` from `@farcaster/miniapp-wagmi-connector`

**Flow:**
1. User opens app in Farcaster client (Warpcast, Supercast, etc.)
2. Farcaster detects embedded context
3. Automatically provides wallet connection
4. User clicks "Connect Wallet"
5. Connects immediately via Farcaster's wallet

**Limitations:**
- Only works inside Farcaster clients
- Limited to Farcaster's supported networks
- Cannot use external wallets
- Not accessible outside Farcaster ecosystem

### WalletConnect (Android Version)

**Connectors:**
1. `walletConnect()` - Universal mobile wallet connection
2. `injected()` - Browser extension wallets (MetaMask, etc.)
3. `coinbaseWallet()` - Coinbase Wallet

**Flow:**
1. User opens Android app
2. Clicks "Connect Wallet"
3. WalletConnect QR modal or deep link appears
4. User selects wallet app from list
5. Wallet app opens (e.g., MetaMask, Rainbow, Trust Wallet)
6. User approves connection
7. Wallet app closes, returns to FarFISH
8. Connection established

**Advantages:**
- Works with 300+ wallet apps
- Supports Ethereum mainnet + Base
- Universal standard (WIP-5792 compatible)
- Works outside Farcaster ecosystem
- User has full wallet choice

## Supported Wallets

### Mobile Wallets (via WalletConnect)

**Popular:**
- MetaMask Mobile
- Rainbow Wallet
- Trust Wallet
- Coinbase Wallet
- Zerion
- Argent
- Safe Wallet
- Ledger Live
- imToken

**Full List:** https://explorer.walletconnect.com/

### Browser Extension Wallets (when opened in browser)

- MetaMask
- Coinbase Wallet Extension
- Rainbow Extension
- Brave Wallet
- Frame

### Requirements

All wallets must support:
- ✅ Ethereum mainnet (Chain ID: 1)
- ✅ Base network (Chain ID: 8453)
- ✅ WalletConnect v2 protocol

## Technical Implementation

### Configuration (app/lib/wagmi.ts)

```typescript
import { walletConnect, injected, coinbaseWallet } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export const wagmiConfig = createConfig({
  chains: [base, mainnet],
  transports: {
    [base.id]: fallback([
      http("https://mainnet.base.org"),
      http("https://base-rpc.publicnode.com"),
      http("https://base.api.onfinality.io/public"),
    ]),
    [mainnet.id]: fallback([
      http("https://eth.llamarpc.com"),
      http("https://rpc.ankr.com/eth"),
      http("https://ethereum.publicnode.com"),
    ]),
  },
  connectors: [
    walletConnect({
      projectId,
      metadata: {
        name: "FarFISH",
        description: "Daily habit-building app on Base",
        url: "https://farfish.app",
        icons: ["https://farfish.app/icon.png"],
      },
      showQrModal: true,
    }),
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: "FarFISH",
      appLogoUrl: "https://farfish.app/icon.png",
    }),
  ],
  ssr: true,
});
```

### Connection Component (app/components/WalletConnect.tsx)

```typescript
import { useAccount, useConnect, useDisconnect } from "wagmi";

export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const handleConnect = () => {
    // Prefer WalletConnect connector
    const walletConnectConnector = connectors.find(c => c.id === "walletConnect");
    if (walletConnectConnector) {
      connect({ connector: walletConnectConnector });
    }
  };

  // ... rest of component
}
```

### Deep Link Handling (Android)

**AndroidManifest.xml:**
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="wc" />
</intent-filter>
```

**MainActivity.java:**
```java
@Override
public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
    String url = request.getUrl().toString();
    
    // Handle WalletConnect deep links
    if (url.startsWith("wc:") || url.startsWith("ethereum:")) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        startActivity(intent);
        return true;
    }
    
    return false;
}
```

## WalletConnect Protocol

### How It Works

1. **Pairing:** User scans QR code or uses deep link
2. **Session:** Encrypted WebSocket connection established
3. **Requests:** FarFISH sends transaction requests
4. **Approval:** User approves in wallet app
5. **Response:** Wallet sends signed transaction back
6. **Persistence:** Session persists across app restarts

### Security

- ✅ End-to-end encryption
- ✅ User controls private keys (non-custodial)
- ✅ Each session requires explicit approval
- ✅ Sessions can be revoked anytime
- ✅ No private keys ever leave wallet app

### Bridge Server

WalletConnect uses relay servers for message passing:
- Bridge URL: `wss://relay.walletconnect.com`
- Operated by WalletConnect Foundation
- Open-source protocol
- No access to user funds or private keys

## User Experience

### First-Time Connection

1. Open FarFISH Android app
2. Tap "Connect Wallet"
3. See list of wallet options:
   - WalletConnect (recommended)
   - Browser extension wallets (if available)
   - Coinbase Wallet
4. Select WalletConnect
5. Choose a wallet from the list
6. Wallet app opens automatically (deep link)
7. Review connection request in wallet
8. Approve connection
9. Wallet app closes, return to FarFISH
10. See "Connected" status

**Time:** ~10-15 seconds

### Subsequent Connections

If session persists:
1. Open FarFISH app
2. Automatically reconnects
3. No user action needed

**Time:** ~2-3 seconds

### Transactions (e.g., NFT Minting)

1. In FarFISH, click "Mint Premium Pass"
2. Wallet app opens automatically
3. Review transaction details:
   - To: NFT contract address
   - Value: Mint price + gas
   - Network: Base
4. Approve transaction
5. Return to FarFISH
6. See "Minting..." status
7. Wait for block confirmation (~2-5 seconds on Base)
8. See "Minted!" success message

### Network Switching

FarFISH primarily uses Base (Chain ID 8453). If user's wallet is on a different network:

1. FarFISH sends "switch network" request
2. Wallet app opens
3. User confirms network switch
4. Wallet switches to Base
5. Return to FarFISH
6. Transaction proceeds

**Fallback:** If wallet doesn't support Base, error message shown.

## Environment Setup

### Get WalletConnect Project ID

1. Go to https://cloud.walletconnect.com/
2. Sign up or log in
3. Create new project:
   - Name: FarFISH
   - Homepage URL: https://farfish.app
4. Copy Project ID (format: `abc123...xyz`)

### Configure Environment Variables

**.env.local (local development):**
```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

**Vercel (production):**
1. Go to Vercel project settings
2. Navigate to Environment Variables
3. Add:
   - Key: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
   - Value: Your Project ID
   - Scope: Production, Preview, Development
4. Redeploy

**Important:** Without a valid Project ID, WalletConnect will not work.

## Testing WalletConnect

### On Android Device

1. Install FarFISH APK
2. Install a wallet app (e.g., MetaMask)
3. Set up wallet (create or import)
4. Add Base network to wallet:
   - Network name: Base
   - RPC URL: https://mainnet.base.org
   - Chain ID: 8453
   - Currency: ETH
   - Block explorer: https://basescan.org
5. Open FarFISH app
6. Tap "Connect Wallet"
7. Select WalletConnect
8. Choose MetaMask
9. Approve connection
10. Test transaction (mint NFT, claim chest)

### On Android Emulator

**Limitation:** Deep links may not work in emulator. Use QR code instead:

1. Open FarFISH in emulator
2. Click "Connect Wallet" → WalletConnect
3. See QR code
4. Use physical device to scan QR with wallet app
5. Approve on physical device
6. Connection established in emulator

### Troubleshooting

**Connection fails:**
- Verify Project ID is set in environment variables
- Check that wallet app is installed
- Ensure wallet supports Base network
- Try restarting both apps

**Deep link doesn't open wallet:**
- Check AndroidManifest.xml has WalletConnect intent filter
- Verify `wc:` scheme is registered
- Try reinstalling wallet app

**Transaction rejected:**
- Check user has sufficient ETH for gas
- Verify transaction parameters in wallet
- Ensure wallet is on Base network

**Session expires:**
- WalletConnect sessions expire after inactivity
- Simply reconnect (takes ~5 seconds)

## Comparison Table

| Feature | Farcaster Connector | WalletConnect |
|---------|-------------------|---------------|
| **Platform** | Farcaster clients only | Any platform |
| **Wallet Choice** | Farcaster's wallet | 300+ wallets |
| **Setup** | Automatic in Farcaster | Manual connection |
| **Networks** | Farcaster-supported | Any EVM network |
| **Connection Time** | Instant | 10-15 sec (first time) |
| **Persistence** | While in Farcaster | Cross-session |
| **Mobile** | ✅ Yes | ✅ Yes |
| **Desktop** | ✅ Yes | ✅ Yes |
| **Security** | Farcaster-managed | User-managed |
| **Open Standard** | ❌ No | ✅ Yes |

## Migration for Existing Users

### Same Wallet Address, Different Connection

If you used FarFISH in Farcaster and now want to use the Android app:

1. **Your progress is tied to your wallet address, not Farcaster**
2. Connect the same wallet in Android app
3. All your NFTs, tokens, streak, and rank will appear
4. Nothing is lost in the migration

### Using Both Versions

You can use both the Farcaster Mini App and Android APK:

- **Farcaster Mini App:** For social features (sharing, Farcaster tasks)
- **Android APK:** For mobile access, wallet flexibility

Both connect to the same smart contracts and backend. Your progress syncs automatically.

## API and Backend

**No changes required.** All API routes use wallet address as the identifier:

```typescript
// Example API route
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');
  
  // Fetch user data by wallet address
  const userData = await getUserByWallet(wallet);
  
  return Response.json(userData);
}
```

Whether you connect via Farcaster or WalletConnect, the same wallet address identifies you.

## Future Improvements

Potential enhancements for future versions:

1. **Smart Wallet Support:** Account abstraction (ERC-4337)
2. **Multi-chain:** Expand beyond Base and Ethereum
3. **Social Recovery:** Wallet recovery via social connections
4. **Biometric Approval:** Use device biometrics for transactions
5. **Gas Sponsorship:** Gasless transactions for new users
6. **Batch Transactions:** Multiple operations in one approval

## Resources

- **WalletConnect Docs:** https://docs.walletconnect.com/
- **wagmi Docs:** https://wagmi.sh/
- **Base Network:** https://base.org/
- **Supported Wallets:** https://explorer.walletconnect.com/

## Support

For issues with wallet connection:

1. Check WalletConnect Project ID is set
2. Verify wallet app is installed and updated
3. Check wallet supports Base network
4. Review Android Logcat for errors
5. Test in browser first (simpler debugging)

---

**Key Takeaway:** WalletConnect provides a universal, secure, and user-friendly way to connect any Web3 wallet to FarFISH on Android, replacing the Farcaster-specific connector with a broader, more flexible solution.
