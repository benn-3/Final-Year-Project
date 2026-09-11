const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDB() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database is successfully connected.');
  } catch (e) {
    console.error('❌ Database connection failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

checkDB();
