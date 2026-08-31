const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./shared/config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB Atlas
connectDB();

// Serve static templates
app.use(express.static(path.join(__dirname, 'Templates')));

// Routes (Commented out with owner tags)
// app.use('/api/auth', require('./modules/auth/routes'));            // Nandana
// app.use('/api/employees', require('./modules/employees/routes'));  // Nandana
// app.use('/api/attendance', require('./modules/attendance/routes')); // Aivin
// app.use('/api/qr', require('./modules/qr/routes'));                // Aivin
app.use('/api/dashboard', require('./modules/dashboard/routes'));  // Amina
app.use('/api/reports', require('./modules/reports/routes'));      // Amina
// app.use('/api/leave', require('./modules/leave/routes'));          // Melbin

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
