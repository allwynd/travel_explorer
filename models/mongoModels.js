const mongoose = require('mongoose');

// ─── Trip Schema ─────────────────────────────────────────────────────────────
const tripSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  destination: { type: String, required: true, trim: true },
  startDate: { type: Date },
  endDate: { type: Date },
  currency: { type: String, default: 'USD', enum: ['USD','EUR','GBP','AUD','NZD','JPY','CAD','SGD','THB','IDR','MYR','PHP','VND','INR','CNY','HKD','KRW'] },
  budget: { type: Number, default: 0, min: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true, toJSON: { virtuals: true } });

// ─── Expense Schema ───────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  'accommodation', 'flights', 'food', 'transport', 'shopping',
  'activities', 'health', 'communication', 'visa', 'insurance', 'other'
];

const expenseSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  category: { type: String, required: true, enum: EXPENSE_CATEGORIES },
  description: { type: String, default: '', trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  paymentMethod: { type: String, default: 'cash', enum: ['cash', 'card', 'digital', 'other'] },
  notes: { type: String, default: '' },
}, { timestamps: true, toJSON: { virtuals: true } });

const Trip = mongoose.models.Trip || mongoose.model('Trip', tripSchema);
const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);

module.exports = { Trip, Expense, EXPENSE_CATEGORIES };
