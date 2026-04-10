require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/exams',       require('./routes/exams'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/teacher',     require('./routes/teacher'));
app.use('/api/videos',        require('./routes/videos'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/landing',       require('./routes/landing'));
app.use('/api/landing',       require('./routes/landing'));
app.use('/api/landing',       require('./routes/landing'));

app.get('/api/health', (_,res) => res.json({ status:'ok' }));
app.use((req,res) => res.status(404).json({ message:'Route not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
