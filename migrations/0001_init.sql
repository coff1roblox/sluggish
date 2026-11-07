-- Every stamp and every redeemed free drink is one row.
-- A customer's balance is SUM(delta) over rows that were not undone,
-- so undo is just flipping a flag and the history is never lost.
CREATE TABLE events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  phone  TEXT    NOT NULL,                       -- 8-digit Kuwait number, no +965
  kind   TEXT    NOT NULL CHECK (kind IN ('stamp', 'redeem')),
  delta  INTEGER NOT NULL,                       -- +n for stamps, -4 for a redeemed drink
  at     INTEGER NOT NULL,                       -- unix ms
  undone INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX events_by_phone ON events (phone, id);

-- Fixed-window counters for lookup throttling and staff passcode lockout.
CREATE TABLE rate_limits (
  key      TEXT    PRIMARY KEY,
  hits     INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
