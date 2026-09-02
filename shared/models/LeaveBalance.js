const mongoose = require('mongoose');

/**
 * LeaveBalance — tracks available leave per employee per type.
 *
 * A record is auto-initialised by the leave controller the first time
 * an employee views their balance or submits a request.
 *
 * `total`  = yearly allocation (can be adjusted by admin in the future)
 * `used`   = days consumed by approved requests
 * `available` = virtual getter (total − used)
 */
const leaveBalanceSchema = new mongoose.Schema({
  employee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  leave_type: {
    type: String,
    enum: ['sick', 'casual', 'earned'],
    required: true,
  },
  total: { type: Number, required: true, default: 0 },
  used:  { type: Number, required: true, default: 0 },
}, { timestamps: true });

// Each employee has one balance record per leave type
leaveBalanceSchema.index({ employee_id: 1, leave_type: 1 }, { unique: true });

// Virtual: remaining balance
leaveBalanceSchema.virtual('available').get(function () {
  return this.total - this.used;
});

// Include virtuals in JSON / plain-object output
leaveBalanceSchema.set('toJSON',   { virtuals: true });
leaveBalanceSchema.set('toObject', { virtuals: true });

/**
 * Default yearly allocations per leave type.
 * Used when auto-initialising balance for a new employee.
 */
leaveBalanceSchema.statics.DEFAULTS = {
  sick:   10,
  casual: 10,
  earned: 15,
};

/**
 * Ensures balance records exist for the given employee.
 * Creates missing records with default totals.
 * Returns all three balance docs (sick, casual, earned).
 */
leaveBalanceSchema.statics.ensureBalances = async function (employeeId) {
  const types = Object.keys(this.DEFAULTS);
  const existing = await this.find({ employee_id: employeeId }).lean();
  const existingTypes = existing.map((b) => b.leave_type);

  const missing = types.filter((t) => !existingTypes.includes(t));
  if (missing.length > 0) {
    const docs = missing.map((t) => ({
      employee_id: employeeId,
      leave_type:  t,
      total:       this.DEFAULTS[t],
      used:        0,
    }));
    await this.insertMany(docs, { ordered: false }).catch(() => {
      // Ignore duplicate-key errors (race condition safe)
    });
  }

  return this.find({ employee_id: employeeId }).lean();
};

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
