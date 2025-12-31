require('dotenv').config();
const { connectDB } = require('../database/connection');
const User = require('../models/User');

async function listAdmins() {
  try {
    await connectDB();
    console.log('✅ Database connected\n');

    const admins = await User.findAll({
      where: { role: 'ADMIN' },
      attributes: ['id', 'username', 'email', 'createdAt']
    });

    if (admins.length === 0) {
      console.log('ℹ️  No admin users found');
      console.log('\nDefault admin is created automatically on first deployment.');
      console.log('   Email: admin@tms.com');
      console.log('   Password: admin123');
    } else {
      console.log(`📋 Found ${admins.length} admin user(s):\n`);
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. Admin User:`);
        console.log(`   ID: ${admin.id}`);
        console.log(`   Username: ${admin.username}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Created: ${admin.createdAt.toLocaleString()}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listAdmins();

