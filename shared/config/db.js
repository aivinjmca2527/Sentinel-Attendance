const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Employee = require('../models/Employee');
const Department = require('../models/Department');

const { MongoMemoryServer } = require('mongodb-memory-server');

const MONGO_URI = process.env.MONGO_URI || '';

async function connectDB() {
  try {
    let uri = MONGO_URI;
    if (!uri || uri.includes('replace-with')) {
        const mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
        console.log('[DB] Using In-Memory MongoDB');
    }
    
    await mongoose.connect(uri);
    console.log('[DB] MongoDB connected');
  } catch (err) {
    console.error('[DB] MongoDB connection error:', err);
    process.exit(1);
  }
}

async function seedIfEmpty() {
  const count = await Department.countDocuments();
  if (count > 0) return;

  console.log('[DB] Seeding initial data for Mongoose...');

  const hr = await Department.create({ department_name: 'Human Resources' });
  const eng = await Department.create({ department_name: 'Engineering' });

  const adminPass = bcrypt.hashSync('Admin@123', 10);
  const employeePass = bcrypt.hashSync('Mary@123', 10);

  const adminUser = await User.create({
    name: 'Alex Reyes',
    email: 'admin@sentinel.com',
    password_hash: adminPass,
    role: 'admin',
    totp_enabled: false
  });

  const empUser = await User.create({
    name: 'Mary Lee',
    email: 'mary.lee@sentinel.com',
    password_hash: employeePass,
    role: 'employee',
    totp_enabled: false
  });

  await Employee.create({
    user_id: adminUser._id,
    department_id: hr._id,
    designation: 'HR Admin',
    contact_number: '+1-555-0103',
    date_of_joining: new Date('2019-11-20'),
    status: 'active'
  });

  await Employee.create({
    user_id: empUser._id,
    department_id: eng._id,
    designation: 'Software Engineer',
    contact_number: '+1-555-0104',
    date_of_joining: new Date('2022-01-10'),
    status: 'active'
  });

  console.log('[DB] Seed complete.');
}

let ready = false;
const initPromise = connectDB().then(seedIfEmpty).then(() => { ready = true; });

module.exports = { initPromise };
