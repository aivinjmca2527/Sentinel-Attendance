const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  department_name: { type: String, required: true, unique: true },
  // Nullable on purpose — Department and Employee reference each other. Seed order: 
  // create department with manager_id null -> create its employees -> update 
  // manager_id after.
  manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null }
});

module.exports = mongoose.model('Department', departmentSchema);
