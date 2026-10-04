import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";

import BottomNav from "./components/BottomNav";
import Footer from "./components/Footer";
import WalletProvider from "./providers/WalletProvider";
import AutoBindReferral from "./components/AutoBindReferral";
import ErrorBoundary from "./components/ErrorBoundary";
import ToastProvider from "./providers/ToastProvider";
import AppStateProvider from "./providers/AppStateProvider";

export const metadata: Metadata = {
  icons: {
    icon: "/icon.png",
  },
  other: {
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col relative items-center overflow-x-hidden text-white">
        <ErrorBoundary>
          <WalletProvider>
            <AppStateProvider>
              <ToastProvider>
                <AutoBindReferral />

                <div className="w-full max-w-md min-h-screen flex flex-col relative z-10">
                  <main
                    className="flex-1"
                    style={{
                      paddingTop: "env(safe-area-inset-top, 0px)",
                    }}
                  >
                    <div
                      style={{
                        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8rem)",
                      }}
                    >
                      {children}
                    </div>
                    <Footer />
                  </main>
                </div>

                <BottomNav />
              </ToastProvider>
            </AppStateProvider>
          </WalletProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}