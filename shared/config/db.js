const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    console.error('The server will continue running but database operations will fail.');
    console.error('Please check your network connection and MongoDB Atlas cluster status.');
  }
};

module.exports = connectDB;
