-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sport" TEXT NOT NULL DEFAULT 'F1',
    "area" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "locality" TEXT NOT NULL DEFAULT '',
    "venueName" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "session" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "startTimeIST" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3),
    "priceINR" INTEGER,
    "bookingUrl" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "sourceTitle" TEXT NOT NULL DEFAULT '',
    "sourceSnippet" TEXT NOT NULL DEFAULT '',
    "rawText" TEXT NOT NULL DEFAULT '',
    "extractedJson" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT,
    "sport" TEXT NOT NULL DEFAULT 'F1',
    "area" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "locality" TEXT NOT NULL DEFAULT '',
    "venueName" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "session" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "startTimeIST" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3),
    "priceINR" INTEGER,
    "bookingUrl" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_candidateId_key" ON "Event"("candidateId");

-- CreateIndex
-- The public listing orders by startsAt. Without this it is a sort over every
-- published row on every page load.
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
