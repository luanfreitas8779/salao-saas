/*
  Warnings:

  - A unique constraint covering the columns `[token_hash]` on the table `passwordResetToken` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "passwordResetToken_token_hash_key" ON "passwordResetToken"("token_hash");
