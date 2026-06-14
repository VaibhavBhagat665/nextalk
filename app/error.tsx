"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#1A1714] text-[#F2EDE7] p-4 text-center">
      <div className="max-w-md space-y-4">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
        </div>
        <h2 className="text-2xl font-bold font-['Fredoka']">Something went wrong!</h2>
        <p className="text-[#8A827A] whitespace-pre-wrap font-mono text-sm bg-black/20 p-4 rounded-lg text-left overflow-auto max-h-64">
          {error.message || "An unexpected error occurred."}
          {error.digest && `\nDigest: ${error.digest}`}
        </p>
        <button
          onClick={() => reset()}
          className="mt-6 px-6 py-2 bg-[#8B7D6B] text-white rounded-lg hover:bg-[#a1927d] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
