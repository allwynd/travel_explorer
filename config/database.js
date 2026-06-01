const mongoose = require('mongoose');

// ─── Database Connection Manager ────────────────────────────────────────────
// Supports: MongoDB, PostgreSQL (via Sequelize), MySQL (via Sequelize)
// Set DB_TYPE in .env to switch between databases

let sequelize = null;

const connectMongoDB = async (uri) => {
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected:', uri.replace(/\/\/.*@/, '//***@'));
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

const connectSQL = async (dialect) => {
  try {
    const { Sequelize } = require('sequelize');
    const config = dialect === 'postgres'
      ? {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: process.env.POSTGRES_PORT || 5432,
          database: process.env.POSTGRES_DB || 'travel_explorer',
          username: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD || '',
        }
      : {
          host: process.env.MYSQL_HOST || 'localhost',
          port: process.env.MYSQL_PORT || 3306,
          database: process.env.MYSQL_DB || 'travel_explorer',
          username: process.env.MYSQL_USER || 'root',
          password: process.env.MYSQL_PASSWORD || '',
        };

    sequelize = new Sequelize(config.database, config.username, config.password, {
      host: config.host,
      port: config.port,
      dialect,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    });

    await sequelize.authenticate();
    console.log(`✅ ${dialect.toUpperCase()} connected at ${config.host}:${config.port}/${config.database}`);

    // Sync tables
    await sequelize.sync({ alter: true });
    console.log('✅ SQL tables synced');
  } catch (err) {
    console.error(`❌ ${dialect} connection error:`, err.message);
    process.exit(1);
  }
};

const connectDB = async () => {
  const dbType = (process.env.DB_TYPE || 'mongodb').toLowerCase();

  switch (dbType) {
    case 'mongodb':
      await connectMongoDB(process.env.MONGODB_URI || 'mongodb://localhost:27017/travel_explorer');
      break;
    case 'postgres':
    case 'postgresql':
      await connectSQL('postgres');
      break;
    case 'mysql':
      await connectSQL('mysql');
      break;
    default:
      // Fallback: in-memory store (no DB needed for demo)
      console.log('⚠️  No DB_TYPE set — using in-memory store (data lost on restart)');
  }
};

const getSequelize = () => sequelize;

module.exports = { connectDB, getSequelize };