const { Sequelize } = require('sequelize');
require('dotenv').config();

// Support both PostgreSQL (Render) and MySQL (local)
let sequelize;

if (process.env.DATABASE_URL) {
  // PostgreSQL connection (Render.com)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  // MySQL connection (local development)
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || 3306;
  const dbName = process.env.DB_NAME || 'tms_db';
  const dbUser = process.env.DB_USER || 'root';
  const dbPassword = process.env.DB_PASSWORD || '';

  sequelize = new Sequelize(dbName, dbUser, dbPassword, {
    host: dbHost,
    port: dbPort,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
}

const connectDB = async () => {
  try {
    // Test connection
    await sequelize.authenticate();
    const dbType = process.env.DATABASE_URL ? 'PostgreSQL' : 'MySQL';
    const dbInfo = process.env.DATABASE_URL 
      ? process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'connected'
      : `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'tms_db'}`;
    
    console.log(`✅ ${dbType} Connected: ${dbInfo}`);

    // Sync database (create tables if they don't exist)
    await sequelize.sync({ alter: false });
    console.log('✅ Database tables ready');

    return sequelize;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    if (error.message.includes('Access denied') || error.message.includes('ER_ACCESS_DENIED_ERROR')) {
      console.error('💡 Database authentication error!');
      console.error('💡 Check database credentials in environment variables');
    } else if (error.message.includes('Unknown database') || error.message.includes('ER_BAD_DB_ERROR')) {
      console.error('💡 Database does not exist!');
      console.error('💡 Create database first');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Cannot connect to database server!');
      console.error('💡 Make sure database is running');
    }
    process.exit(1);
  }
};

module.exports = { connectDB, sequelize };
