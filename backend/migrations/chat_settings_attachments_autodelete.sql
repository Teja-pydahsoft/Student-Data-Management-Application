-- Channel settings: auto-delete duration (7/10/30 days or custom up to 30). Default 30 days.
ALTER TABLE chat_channel_settings ADD COLUMN auto_delete_after_days INT DEFAULT 30 AFTER students_can_send;

-- Messages: optional attachment (photo/file, max 10-20 KB in policy; store URL)
ALTER TABLE chat_messages ADD COLUMN attachment_url VARCHAR(500) NULL AFTER message;
ALTER TABLE chat_messages ADD COLUMN attachment_type VARCHAR(20) NULL AFTER attachment_url;
