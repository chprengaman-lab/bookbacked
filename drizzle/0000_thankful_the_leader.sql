CREATE TABLE `nfl_snapshot_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`cache_date` text NOT NULL,
	`horizon_days` integer NOT NULL,
	`max_games` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`payload` text NOT NULL
);
