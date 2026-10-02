-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "session_kind" AS ENUM ('free_roam', 'race');

-- CreateEnum
CREATE TYPE "session_end_reason" AS ENUM ('car_changed', 'race_started', 'race_ended', 'race_restarted', 'idle', 'shutdown', 'interrupted');

-- CreateEnum
CREATE TYPE "car_class" AS ENUM ('D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X');

-- CreateEnum
CREATE TYPE "drivetrain" AS ENUM ('FWD', 'RWD', 'AWD');

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "kind" "session_kind" NOT NULL,
    "car_ordinal" INTEGER NOT NULL,
    "car_class" "car_class",
    "car_performance_index" INTEGER NOT NULL,
    "car_drivetrain" "drivetrain",
    "car_cylinders" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "end_reason" "session_end_reason",
    "driving_seconds" DOUBLE PRECISION,
    "distance_meters" DOUBLE PRECISION,
    "max_speed" DOUBLE PRECISION,
    "max_lateral_g" DOUBLE PRECISION,
    "max_acceleration_g" DOUBLE PRECISION,
    "max_braking_g" DOUBLE PRECISION,
    "lap_count" INTEGER NOT NULL DEFAULT 0,
    "best_lap_seconds" DOUBLE PRECISION,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laps" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "time_seconds" DOUBLE PRECISION NOT NULL,
    "distance_meters" DOUBLE PRECISION NOT NULL,
    "is_complete" BOOLEAN NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "max_speed" DOUBLE PRECISION NOT NULL,
    "average_speed" DOUBLE PRECISION NOT NULL,
    "max_lateral_g" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "laps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lap_traces" (
    "lap_id" UUID NOT NULL,
    "step" REAL NOT NULL,
    "elapsed" REAL[],
    "speed" REAL[],
    "rpm" REAL[],
    "throttle" REAL[],
    "brake" REAL[],
    "gear" REAL[],
    "steer" REAL[],
    "lateral_g" REAL[],
    "longitudinal_g" REAL[],
    "x" REAL[],
    "z" REAL[],

    CONSTRAINT "lap_traces_pkey" PRIMARY KEY ("lap_id")
);

-- CreateIndex
CREATE INDEX "sessions_started_at_id_idx" ON "sessions"("started_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "laps_session_id_number_key" ON "laps"("session_id", "number");

-- AddForeignKey
ALTER TABLE "laps" ADD CONSTRAINT "laps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lap_traces" ADD CONSTRAINT "lap_traces_lap_id_fkey" FOREIGN KEY ("lap_id") REFERENCES "laps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
