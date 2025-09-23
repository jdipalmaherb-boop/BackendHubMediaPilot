import "./globals.css";
import { ReactNode } from "react";
import Link from "next/link";
import NotificationBell from "../components/NotificationBell";
import SessionProvider from "../components/SessionProvider";

export const metadata = {
  title: "Social App",
  description: "Social media management platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <nav className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <Link href="/" className="text-xl font-bold text-gray-900">
                    Social App
                  </Link>
                </div>
                <div className="flex items-center space-x-8">
                  <Link href="/posts" className="text-gray-600 hover:text-gray-900">
                    Posts
                  </Link>
                  <Link href="/composer" className="text-gray-600 hover:text-gray-900">
                    Composer
                  </Link>
                  <Link href="/analytics" className="text-gray-600 hover:text-gray-900">
                    Analytics
                  </Link>
                  <Link href="/notifications-test" className="text-gray-600 hover:text-gray-900">
                    Test Notifications
                  </Link>
                  <NotificationBell orgId="org_123" />
                </div>
              </div>
            </div>
          </nav>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
