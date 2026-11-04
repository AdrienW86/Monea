export const localMigrations = [
  {
    version: 1,
    sql: `
CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS services(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,category_id TEXT NOT NULL REFERENCES categories(id),data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES categories(id),data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS clients(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS time_allocations(id TEXT PRIMARY KEY,start_at TEXT NOT NULL,end_at TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN('hold','booking','manual','block')),state TEXT NOT NULL CHECK(state IN('active','expired','cancelled')),expires_at TEXT,reason TEXT NOT NULL DEFAULT '',series_id TEXT,demo INTEGER NOT NULL DEFAULT 0,CHECK(start_at<end_at));
CREATE INDEX IF NOT EXISTS allocations_time ON time_allocations(state,start_at,end_at);
CREATE TRIGGER IF NOT EXISTS allocation_insert BEFORE INSERT ON time_allocations WHEN NEW.state='active' AND EXISTS(SELECT 1 FROM time_allocations a WHERE a.state='active' AND a.start_at<NEW.end_at AND a.end_at>NEW.start_at) BEGIN SELECT RAISE(ABORT,'ALLOCATION_CONFLICT'); END;
CREATE TRIGGER IF NOT EXISTS allocation_update BEFORE UPDATE ON time_allocations WHEN NEW.state='active' AND EXISTS(SELECT 1 FROM time_allocations a WHERE a.id<>NEW.id AND a.state='active' AND a.start_at<NEW.end_at AND a.end_at>NEW.start_at) BEGIN SELECT RAISE(ABORT,'ALLOCATION_CONFLICT'); END;
CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,public_token TEXT NOT NULL UNIQUE,request_id TEXT NOT NULL UNIQUE,allocation_id TEXT NOT NULL UNIQUE REFERENCES time_allocations(id),client_id TEXT NOT NULL REFERENCES clients(id),data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS booking_lines(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,service_id TEXT NOT NULL REFERENCES services(id),position INTEGER NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS business_hours(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS special_hours(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE IF NOT EXISTS rate_limits(id TEXT PRIMARY KEY,window_at INTEGER NOT NULL,count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS local_sessions(id TEXT PRIMARY KEY,expires_at INTEGER NOT NULL,identity_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS generated_days(id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)));
`,
  },
];
