const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Change That Works API running' });
});

// ── POST /responses — save a response ─────────────────────────────────────
app.post('/responses', async (req, res) => {
  try {
    const {
      teamId, customerId, submittedAt,
      scores, simulated
    } = req.body;

    if (!teamId || !scores) {
      return res.status(400).json({ ok: false, error: 'Missing teamId or scores' });
    }

    await pool.query(
      `INSERT INTO responses
        (team_id, customer_id, submitted_at, status, certainty, autonomy, relatedness, fairness, simulated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        teamId,
        customerId || '',
        submittedAt || new Date().toISOString(),
        scores.status    || 0,
        scores.certainty || 0,
        scores.autonomy  || 0,
        scores.relatedness || 0,
        scores.fairness  || 0,
        simulated ? true : false,
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /responses error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /responses?teamId=xxx — read responses for a team ──────────────────
app.get('/responses', async (req, res) => {
  try {
    const { teamId } = req.query;

    let query, params;
    if (teamId) {
      query = `SELECT * FROM responses WHERE team_id = $1 ORDER BY submitted_at ASC`;
      params = [teamId];
    } else {
      query = `SELECT * FROM responses ORDER BY submitted_at ASC`;
      params = [];
    }

    const result = await pool.query(query, params);

    // Map snake_case DB columns to camelCase for the app
    const rows = result.rows.map(r => ({
      teamId:      r.team_id,
      customerId:  r.customer_id,
      submittedAt: r.submitted_at,
      simulated:   r.simulated,
      scores: {
        status:      parseFloat(r.status),
        certainty:   parseFloat(r.certainty),
        autonomy:    parseFloat(r.autonomy),
        relatedness: parseFloat(r.relatedness),
        fairness:    parseFloat(r.fairness),
      }
    }));

    res.json({ ok: true, rows });
  } catch (err) {
    console.error('GET /responses error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /responses?teamId=xxx — clear responses for a team ─────────────
app.delete('/responses', async (req, res) => {
  try {
    const { teamId } = req.query;
    if (!teamId) return res.status(400).json({ ok: false, error: 'Missing teamId' });
    await pool.query(`DELETE FROM responses WHERE team_id = $1`, [teamId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Start
app.listen(PORT, () => {
  console.log(`Change That Works API listening on port ${PORT}`);
});
