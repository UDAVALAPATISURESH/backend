// Seed data - creates default admin if no users exist
const User = require('../models/User');

const initializeSampleData = async () => {
  try {
    // Check if any users exist
    const userCount = await User.count();
    
    if (userCount === 0) {
      console.log('📝 No users found - creating default admin...');
      
      // Create default admin
      const defaultAdmin = await User.create({
        username: 'admin',
        email: 'admin@tms.com',
        password: 'admin123', // Will be hashed automatically
        role: 'ADMIN',
        scopes: [] // Admin has all access
      });
      
      console.log('✅ Default admin created:');
      console.log(`   Email: ${defaultAdmin.email}`);
      console.log(`   Username: ${defaultAdmin.username}`);
      console.log(`   Password: admin123`);
      console.log('\n⚠️  IMPORTANT:');
      console.log('   1. Login with default admin credentials');
      console.log('   2. Create your real admin account');
      console.log('   3. Delete default admin: npm run delete-admin admin@tms.com');
      console.log('   4. Keep your credentials secure!');
    } else {
      console.log(`ℹ️  Users already exist (${userCount} users)`);
      console.log('   No default admin will be created');
    }
  } catch (error) {
    console.error('❌ Error initializing default admin:', error.message);
    // Don't exit - allow server to start even if admin creation fails
  }
};

module.exports = { initializeSampleData };
