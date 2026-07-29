-- migrate:up
-- Employee attendance + monthly salary -------------------------------------

-- Monthly salary (₹) used for payroll estimates from attendance.
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'PRESENT'
                    CHECK (status IN ('PRESENT','ABSENT','HALF_DAY','LEAVE','WEEKLY_OFF')),
  check_in        TIMESTAMPTZ,
  check_out       TIMESTAMPTZ,
  worked_minutes  INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  marked_by       UUID,                            -- who recorded it (self or admin)

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One record per staff per day.
CREATE UNIQUE INDEX uq_attendance_user_date ON attendance(tenant_id, user_id, work_date);
CREATE INDEX idx_attendance_tenant_date ON attendance(tenant_id, work_date DESC);
CREATE INDEX idx_attendance_user ON attendance(user_id, work_date DESC);

CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- migrate:down
DROP TABLE IF EXISTS attendance CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS monthly_salary;
