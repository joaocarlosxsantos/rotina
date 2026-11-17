ALTER TABLE `completions` ADD `status` text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE `completions` ADD `bonus` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `completions` ADD `event_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `completions` ADD `balance_after` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- As fases anteriores tinham somente créditos positivos, sem bônus retroativo.
-- Preserva a ordem de inserção e o saldo antes de criar o novo índice único.
UPDATE `completions`
SET `event_order` = rowid,
    `balance_after` = (
      SELECT coalesce(sum(history.points), 0)
      FROM `completions` AS history
      WHERE history.rowid <= `completions`.rowid
    );--> statement-breakpoint
CREATE UNIQUE INDEX `completion_event_order` ON `completions` (`event_order`);
