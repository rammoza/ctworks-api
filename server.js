const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => res.json({ ok: true, message: 'Change That Works API v3' }));

/* ── CUSTOMERS ─────────────────────────────────────────────────────────── */
app.get('/customers', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM customers ORDER BY created_at ASC');
    res.json({ ok: true, customers: r.rows });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/customers', async (req, res) => {
  try {
    const { id, name, createdAt, config } = req.body;
    await pool.query(
      `INSERT INTO customers (id, name, created_at, config)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name=$2, config=$4`,
      [id, name, createdAt || new Date().toISOString(), JSON.stringify(config || {})]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.delete('/customers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM responses WHERE customer_id=$1', [req.params.id]);
    await pool.query('DELETE FROM teams WHERE customer_id=$1', [req.params.id]);
    await pool.query('DELETE FROM customers WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ── TEAMS ─────────────────────────────────────────────────────────────── */
app.get('/teams', async (req, res) => {
  try {
    const { customerId } = req.query;
    const r = customerId
      ? await pool.query('SELECT * FROM teams WHERE customer_id=$1 ORDER BY created_at ASC', [customerId])
      : await pool.query('SELECT * FROM teams ORDER BY created_at ASC');
    res.json({ ok: true, teams: r.rows });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/teams', async (req, res) => {
  try {
    const { id, customerId, name, createdAt } = req.body;
    await pool.query(
      `INSERT INTO teams (id, customer_id, name, created_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name=$3`,
      [id, customerId, name, createdAt || new Date().toISOString()]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.delete('/teams/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM responses WHERE team_id=$1', [req.params.id]);
    await pool.query('DELETE FROM teams WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ── RESPONSES ─────────────────────────────────────────────────────────── */
app.post('/responses', async (req, res) => {
  try {
    const { teamId, teamName, customerId, customerName, submittedAt, scores, simulated } = req.body;
    if (!teamId || !scores) return res.status(400).json({ ok: false, error: 'Missing teamId or scores' });
    await pool.query(
      `INSERT INTO responses
        (team_id, team_name, customer_id, customer_name, submitted_at,
         status, certainty, autonomy, relatedness, fairness, simulated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        teamId, teamName||'', customerId||'', customerName||'',
        submittedAt || new Date().toISOString(),
        scores.status||0, scores.certainty||0, scores.autonomy||0,
        scores.relatedness||0, scores.fairness||0,
        simulated||false,
      ]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/responses', async (req, res) => {
  try {
    const { teamId } = req.query;
    const r = teamId
      ? await pool.query('SELECT * FROM responses WHERE team_id=$1 ORDER BY submitted_at ASC', [teamId])
      : await pool.query('SELECT * FROM responses ORDER BY submitted_at ASC');
    const rows = r.rows.map(r => ({
      teamId:       r.team_id,
      teamName:     r.team_name,
      customerId:   r.customer_id,
      customerName: r.customer_name,
      submittedAt:  r.submitted_at,
      simulated:    r.simulated,
      scores: {
        status:      +r.status,
        certainty:   +r.certainty,
        autonomy:    +r.autonomy,
        relatedness: +r.relatedness,
        fairness:    +r.fairness,
      }
    }));
    res.json({ ok: true, rows });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.delete('/responses', async (req, res) => {
  try {
    const { teamId } = req.query;
    if (!teamId) return res.status(400).json({ ok: false, error: 'Missing teamId' });
    await pool.query('DELETE FROM responses WHERE team_id=$1', [teamId]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.listen(PORT, () => console.log(`CTWorks API v3 on port ${PORT}`));
