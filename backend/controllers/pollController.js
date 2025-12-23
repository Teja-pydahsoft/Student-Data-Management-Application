const { masterPool } = require('../config/database');

// Helper component to build student count query
const buildStudentCountQuery = (poll) => {
    let query = 'SELECT COUNT(*) as count FROM students WHERE student_status = "Regular"';
    const params = [];

    const parseParam = (val) => {
        if (!val) return null;
        if (Array.isArray(val)) return val.length ? val : null;
        try {
            const parsed = JSON.parse(val);
            return parsed.length ? parsed : null;
        } catch (e) { return null; }
    };

    const colleges = parseParam(poll.target_college);
    const batches = parseParam(poll.target_batch);
    const courses = parseParam(poll.target_course);
    const branches = parseParam(poll.target_branch);
    const years = parseParam(poll.target_year);
    const semesters = parseParam(poll.target_semester);

    if (colleges) { query += ' AND college IN (?)'; params.push(colleges); }
    if (batches) { query += ' AND batch IN (?)'; params.push(batches); }
    if (courses) { query += ' AND course IN (?)'; params.push(courses); }
    if (branches) { query += ' AND branch IN (?)'; params.push(branches); }
    if (years) { query += ' AND current_year IN (?)'; params.push(years); }
    if (semesters) { query += ' AND current_semester IN (?)'; params.push(semesters); }

    return { query, params };
};

exports.createPoll = async (req, res) => {
    try {
        const {
            question,
            options,
            start_time,
            end_time,
            target_college,
            target_batch,
            target_course,
            target_branch,
            target_year,
            target_semester
        } = req.body;

        const createdBy = req.user?.id || 1;

        const finalOptions = typeof options === 'string' ? options : JSON.stringify(options);

        // Helper to format target arrays
        const formatTarget = (arr) => {
            if (!arr) return null;
            if (Array.isArray(arr) && arr.length > 0) return JSON.stringify(arr);
            if (typeof arr === 'string' && arr.length > 0) return arr;
            return null;
        };

        await masterPool.query(
            `INSERT INTO polls 
            (question, options, start_time, end_time, target_college, target_batch, target_course, target_branch, target_year, target_semester, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                question,
                finalOptions,
                start_time || null,
                end_time || null,
                formatTarget(target_college),
                formatTarget(target_batch),
                formatTarget(target_course),
                formatTarget(target_branch),
                formatTarget(target_year),
                formatTarget(target_semester),
                createdBy
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Poll created successfully'
        });

    } catch (error) {
        console.error('Create poll error:', error);
        res.status(500).json({ success: false, message: 'Failed to create poll' });
    }
};

exports.updatePoll = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            question,
            options,
            start_time,
            end_time,
            target_college,
            target_batch,
            target_course,
            target_branch,
            target_year,
            target_semester
        } = req.body;

        const finalOptions = typeof options === 'string' ? options : JSON.stringify(options);

        const formatTarget = (arr) => {
            if (!arr) return null;
            if (Array.isArray(arr) && arr.length > 0) return JSON.stringify(arr);
            if (typeof arr === 'string' && arr.length > 0) return arr;
            return null;
        };

        // We do not reset votes on update usually, unless explicitly asked.
        // If options changed drastically, previous votes (indices) might be wrong, but we depend on admin sanity here.

        await masterPool.query(
            `UPDATE polls SET
                question = ?,
                options = ?,
                start_time = ?,
                end_time = ?,
                target_college = ?,
                target_batch = ?,
                target_course = ?,
                target_branch = ?,
                target_year = ?,
                target_semester = ?
            WHERE id = ?`,
            [
                question,
                finalOptions,
                start_time || null,
                end_time || null,
                formatTarget(target_college),
                formatTarget(target_batch),
                formatTarget(target_course),
                formatTarget(target_branch),
                formatTarget(target_year),
                formatTarget(target_semester),
                id
            ]
        );

        res.json({ success: true, message: 'Poll updated successfully' });

    } catch (error) {
        console.error('Update poll error:', error);
        res.status(500).json({ success: false, message: 'Failed to update poll' });
    }
};

exports.getPolls = async (req, res) => {
    try {
        // Admin View
        const { college } = req.query;
        let query = `
            SELECT p.*, u.username as created_by_name 
            FROM polls p
            LEFT JOIN admins u ON p.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (college) {
            query += ' AND (p.target_college = ? OR p.target_college IS NULL)';
            params.push(college);
        }

        query += ' ORDER BY p.created_at DESC';

        const [rows] = await masterPool.query(query, params);

        // Enhance rows with Stats (Total Assigned / Pending)
        const enhancedRows = await Promise.all(rows.map(async (row) => {
            const votes = typeof row.votes === 'string' ? JSON.parse(row.votes) : row.votes;
            const totalVotes = Object.keys(votes).length;

            // Calculate eligible count
            const { query: countQuery, params: countParams } = buildStudentCountQuery(row);
            const [countRows] = await masterPool.query(countQuery, countParams);
            const totalAssigned = countRows[0].count;
            const pending = Math.max(0, totalAssigned - totalVotes);

            return {
                ...row,
                options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
                votes: votes,
                vote_counts: calculateVoteCounts(row.options, votes),
                target_college: row.target_college ? JSON.parse(row.target_college) : [],
                target_batch: row.target_batch ? JSON.parse(row.target_batch) : [],
                target_course: row.target_course ? JSON.parse(row.target_course) : [],
                target_branch: row.target_branch ? JSON.parse(row.target_branch) : [],
                target_year: row.target_year ? JSON.parse(row.target_year) : [],
                target_semester: row.target_semester ? JSON.parse(row.target_semester) : [],
                stats: {
                    assigned: totalAssigned,
                    votes: totalVotes,
                    pending: pending
                }
            };
        }));

        res.json({
            success: true,
            data: enhancedRows
        });
    } catch (error) {
        console.error('Get polls error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch polls' });
    }
};

exports.getStudentPolls = async (req, res) => {
    try {
        const { admission_number, admissionNumber } = req.user;
        const studentAdmNum = admission_number || admissionNumber;

        const [studentRows] = await masterPool.query(
            'SELECT college, course, branch, batch, current_year, current_semester, student_status FROM students WHERE admission_number = ? OR admission_no = ?',
            [studentAdmNum, studentAdmNum]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        const student = studentRows[0];

        if (!student.student_status || student.student_status !== 'Regular') {
            return res.json({ success: true, data: [] });
        }

        // Active AND (No Time Limits OR Within Time Limits)
        const query = `
            SELECT * FROM polls
            WHERE is_active = 1
            AND (start_time IS NULL OR start_time <= NOW())
            AND (end_time IS NULL OR end_time >= NOW())
            AND (target_college IS NULL OR JSON_CONTAINS(target_college, JSON_QUOTE(?)))
            AND (target_batch IS NULL OR JSON_CONTAINS(target_batch, JSON_QUOTE(?)))
            AND (target_course IS NULL OR JSON_CONTAINS(target_course, JSON_QUOTE(?)))
            AND (target_branch IS NULL OR JSON_CONTAINS(target_branch, JSON_QUOTE(?)))
            AND (target_year IS NULL OR JSON_CONTAINS(target_year, JSON_QUOTE(?)))
            AND (target_semester IS NULL OR JSON_CONTAINS(target_semester, JSON_QUOTE(?)))
            ORDER BY created_at DESC
        `;

        const params = [
            student.college || '',
            student.batch || '',
            student.course || '',
            student.branch || '',
            String(student.current_year || ''),
            String(student.current_semester || '')
        ];

        const [rows] = await masterPool.query(query, params);

        const parsedRows = rows.map(row => {
            const votes = typeof row.votes === 'string' ? JSON.parse(row.votes) : (row.votes || {});
            const hasVoted = votes.hasOwnProperty(studentAdmNum);

            return {
                id: row.id,
                question: row.question,
                options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
                has_voted: hasVoted,
                selected_option: hasVoted ? votes[studentAdmNum] : null,
                total_votes: Object.keys(votes).length,
                vote_counts: calculateVoteCounts(row.options, votes),
                created_at: row.created_at,
                end_time: row.end_time
            };
        });

        res.json({
            success: true,
            data: parsedRows
        });

    } catch (error) {
        console.error('Get student polls error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch polls' });
    }
};

const calculateVoteCounts = (options, votes) => {
    const opts = typeof options === 'string' ? JSON.parse(options) : options;
    const counts = new Array(opts.length).fill(0);
    Object.values(votes).forEach(optionIndex => {
        if (counts[optionIndex] !== undefined) {
            counts[optionIndex]++;
        }
    });
    return counts;
};


exports.votePoll = async (req, res) => {
    try {
        const { id } = req.params;
        const { option_index } = req.body;
        const { admission_number, admissionNumber } = req.user;
        const studentAdmNum = admission_number || admissionNumber;

        // Check poll existence and validity (Active + Time)
        const [polls] = await masterPool.query(
            'SELECT * FROM polls WHERE id = ? AND is_active = 1 AND (start_time IS NULL OR start_time <= NOW()) AND (end_time IS NULL OR end_time >= NOW())',
            [id]
        );
        if (polls.length === 0) {
            return res.status(404).json({ success: false, message: 'Poll not found, inactive, or expired' });
        }

        const quotedKey = `."${studentAdmNum.replace(/"/g, '\\"')}"`;

        await masterPool.query(
            `UPDATE polls 
             SET votes = JSON_SET(COALESCE(votes, JSON_OBJECT()), ?, ?) 
             WHERE id = ?`,
            [`$${quotedKey}`, option_index, id]
        );

        res.json({ success: true, message: 'Vote recorded' });

    } catch (error) {
        console.error('Vote error:', error);
        res.status(500).json({ success: false, message: 'Failed to record vote' });
    }
};

exports.deletePoll = async (req, res) => {
    try {
        const { id } = req.params;
        await masterPool.query('DELETE FROM polls WHERE id = ?', [id]);
        res.json({ success: true, message: 'Poll deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete poll' });
    }
};

exports.toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        await masterPool.query('UPDATE polls SET is_active = ? WHERE id = ?', [is_active, id]);
        res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
};
