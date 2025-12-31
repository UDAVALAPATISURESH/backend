require('dotenv').config();
const { Op } = require('sequelize');
const { connectDB } = require('../database/connection');
const User = require('../models/User');

async function deleteAdmin() {
  try {
    await connectDB();
    console.log('✅ Database connected\n');

    const email = process.argv[2];

    if (!email) {
      console.log('Usage: node scripts/delete-admin.js <email>');
      console.log('Example: node scripts/delete-admin.js admin@example.com');
      process.exit(1);
    }

    // Find admin by email
    const admin = await User.findOne({
      where: {
        email: email.toLowerCase(),
        role: 'ADMIN'
      }
    });

    if (!admin) {
      console.log(`❌ Admin user with email "${email}" not found`);
      process.exit(1);
    }

    console.log('⚠️  Found admin user:');
    console.log(`   ID: ${admin.id}`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);

    // Check if there are other admins
    const otherAdmins = await User.count({
      where: {
        role: 'ADMIN',
        id: { [Op.ne]: admin.id }
      }
    });

    if (otherAdmins === 0) {
      console.log('\n⚠️  WARNING: This is the only admin user!');
      console.log('   Deleting this admin will leave you with no admin access.');
      console.log('   Make sure you have another admin account before proceeding.');
      console.log('\n   To create a new admin:');
      console.log('   1. Login with default admin (admin@tms.com / admin123)');
      console.log('   2. Go to User Management');
      console.log('   3. Click "Add User" and select Admin role');
    }

    // Delete admin
    await admin.destroy();

    console.log(`\n✅ Admin user "${email}" deleted successfully`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteAdmin();

