-- Polls: custom options (user-defined) + credibility (show who voted for each option)

-- chat_messages: store poll options and per-option counts (JSON arrays)
ALTER TABLE chat_messages ADD COLUMN poll_options JSON NULL AFTER poll_no_count;
ALTER TABLE chat_messages ADD COLUMN poll_option_counts JSON NULL AFTER poll_options;

-- chat_poll_votes: option_index for custom options (0-based; for Yes/No polls 0=Yes, 1=No)
ALTER TABLE chat_poll_votes ADD COLUMN option_index INT NULL AFTER vote;

-- Backfill: existing yes/no votes get option_index 0 or 1
UPDATE chat_poll_votes SET option_index = 0 WHERE vote = 'yes' AND option_index IS NULL;
UPDATE chat_poll_votes SET option_index = 1 WHERE vote = 'no' AND option_index IS NULL;
