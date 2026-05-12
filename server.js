import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import rsvpHandler from './api/rsvp.js';
import adminHandler from './api/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all('/api/rsvp', (req, res) => rsvpHandler(req, res));
app.all('/admin', (req, res) => adminHandler(req, res));
app.all('/api/admin', (req, res) => adminHandler(req, res));

app.get('/rayyan-birthday.ics', (req, res) => {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="rayyan-birthday.ics"');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(join(__dirname, 'public', 'rayyan-birthday.ics'));
});

app.use(express.static(join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
