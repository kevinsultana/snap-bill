const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Auto-migrate payment tracking columns and generate client if needed
(async function initSchema() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "amount_paid" DECIMAL(15, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "payment_date" DATE;
    `);

    // Check if client runtime already knows amount_paid
    const fields = prisma._runtimeDataModel?.models?.Invoice?.fields || [];
    const hasAmountPaid = fields.some((f) => f.name === 'amount_paid');
    if (!hasAmountPaid) {
      console.log('[prisma] Generating updated Prisma Client with amount_paid & payment_date...');
      execSync('npx prisma generate', {
        cwd: path.resolve(__dirname, '../..'),
        stdio: 'inherit',
      });
    }
  } catch (err) {
    console.warn('[prisma] Schema self-check notice:', err.message);
  }
})();

module.exports = prisma;
