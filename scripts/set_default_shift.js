/**
 * One-shot script: set shift_start=09:00, shift_end=16:30 for ALL employees.
 * Run: node scripts/set_default_shift.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../shared/models/Employee');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const result = await Employee.updateMany(
    {}, // all employees
    { $set: { shift_start: '09:00', shift_end: '16:30' } }
  );

  console.log(`Updated ${result.modifiedCount} of ${result.matchedCount} employee(s).`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
