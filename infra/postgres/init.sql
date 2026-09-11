-- petdate — PostgreSQL + PostGIS bootstrap
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE user_role AS ENUM (
  'pet_owner',
  'vet',
  'no_pet',
  'trainer'
);

CREATE TYPE onboarding_status AS ENUM (
  'role_selected',
  'profile_incomplete',
  'profile_complete'
);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id TEXT UNIQUE,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  username TEXT,
  role user_role,
  onboarding onboarding_status NOT NULL DEFAULT 'role_selected',
  locale TEXT NOT NULL DEFAULT 'fa',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_telegram_id ON users (telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX idx_users_role ON users (role);

CREATE TABLE pets (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT,
  age_months INT,
  bio TEXT,
  vaccinated BOOLEAN NOT NULL DEFAULT FALSE,
  neutered BOOLEAN NOT NULL DEFAULT FALSE,
  looking_for_playmate BOOLEAN NOT NULL DEFAULT TRUE,
  personality JSONB NOT NULL DEFAULT '{}',
  health JSONB NOT NULL DEFAULT '{}',
  image_url TEXT,
  location GEOGRAPHY(POINT, 4326),
  city TEXT,
  neighborhood TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pets_owner ON pets (owner_id);
CREATE INDEX idx_pets_location ON pets USING GIST (location);
CREATE INDEX idx_pets_playmate ON pets (looking_for_playmate) WHERE looking_for_playmate = TRUE;

CREATE TABLE vet_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  clinic_name TEXT,
  license_no TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  bio TEXT,
  accepts_online BOOLEAN NOT NULL DEFAULT TRUE,
  consultation_fee_cents INT NOT NULL DEFAULT 0,
  location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vet_consultations (
  id BIGSERIAL PRIMARY KEY,
  vet_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id BIGINT REFERENCES pets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vet_consultations_vet ON vet_consultations (vet_user_id, created_at DESC);

CREATE TABLE playdate_requests (
  id BIGSERIAL PRIMARY KEY,
  from_pet_id BIGINT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  to_pet_id BIGINT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_pet_id, to_pet_id)
);

CREATE TABLE media_objects (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime_type TEXT,
  owner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  pet_id BIGINT REFERENCES pets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bucket, object_key)
);
