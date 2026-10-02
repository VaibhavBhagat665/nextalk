"use client";

import { useState, useEffect, useRef } from "react";
import { X, Shield, Check, QrCode, Camera, AlertCircle } from "lucide-react";
import { generateSafetyNumber, generateQRCodeData, verifyQRCodeData, base64ToBytes } from "@nextalk/crypto";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";

interface KeyVerificationModalProps {
  userId: string;
  username: string;
  myUserId: string;
  myPublicKey: string;
  theirPublicKey: string;
  isVerified: boolean;
  onClose: () => void;
  onVerify: (verified: boolean) => void;
}

export default function KeyVerificationModal({
  userId,
  username,
  myUserId,
  myPublicKey,
  theirPublicKey,
  isVerified,
  onClose,
  onVerify,
}: KeyVerificationModalProps) {
  const [safetyNumber, setSafetyNumber] = useState<string>("");
  const [qrCodeData, setQrCodeData] = useState<string>("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [localVerified, setLocalVerified] = useState(isVerified);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerDivId = "qr-reader";

  useEffect(() => {
    try {
      const myKey = base64ToBytes(myPublicKey);
      const theirKey = base64ToBytes(theirPublicKey);
      
      // Generate safety number
      const safety = generateSafetyNumber(myKey, theirKey);
      setSafetyNumber(safety);
      
      // Generate QR code data
      const qrData = generateQRCodeData(myKey, theirKey, myUserId, userId);
      setQrCodeData(qrData);
    } catch (error) {
      console.error("Failed to generate safety number:", error);
    }
  }, [myPublicKey, theirPublicKey, myUserId, userId]);

  // Cleanup scanner on unmount or when closing scanner
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch((err) => console.error("Error stopping scanner:", err));
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      setIsScanning(true);
      setScanError(null);
      
      const html5QrCode = new Html5Qrcode(readerDivId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // QR code successfully scanned
          handleQRScan(decodedText);
          stopScanning();
        },
        (errorMessage) => {
          // Scanning error - this is normal, just means no QR code detected yet
          // We don't need to show this to the user
        }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setScanError("Failed to start camera. Please check camera permissions.");
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current = null;
          setIsScanning(false);
        })
        .catch((err) => {
          console.error("Error stopping scanner:", err);
          setIsScanning(false);
        });
    }
  };

  const handleVerifyManually = async () => {
    // User has manually compared the numbers
    setLocalVerified(true);
    
    // Save to backend
    try {
      await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verifiedUserId: userId,
          verified: true,
          safetyNumber,
        }),
      });
    } catch (error) {
      console.error("Failed to save verification status:", error);
    }
    
    onVerify(true);
  };

  const handleUnverify = async () => {
    setLocalVerified(false);
    
    // Save to backend
    try {
      await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verifiedUserId: userId,
          verified: false,
          safetyNumber,
        }),
      });
    } catch (error) {
      console.error("Failed to save verification status:", error);
    }
    
    onVerify(false);
  };

  const handleQRScan = (scannedData: string) => {
    try {
      const myKey = base64ToBytes(myPublicKey);
      const theirKey = base64ToBytes(theirPublicKey);
      
      const result = verifyQRCodeData(
        scannedData,
        myUserId,
        userId,
        myKey,
        theirKey
      );
      
      if (result.valid) {
        setLocalVerified(true);
        
        // Save to backend
        fetch("/api/verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verifiedUserId: userId,
            verified: true,
            safetyNumber: result.safetyNumber,
          }),
        }).catch((error) => {
          console.error("Failed to save verification status:", error);
        });
        
        onVerify(true);
        setScanError(null);
        setShowQRScanner(false);
      } else {
        setScanError(result.error || "QR code verification failed");
      }
    } catch (error) {
      setScanError("Invalid QR code format");
    }
  };

  const handleCloseScanner = () => {
    stopScanning();
    setShowQRScanner(false);
    setScanError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1714] border border-[#d4a23c]/20 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#d4a23c]/20 to-purple-500/20 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/40 text-white/70 hover:text-white p-1.5 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#d4a23c]/20 rounded-full">
              <Shield size={24} className="text-[#d4a23c]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Verify Safety Number</h2>
              <p className="text-sm text-zinc-400">with {username}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Badge */}
          {localVerified && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <Check size={16} className="text-green-500" />
              <span className="text-sm text-green-400">This conversation is verified</span>
            </div>
          )}

          {/* Safety Number Display */}
          <div className="space-y-3">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Compare this safety number with {username}&apos;s device. If the numbers match, your conversation is secure.
            </p>
            
            <div className="bg-white/5 rounded-lg p-4 border border-[#d4a23c]/20">
              <div className="font-mono text-lg text-[#d4a23c] text-center leading-relaxed tracking-wide">
                {safetyNumber}
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          {!showQRScanner && (
            <div className="space-y-3">
              <div className="h-px w-full bg-white/5" />
              
              <div className="space-y-2">
                <p className="text-sm text-zinc-400">
                  Or share your QR code with {username}
                </p>
                
                {showQRCode && qrCodeData ? (
                  <div className="bg-white p-4 rounded-lg flex flex-col items-center justify-center space-y-3">
                    <QRCodeSVG
                      value={qrCodeData}
                      size={200}
                      level="M"
                      includeMargin={true}
                    />
                    <button
                      onClick={() => setShowQRCode(false)}
                      className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Hide QR Code
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowQRCode(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                  >
                    <QrCode size={16} />
                    Show My QR Code
                  </button>
                )}
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-[#1a1714] text-zinc-500">or</span>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setShowQRScanner(true);
                    setTimeout(() => startScanning(), 100);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#d4a23c]/10 hover:bg-[#d4a23c]/20 text-[#d4a23c] rounded-lg transition-colors border border-[#d4a23c]/30"
                >
                  <Camera size={16} />
                  Scan {username}&apos;s QR Code
                </button>
              </div>
            </div>
          )}

          {/* QR Scanner Section */}
          {showQRScanner && (
            <div className="space-y-3">
              <div className="bg-white/5 rounded-lg p-4 border border-[#d4a23c]/20">
                {!isScanning ? (
                  <div className="text-center space-y-3">
                    <Camera size={48} className="mx-auto text-zinc-400" />
                    <p className="text-sm text-zinc-400">Initializing camera...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-zinc-400 text-center mb-2">
                      Point your camera at {username}&apos;s QR code
                    </p>
                    <div id={readerDivId} className="w-full" />
                  </div>
                )}
              </div>
              
              {scanError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-400">{scanError}</span>
                </div>
              )}
              
              <button
                onClick={handleCloseScanner}
                className="w-full py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel Scanning
              </button>
            </div>
          )}

          {/* Action Buttons */}
          {!showQRScanner && (
            <div className="flex gap-3">
              {localVerified ? (
                <button
                  onClick={handleUnverify}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                >
                  Unverify
                </button>
              ) : (
                <button
                  onClick={handleVerifyManually}
                  className="flex-1 py-2.5 bg-[#d4a23c] hover:bg-[#c59537] text-[#1a1400] font-semibold rounded-lg transition-all shadow-[0_0_15px_rgba(212,162,60,0.2)]"
                >
                  Mark as Verified
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
