/**
 * Chat Controller (Pydah v2.0)
 * Channels (subject/club/event), messages, moderation.
 */

const { masterPool } = require('../config/database');

/** Get channel by club_id (for admin/faculty when viewing club details) */
exports.getChannelByClub = async (req, res) => {
  try {
    const { clubId } = req.params;
    const [rows] = await masterPool.query(
      'SELECT id, channel_type, name, club_id, is_active FROM chat_channels WHERE club_id = ? AND is_active = 1 LIMIT 1',
      [clubId]
    );
    if (!rows.length) return res.json({ success: true, data: null });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('chat getChannelByClub error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch channel' });
  }
};

/** List channels user is member of or can access */
exports.listChannels = async (req, res) => {
  try {
    const user = req.user || req.admin;
    const scope = req.userScope || {};
    let channels = [];
    if (user?.role === 'student' || user?.admission_number) {
      const [students] = await masterPool.query(
        'SELECT id FROM students WHERE admission_number = ? OR admission_no = ? LIMIT 1',
        [user.admission_number || user.admissionNumber, user.admission_number || user.admissionNo]
      );
      if (students.length) {
        const studentId = students[0].id;
        // Channels where student is in chat_channel_members OR club channels where student is approved club member
        const [rows] = await masterPool.query(
          `SELECT c.id, c.channel_type, c.name, c.subject_id, c.club_id, c.event_id
           FROM chat_channels c
           LEFT JOIN chat_channel_members m ON m.channel_id = c.id AND m.student_id = ?
           LEFT JOIN club_members cm ON cm.club_id = c.club_id AND cm.student_id = ? AND cm.status = 'approved'
           WHERE c.is_active = 1 AND (m.id IS NOT NULL OR (c.channel_type = 'club' AND c.club_id IS NOT NULL AND cm.id IS NOT NULL))`,
          [studentId, studentId]
        );
        channels = rows;
      }
    } else {
      const rbacId = user?.id;
      if (scope.unrestricted) {
        const [rows] = await masterPool.query(
          `SELECT c.id, c.channel_type, c.name, c.subject_id, c.club_id, c.event_id, c.college_id
             FROM chat_channels c
             LEFT JOIN chat_channel_members m ON m.channel_id = c.id AND m.rbac_user_id = ?
             WHERE c.is_active = 1`,
          [rbacId]
        );
        channels = rows;
      } else {
        const cids = scope.collegeIds && scope.collegeIds.length ? scope.collegeIds : [0];
        const [rows] = await masterPool.query(
          `SELECT c.id, c.channel_type, c.name, c.subject_id, c.club_id, c.event_id, c.college_id
             FROM chat_channels c
             LEFT JOIN chat_channel_members m ON m.channel_id = c.id AND m.rbac_user_id = ?
             WHERE c.is_active = 1 AND (m.id IS NOT NULL OR c.college_id IN (?))`,
          [rbacId, cids]
        );
        channels = rows;
      }
    }
    res.json({ success: true, data: channels });
  } catch (error) {
    console.error('chat listChannels error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch channels' });
  }
};

/** Get messages for a channel (paginated) */
exports.getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { before, limit = 50 } = req.query;
    const user = req.user || req.admin;
    const [ch] = await masterPool.query('SELECT id FROM chat_channels WHERE id = ? AND is_active = 1', [id]);
    if (!ch.length) return res.status(404).json({ success: false, message: 'Channel not found' });
    let sql = `SELECT cm.id, cm.sender_type, cm.student_id, cm.rbac_user_id, cm.message, cm.is_hidden, cm.created_at
               FROM chat_messages cm WHERE cm.channel_id = ?`;
    const params = [id];
    if (before) { sql += ' AND cm.id < ?'; params.push(before); }
    sql += ' ORDER BY cm.id DESC LIMIT ?';
    params.push(Number(limit) || 50);
    const [rows] = await masterPool.query(sql, params);
    const ids = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
    const rbacIds = [...new Set(rows.map((r) => r.rbac_user_id).filter(Boolean))];
    let names = {};
    if (ids.length) {
      const [st] = await masterPool.query('SELECT id, student_name FROM students WHERE id IN (?)', [ids]);
      st.forEach((s) => { names[`s${s.id}`] = s.student_name; });
    }
    if (rbacIds.length) {
      const [ru] = await masterPool.query('SELECT id, name FROM rbac_users WHERE id IN (?)', [rbacIds]);
      ru.forEach((r) => { names[`r${r.id}`] = r.name; });
    }
    const data = rows.map((r) => ({
      ...r,
      sender_name: r.student_id ? names[`s${r.student_id}`] : (r.rbac_user_id ? names[`r${r.rbac_user_id}`] : 'Unknown'),
    }));
    res.json({ success: true, data: data.reverse() });
  } catch (error) {
    console.error('chat getMessages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

/** Post a message */
exports.postMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body || {};
    const user = req.user || req.admin;
    if (!message || !String(message).trim()) return res.status(400).json({ success: false, message: 'message required' });
    const [ch] = await masterPool.query('SELECT id FROM chat_channels WHERE id = ? AND is_active = 1', [id]);
    if (!ch.length) return res.status(404).json({ success: false, message: 'Channel not found' });
    let sender_type = 'admin';
    let student_id = null;
    let rbac_user_id = null;
    if (user?.role === 'student' || user?.admission_number) {
      sender_type = 'student';
      const [s] = await masterPool.query('SELECT id FROM students WHERE admission_number = ? OR admission_no = ? LIMIT 1', [user.admission_number || user.admissionNumber, user.admission_number || user.admissionNo]);
      if (!s.length) return res.status(403).json({ success: false, message: 'Student not found' });
      student_id = s[0].id;
    } else {
      sender_type = (user?.role === 'faculty' || user?.role === 'branch_faculty') ? 'faculty' : 'admin';
      rbac_user_id = user?.id;
    }
    const [r] = await masterPool.query(
      `INSERT INTO chat_messages (channel_id, sender_type, student_id, rbac_user_id, message) VALUES (?, ?, ?, ?, ?)`,
      [id, sender_type, student_id, rbac_user_id, String(message).trim().slice(0, 4000)]
    );
    res.status(201).json({ success: true, data: { id: r.insertId, message: String(message).trim().slice(0, 4000) } });
  } catch (error) {
    console.error('chat postMessage error:', error);
    res.status(500).json({ success: false, message: 'Failed to post message' });
  }
};

/** Moderate: hide/show message */
exports.moderateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_hidden } = req.body || {};
    const moderated_by = req.user?.id || req.admin?.id;
    const [r] = await masterPool.query(
      'UPDATE chat_messages SET is_hidden = ?, moderated_at = NOW(), moderated_by = ? WHERE id = ?',
      [!!is_hidden, moderated_by, id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, message: is_hidden ? 'Hidden' : 'Restored' });
  } catch (error) {
    console.error('chat moderateMessage error:', error);
    res.status(500).json({ success: false, message: 'Failed to moderate' });
  }
};

/** Create channel (admin/faculty) */
exports.createChannel = async (req, res) => {
  try {
    const { channel_type, name, subject_id, club_id, event_id, college_id } = req.body || {};
    const created_by = req.user?.id || req.admin?.id;
    if (!channel_type || !name) return res.status(400).json({ success: false, message: 'channel_type, name required' });
    if (!['subject', 'club', 'event'].includes(channel_type)) return res.status(400).json({ success: false, message: 'channel_type must be subject, club, or event' });
    const [r] = await masterPool.query(
      `INSERT INTO chat_channels (channel_type, name, subject_id, club_id, event_id, college_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [channel_type, name, subject_id || null, club_id || null, event_id || null, college_id || null, created_by]
    );
    const channelId = r.insertId;
    // Auto-add approved club members to club channel
    if (channel_type === 'club' && club_id) {
      const [members] = await masterPool.query(
        'SELECT student_id FROM club_members WHERE club_id = ? AND status = ?',
        [club_id, 'approved']
      );
      for (const m of members) {
        try {
          await masterPool.query(
            'INSERT IGNORE INTO chat_channel_members (channel_id, member_type, student_id) VALUES (?, ?, ?)',
            [channelId, 'student', m.student_id]
          );
        } catch (e) {
          // Ignore duplicate
        }
      }
    }
    res.status(201).json({ success: true, data: { id: channelId } });
  } catch (error) {
    console.error('chat createChannel error:', error);
    res.status(500).json({ success: false, message: 'Failed to create channel' });
  }
};
