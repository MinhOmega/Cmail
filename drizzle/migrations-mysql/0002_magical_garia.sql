ALTER TABLE `app_settings` MODIFY COLUMN `app_name` longtext NOT NULL DEFAULT ('Cmail');--> statement-breakpoint
ALTER TABLE `app_settings` ADD `accent_color` longtext;--> statement-breakpoint
ALTER TABLE `messages` ADD `verification_code` longtext;