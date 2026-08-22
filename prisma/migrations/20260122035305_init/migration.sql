-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confidence" REAL NOT NULL DEFAULT 0.0,
    "sport" TEXT NOT NULL DEFAULT 'F1',
    "area" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "locality" TEXT NOT NULL DEFAULT '',
    "venueName" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "session" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "startTimeIST" TEXT NOT NULL DEFAULT '',
    "priceINR" INTEGER NOT NULL DEFAULT 0,
    "bookingUrl" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "sourceTitle" TEXT NOT NULL DEFAULT '',
    "sourceSnippet" TEXT NOT NULL DEFAULT '',
    "rawText" TEXT NOT NULL DEFAULT '',
    "extractedJson" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT,
    "sport" TEXT NOT NULL DEFAULT 'F1',
    "area" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "locality" TEXT NOT NULL DEFAULT '',
    "venueName" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "session" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "startTimeIST" TEXT NOT NULL DEFAULT '',
    "priceINR" INTEGER NOT NULL DEFAULT 0,
    "bookingUrl" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_candidateId_key" ON "Event"("candidateId");
