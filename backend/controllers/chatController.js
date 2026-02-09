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

/** Resolve current user's student_id / rbac_user_id */
async function resolveCurrentUserIds(user) {
  let studentId = null;
  let rbacUserId = null;
  if (user?.role === 'student' || user?.admission_number || user?.admissionNumber) {
    const [s] = await masterPool.query(
      'SELECT id FROM students WHERE admission_number = ? OR admission_no = ? LIMIT 1',
      [user.admission_number || user.admissionNumber || user.admission_no, user.admission_number || user.admissionNumber || user.admission_no]
    );
    if (s.length) studentId = s[0].id;
  } else {
    rbacUserId = user?.id || null;
  }
  return { studentId, rbacUserId };
}

/** Get messages for a channel (paginated); includes is_own, can_edit, deleted_by_name, poll counts and user vote */
exports.getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { before, limit = 50 } = req.query;
    const user = req.user || req.admin;
    const [ch] = await masterPool.query('SELECT id FROM chat_channels WHERE id = ? AND is_active = 1', [id]);
    if (!ch.length) return res.status(404).json({ success: false, message: 'Channel not found' });
    const { studentId: currentStudentId, rbacUserId: currentRbacId } = await resolveCurrentUserIds(user);

    let sql = `SELECT cm.id, cm.sender_type, cm.student_id, cm.rbac_user_id, cm.message, cm.attachment_url, cm.attachment_type,
               cm.is_hidden, cm.created_at, cm.edited_at, cm.is_deleted, cm.deleted_at, cm.deleted_by_rbac_id, cm.message_type,
               cm.poll_yes_count, cm.poll_no_count, cm.poll_options, cm.poll_option_counts
               FROM chat_messages cm WHERE cm.channel_id = ?`;
    const params = [id];
    if (before) { sql += ' AND cm.id < ?'; params.push(before); }
    sql += ' ORDER BY cm.id DESC LIMIT ?';
    params.push(Number(limit) || 50);
    const [rows] = await masterPool.query(sql, params);

    const ids = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
    const rbacIds = [...new Set(rows.map((r) => r.rbac_user_id).filter(Boolean))];
    const deletedByRbacIds = [...new Set(rows.map((r) => r.deleted_by_rbac_id).filter(Boolean))];
    let names = {};
    if (ids.length) {
      const [st] = await masterPool.query('SELECT id, student_name FROM students WHERE id IN (?)', [ids]);
      st.forEach((s) => { names[`s${s.id}`] = s.student_name; });
    }
    if (rbacIds.length || deletedByRbacIds.length) {
      const allRbac = [...new Set([...rbacIds, ...deletedByRbacIds])];
      const [ru] = await masterPool.query('SELECT id, name FROM rbac_users WHERE id IN (?)', [allRbac]);
      ru.forEach((r) => { names[`r${r.id}`] = r.name; });
    }
    const isSuperAdmin = user && (user.role === 'super_admin' || user.role === 'admin');
    const messageIds = rows.map((r) => r.id).filter(Boolean);
    const pollMessageIds = rows.filter((r) => r.message_type === 'poll').map((r) => r.id);
    let userVotes = {};
    let userVoteOptionIndex = {};
    if (messageIds.length && (currentStudentId || currentRbacId)) {
      const [votes] = await masterPool.query(
        'SELECT message_id, vote, option_index FROM chat_poll_votes WHERE message_id IN (?) AND (voter_student_id = ? OR voter_rbac_id = ?)',
        [messageIds, currentStudentId || 0, currentRbacId || 0]
      );
      votes.forEach((v) => {
        const optIdx = v.option_index != null ? v.option_index : (v.vote === 'yes' ? 0 : v.vote === 'no' ? 1 : null);
        userVotes[v.message_id] = optIdx != null && v.vote != null ? (v.vote === 'yes' || v.vote === 'no' ? v.vote : String(optIdx)) : (optIdx != null ? String(optIdx) : null);
        userVoteOptionIndex[v.message_id] = optIdx;
      });
    }
    const MAX_VOTER_NAMES = 20;
    let votersByOption = {};
    if (pollMessageIds.length) {
      const [allVotes] = await masterPool.query(
        'SELECT message_id, option_index, voter_student_id, voter_rbac_id FROM chat_poll_votes WHERE message_id IN (?)',
        [pollMessageIds]
      );
      const sIds = [...new Set(allVotes.map((v) => v.voter_student_id).filter(Boolean))];
      const rIds = [...new Set(allVotes.map((v) => v.voter_rbac_id).filter(Boolean))];
      let voteNames = {};
      if (sIds.length) {
        const [st] = await masterPool.query('SELECT id, student_name FROM students WHERE id IN (?)', [sIds]);
        st.forEach((s) => { voteNames[`s${s.id}`] = s.student_name; });
      }
      if (rIds.length) {
        const [ru] = await masterPool.query('SELECT id, name FROM rbac_users WHERE id IN (?)', [rIds]);
        ru.forEach((r) => { voteNames[`r${r.id}`] = r.name; });
      }
      allVotes.forEach((v) => {
        const optIdx = v.option_index != null ? v.option_index : 0;
        const name = v.voter_student_id ? voteNames[`s${v.voter_student_id}`] : (v.voter_rbac_id ? voteNames[`r${v.voter_rbac_id}`] : 'Unknown');
        const key = `${v.message_id}`;
        if (!votersByOption[key]) votersByOption[key] = {};
        if (!votersByOption[key][optIdx]) votersByOption[key][optIdx] = { names: [], total: 0 };
        const arr = votersByOption[key][optIdx];
        arr.total = (arr.total || 0) + 1;
        if (arr.names.length < MAX_VOTER_NAMES) arr.names.push(name);
      });
    }
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const data = rows.map((r) => {
      const isOwn = (r.student_id != null && r.student_id === currentStudentId) || (r.rbac_user_id != null && r.rbac_user_id === currentRbacId);
      const isPollPoster = r.message_type === 'poll' && isOwn;
      const showVoters = isSuperAdmin || isPollPoster;
      const rawVoters = votersByOption[r.id] || {};
      const votersForMsg = showVoters ? Object.keys(rawVoters).reduce((acc, k) => {
        const idx = Number(k);
        const o = rawVoters[idx];
        acc[idx] = (o && o.names) ? o.names : [];
        return acc;
      }, {}) : {};
      const votersCountForMsg = showVoters ? Object.keys(rawVoters).reduce((acc, k) => {
        const idx = Number(k);
        const o = rawVoters[idx];
        if (o && o.total != null) acc[idx] = o.total;
        return acc;
      }, {}) : {};
      const createdMs = new Date(r.created_at).getTime();
      const canEdit = isOwn && !r.is_deleted && (Date.now() - createdMs <= FIVE_MIN_MS) && r.message_type === 'text';
      const canEditAny = isSuperAdmin && !r.is_deleted && r.message_type === 'text';
      const deletedByName = r.deleted_by_rbac_id != null ? (names[`r${r.deleted_by_rbac_id}`] || 'Someone') : null;
      const pollOpts = r.poll_options != null ? (typeof r.poll_options === 'string' ? JSON.parse(r.poll_options) : r.poll_options) : (r.message_type === 'poll' ? ['Yes', 'No'] : null);
      const pollCounts = r.poll_option_counts != null ? (typeof r.poll_option_counts === 'string' ? JSON.parse(r.poll_option_counts) : r.poll_option_counts) : (r.message_type === 'poll' ? [r.poll_yes_count || 0, r.poll_no_count || 0] : null);
      return {
        ...r,
        poll_options: pollOpts,
        poll_option_counts: pollCounts,
        voters_by_option: votersForMsg,
        voters_count_by_option: votersCountForMsg,
        sender_name: r.student_id ? names[`s${r.student_id}`] : (r.rbac_user_id ? names[`r${r.rbac_user_id}`] : 'Unknown'),
        deleted_by_name: deletedByName,
        is_own: !!isOwn,
        can_edit: !!canEdit,
        can_edit_any: !!canEditAny,
        current_user_vote: r.message_type === 'poll' ? (userVotes[r.id] ?? null) : null,
        current_user_option_index: r.message_type === 'poll' ? (userVoteOptionIndex[r.id] ?? null) : null,
      };
    });
    res.json({ success: true, data: data.reverse() });
  } catch (error) {
    console.error('chat getMessages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

/** Post a message or poll (poll can have custom options array; default Yes/No). Respects channel setting students_can_send. Optional attachment_url, attachment_type. */
exports.postMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, message_type: msgType, options: pollOptionsRaw, attachment_url: attachmentUrl, attachment_type: attachmentType } = req.body || {};
    const user = req.user || req.admin;
    const msgText = message != null ? String(message).trim() : '';
    if (!msgText && !attachmentUrl) return res.status(400).json({ success: false, message: 'message or attachment required' });
    const [ch] = await masterPool.query('SELECT id FROM chat_channels WHERE id = ? AND is_active = 1', [id]);
    if (!ch.length) return res.status(404).json({ success: false, message: 'Channel not found' });
    let sender_type = 'admin';
    let student_id = null;
    let rbac_user_id = null;
    if (user?.role === 'student' || user?.admission_number) {
      let studentsCanSend = true;
      try {
        const [settings] = await masterPool.query('SELECT students_can_send FROM chat_channel_settings WHERE channel_id = ?', [id]);
        studentsCanSend = settings.length === 0 ? true : !!settings[0].students_can_send;
      } catch (e) {
        // table may not exist yet
      }
      if (!studentsCanSend) return res.status(403).json({ success: false, message: 'Students are not allowed to send messages in this channel' });
      sender_type = 'student';
      const [s] = await masterPool.query('SELECT id FROM students WHERE admission_number = ? OR admission_no = ? LIMIT 1', [user.admission_number || user.admissionNumber, user.admission_number || user.admissionNo]);
      if (!s.length) return res.status(403).json({ success: false, message: 'Student not found' });
      student_id = s[0].id;
    } else {
      sender_type = (user?.role === 'faculty' || user?.role === 'branch_faculty') ? 'faculty' : 'admin';
      rbac_user_id = user?.id;
    }
    const isPoll = msgType === 'poll';
    const optionsArr = Array.isArray(pollOptionsRaw) && pollOptionsRaw.length > 0
      ? pollOptionsRaw.map((o) => String(o).trim()).filter(Boolean).slice(0, 20)
      : (isPoll ? ['Yes', 'No'] : null);
    const pollCountsArr = optionsArr ? optionsArr.map(() => 0) : null;
    const attUrl = attachmentUrl && String(attachmentUrl).length <= 500 ? String(attachmentUrl).trim() : null;
    const attType = attUrl && ['image', 'file'].includes(String(attachmentType || '').toLowerCase()) ? String(attachmentType).toLowerCase() : (attUrl ? 'file' : null);
    const [r] = await masterPool.query(
      `INSERT INTO chat_messages (channel_id, sender_type, student_id, rbac_user_id, message, attachment_url, attachment_type, message_type, poll_yes_count, poll_no_count, poll_options, poll_option_counts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, sender_type, student_id, rbac_user_id,
        msgText.slice(0, 4000),
        attUrl,
        attType,
        isPoll ? 'poll' : 'text',
        isPoll && (!optionsArr || optionsArr.length <= 2) ? 0 : null,
        isPoll && (!optionsArr || optionsArr.length <= 2) ? 0 : null,
        optionsArr ? JSON.stringify(optionsArr) : null,
        pollCountsArr ? JSON.stringify(pollCountsArr) : null,
      ]
    );
    res.status(201).json({ success: true, data: { id: r.insertId, message: msgText.slice(0, 4000), message_type: isPoll ? 'poll' : 'text', poll_options: optionsArr, attachment_url: attUrl, attachment_type: attType } });
  } catch (error) {
    console.error('chat postMessage error:', error);
    res.status(500).json({ success: false, message: 'Failed to post message' });
  }
};

/** Edit own message (within 5 minutes); super_admin can edit any text message */
exports.editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body || {};
    const user = req.user || req.admin;
    if (!message || !String(message).trim()) return res.status(400).json({ success: false, message: 'message required' });
    const isSuperAdmin = user && (user.role === 'super_admin' || user.role === 'admin');
    const [rows] = await masterPool.query(
      'SELECT id, channel_id, student_id, rbac_user_id, created_at, is_deleted, message_type FROM chat_messages WHERE id = ?',
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Message not found' });
    const msg = rows[0];
    if (msg.is_deleted || msg.message_type !== 'text') return res.status(400).json({ success: false, message: 'Cannot edit this message' });
    if (!isSuperAdmin) {
      const { studentId: currentStudentId, rbacUserId: currentRbacId } = await resolveCurrentUserIds(user);
      const isOwn = (msg.student_id != null && msg.student_id === currentStudentId) || (msg.rbac_user_id != null && msg.rbac_user_id === currentRbacId);
      if (!isOwn) return res.status(403).json({ success: false, message: 'You can only edit your own message' });
      const createdMs = new Date(msg.created_at).getTime();
      if (Date.now() - createdMs > 5 * 60 * 1000) return res.status(400).json({ success: false, message: 'Edit allowed only within 5 minutes' });
    }
    await masterPool.query('UPDATE chat_messages SET message = ?, edited_at = NOW() WHERE id = ?', [String(message).trim().slice(0, 4000), id]);
    res.json({ success: true, message: 'Message updated' });
  } catch (error) {
    console.error('chat editMessage error:', error);
    res.status(500).json({ success: false, message: 'Failed to edit message' });
  }
};

/** Edit poll question and/or options. Creator or super_admin only. Changing options resets vote counts for that poll. */
exports.editPoll = async (req, res) => {
  try {
    const { id } = req.params;
    const { message: question, options: pollOptionsRaw } = req.body || {};
    const user = req.user || req.admin;
    const isSuperAdmin = user && (user.role === 'super_admin' || user.role === 'admin');
    const [rows] = await masterPool.query(
      'SELECT id, channel_id, student_id, rbac_user_id, message_type, message, poll_options FROM chat_messages WHERE id = ?',
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Message not found' });
    const msg = rows[0];
    if (msg.message_type !== 'poll') return res.status(400).json({ success: false, message: 'Not a poll' });
    if (!isSuperAdmin) {
      const { studentId: currentStudentId, rbacUserId: currentRbacId } = await resolveCurrentUserIds(user);
      const isOwn = (msg.student_id != null && msg.student_id === currentStudentId) || (msg.rbac_user_id != null && msg.rbac_user_id === currentRbacId);
      if (!isOwn) return res.status(403).json({ success: false, message: 'Only the poll creator can edit it' });
    }
    let newQuestion = msg.message;
    if (question != null && String(question).trim()) newQuestion = String(question).trim().slice(0, 4000);
    if (Array.isArray(pollOptionsRaw) && pollOptionsRaw.length >= 2) {
      const opts = pollOptionsRaw.map((o) => String(o).trim()).filter(Boolean).slice(0, 20);
      if (opts.length >= 2) {
        await masterPool.query('DELETE FROM chat_poll_votes WHERE message_id = ?', [id]);
        await masterPool.query(
          'UPDATE chat_messages SET message = ?, poll_options = ?, poll_option_counts = ?, edited_at = NOW() WHERE id = ?',
          [newQuestion, JSON.stringify(opts), JSON.stringify(opts.map(() => 0)), id]
        );
      } else {
        await masterPool.query('UPDATE chat_messages SET message = ?, edited_at = NOW() WHERE id = ?', [newQuestion, id]);
      }
    } else {
      await masterPool.query('UPDATE chat_messages SET message = ?, edited_at = NOW() WHERE id = ?', [newQuestion, id]);
    }
    res.json({ success: true, message: 'Poll updated' });
  } catch (error) {
    console.error('chat editPoll error:', error);
    res.status(500).json({ success: false, message: 'Failed to edit poll' });
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

/** Delete message (soft-delete; same access as moderate: faculty_academics + moderate_chat). Shows "deleted by [name]" in UI. */
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedByRbacId = req.user?.id || req.admin?.id;
    const [r] = await masterPool.query(
      'UPDATE chat_messages SET is_deleted = TRUE, deleted_at = NOW(), deleted_by_rbac_id = ? WHERE id = ?',
      [deletedByRbacId, id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    console.error('chat deleteMessage error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
};

/** Vote on a poll: body { vote: 'yes'|'no' } for 2-option legacy, or { option_index: 0|1|2... } for custom options */
exports.votePoll = async (req, res) => {
  try {
    const { id } = req.params;
    const { vote, option_index: optionIndex } = req.body || {};
    const user = req.user || req.admin;
    const [rows] = await masterPool.query(
      'SELECT id, channel_id, message_type, poll_options, poll_option_counts, poll_yes_count, poll_no_count FROM chat_messages WHERE id = ?',
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Message not found' });
    const msg = rows[0];
    if (msg.message_type !== 'poll') return res.status(400).json({ success: false, message: 'Not a poll' });
    const options = msg.poll_options != null ? (typeof msg.poll_options === 'string' ? JSON.parse(msg.poll_options) : msg.poll_options) : ['Yes', 'No'];
    const optIdx = optionIndex != null ? Number(optionIndex) : (vote === 'yes' ? 0 : vote === 'no' ? 1 : null);
    if (optIdx == null || optIdx < 0 || optIdx >= options.length) return res.status(400).json({ success: false, message: 'Invalid option_index or vote' });
    const { studentId: currentStudentId, rbacUserId: currentRbacId } = await resolveCurrentUserIds(user);
    const [existing] = await masterPool.query(
      'SELECT id FROM chat_poll_votes WHERE message_id = ? AND (voter_student_id = ? OR voter_rbac_id = ?)',
      [id, currentStudentId || 0, currentRbacId || 0]
    );
    if (existing.length) return res.status(400).json({ success: false, message: 'Already voted' });
    const legacyVote = options.length === 2 && optIdx === 0 ? 'yes' : options.length === 2 && optIdx === 1 ? 'no' : null;
    await masterPool.query(
      'INSERT INTO chat_poll_votes (message_id, voter_student_id, voter_rbac_id, vote, option_index) VALUES (?, ?, ?, ?, ?)',
      [id, currentStudentId || null, currentRbacId || null, legacyVote || 'yes', optIdx]
    );
    if (msg.poll_option_counts != null) {
      const counts = typeof msg.poll_option_counts === 'string' ? JSON.parse(msg.poll_option_counts) : msg.poll_option_counts;
      if (Array.isArray(counts) && counts[optIdx] != null) {
        counts[optIdx] = (counts[optIdx] || 0) + 1;
        await masterPool.query('UPDATE chat_messages SET poll_option_counts = ? WHERE id = ?', [JSON.stringify(counts), id]);
      }
    } else {
      const col = optIdx === 0 ? 'poll_yes_count' : 'poll_no_count';
      await masterPool.query(`UPDATE chat_messages SET ${col} = COALESCE(${col}, 0) + 1 WHERE id = ?`, [id]);
    }
    res.json({ success: true, message: 'Vote recorded' });
  } catch (error) {
    console.error('chat votePoll error:', error);
    res.status(500).json({ success: false, message: 'Failed to vote' });
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

/** Get channel settings (for club Settings tab) */
exports.getChannelSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const [ch] = await masterPool.query('SELECT id FROM chat_channels WHERE id = ? AND is_active = 1', [id]);
    if (!ch.length) return res.status(404).json({ success: false, message: 'Channel not found' });
    const [rows] = await masterPool.query('SELECT channel_id, students_can_send, auto_delete_after_days FROM chat_channel_settings WHERE channel_id = ?', [id]);
    const settings = rows.length ? rows[0] : { channel_id: Number(id), students_can_send: true, auto_delete_after_days: 30 };
    if (settings.auto_delete_after_days == null) settings.auto_delete_after_days = 30;
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('chat getChannelSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

/** Update channel settings (admin/faculty/super_admin). auto_delete_after_days: 1-30 only. */
exports.updateChannelSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { students_can_send, auto_delete_after_days } = req.body || {};
    const [ch] = await masterPool.query('SELECT id FROM chat_channels WHERE id = ? AND is_active = 1', [id]);
    if (!ch.length) return res.status(404).json({ success: false, message: 'Channel not found' });
    let days = auto_delete_after_days != null ? Number(auto_delete_after_days) : 30;
    if (days < 1 || days > 30) days = 30;
    await masterPool.query(
      `INSERT INTO chat_channel_settings (channel_id, students_can_send, auto_delete_after_days) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE students_can_send = VALUES(students_can_send), auto_delete_after_days = VALUES(auto_delete_after_days)`,
      [id, students_can_send !== false, days]
    );
    res.json({ success: true, data: { students_can_send: students_can_send !== false, auto_delete_after_days: days } });
  } catch (error) {
    console.error('chat updateChannelSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
};

/** Schedule a message to be sent at a future time */
exports.createScheduledMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, scheduled_at } = req.body || {};
    const user = req.user || req.admin;
    if (!message || !String(message).trim()) return res.status(400).json({ success: false, message: 'message required' });
    if (!scheduled_at) return res.status(400).json({ success: false, message: 'scheduled_at required' });
    const at = new Date(scheduled_at);
    if (isNaN(at.getTime()) || at.getTime() <= Date.now()) return res.status(400).json({ success: false, message: 'scheduled_at must be a future date/time' });
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
      'INSERT INTO chat_scheduled_messages (channel_id, sender_type, student_id, rbac_user_id, message, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, sender_type, student_id, rbac_user_id, String(message).trim().slice(0, 4000), at, 'pending']
    );
    res.status(201).json({ success: true, data: { id: r.insertId, scheduled_at: at.toISOString() } });
  } catch (error) {
    console.error('chat createScheduledMessage error:', error);
    res.status(500).json({ success: false, message: 'Failed to schedule message' });
  }
};

/** List scheduled messages for a channel */
exports.listScheduledMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const [ch] = await masterPool.query('SELECT id FROM chat_channels WHERE id = ? AND is_active = 1', [id]);
    if (!ch.length) return res.status(404).json({ success: false, message: 'Channel not found' });
    const [rows] = await masterPool.query(
      'SELECT id, message, scheduled_at, status, created_at FROM chat_scheduled_messages WHERE channel_id = ? AND status = ? ORDER BY scheduled_at ASC',
      [id, 'pending']
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('chat listScheduledMessages error:', error);
    res.status(500).json({ success: false, message: 'Failed to list scheduled messages' });
  }
};

/** Process pending scheduled messages (call periodically, e.g. every minute) */
exports.processScheduledMessages = async () => {
  try {
    const [rows] = await masterPool.query(
      "SELECT id, channel_id, sender_type, student_id, rbac_user_id, message FROM chat_scheduled_messages WHERE status = 'pending' AND scheduled_at <= NOW()"
    );
    for (const row of rows) {
      try {
        await masterPool.query(
          'INSERT INTO chat_messages (channel_id, sender_type, student_id, rbac_user_id, message, message_type) VALUES (?, ?, ?, ?, ?, ?)',
          [row.channel_id, row.sender_type, row.student_id, row.rbac_user_id, row.message, 'text']
        );
        await masterPool.query("UPDATE chat_scheduled_messages SET status = 'sent', sent_at = NOW() WHERE id = ?", [row.id]);
      } catch (e) {
        console.error('chat processScheduledMessages send error:', e);
      }
    }
  } catch (error) {
    console.error('chat processScheduledMessages error:', error);
  }
};

/** Upload attachment for chat (max 20 KB). Returns { url, attachment_type } for use in postMessage. */
exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const base = `${req.protocol}://${req.get('host')}`;
    const url = `${base}/uploads/chat/${req.file.filename}`;
    const attachmentType = (req.file.mimetype || '').startsWith('image/') ? 'image' : 'file';
    res.json({ success: true, data: { url, attachment_type: attachmentType } });
  } catch (error) {
    console.error('chat uploadAttachment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
};

/** Auto-delete messages older than channel's auto_delete_after_days (default 30). Run daily. */
exports.processAutoDeleteMessages = async () => {
  try {
    const [channels] = await masterPool.query(
      'SELECT channel_id, COALESCE(auto_delete_after_days, 30) AS days FROM chat_channel_settings'
    );
    for (const row of channels) {
      const days = Math.min(30, Math.max(1, Number(row.days) || 30));
      const [r] = await masterPool.query(
        'DELETE FROM chat_messages WHERE channel_id = ? AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [row.channel_id, days]
      );
      if (r.affectedRows > 0) console.log(`Chat auto-delete: channel ${row.channel_id} removed ${r.affectedRows} message(s)`);
    }
    const [noSettings] = await masterPool.query('SELECT id FROM chat_channels c WHERE NOT EXISTS (SELECT 1 FROM chat_channel_settings s WHERE s.channel_id = c.id)');
    for (const ch of noSettings) {
      const [r] = await masterPool.query(
        'DELETE FROM chat_messages WHERE channel_id = ? AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)',
        [ch.id]
      );
      if (r.affectedRows > 0) console.log(`Chat auto-delete (default 30d): channel ${ch.id} removed ${r.affectedRows} message(s)`);
    }
  } catch (error) {
    console.error('chat processAutoDeleteMessages error:', error);
  }
};
