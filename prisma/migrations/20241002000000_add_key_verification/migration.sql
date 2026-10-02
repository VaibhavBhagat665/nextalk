-- CreateTable
CREATE TABLE "KeyVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verifiedUserId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "safetyNumber" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KeyVerification_userId_verifiedUserId_key" ON "KeyVerification"("userId", "verifiedUserId");

-- CreateIndex
CREATE INDEX "KeyVerification_userId_idx" ON "KeyVerification"("userId");

-- CreateIndex
CREATE INDEX "KeyVerification_conversationId_idx" ON "KeyVerification"("conversationId");
