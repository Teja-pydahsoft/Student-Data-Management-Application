const { masterPool } = require('../config/database');
const transportConnection = require('../config/transportDb');

// Import Schemas using the new connection
// We require the Model files to get the Schema, but we must re-compile them 
// with the transportConnection because the original files compile with default mongoose.
const RouteModelInfo = require('../MongoDb-Transport/Route');
const BusModelInfo = require('../MongoDb-Transport/Bus');

// Re-compile models for Transport DB Connection
// Note: RouteModelInfo is the Model. We access .schema to re-compile.
const Route = transportConnection.model('Route', RouteModelInfo.schema);
const Bus = transportConnection.model('Bus', BusModelInfo.schema);

exports.getAllRoutes = async (req, res) => {
    try {
        const routes = await Route.find({}).sort({ routeName: 1 });
        res.json({ success: true, data: routes });
    } catch (error) {
        console.error('Error fetching routes:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch routes' });
    }
};

exports.getBuses = async (req, res) => {
    try {
        // Fetch active buses
        const buses = await Bus.find({ status: 'Active' });
        res.json({ success: true, data: buses });
    } catch (error) {
        console.error('Error fetching buses:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch buses' });
    }
};

exports.createTransportRequest = async (req, res) => {
    try {
        const student_id = req.user.id; // From auth middleware
        const { route_id, route_name, stage_name, fare, bus_id } = req.body;

        if (!route_id || !stage_name) {
            return res.status(400).json({ success: false, message: 'Route and Stage are required' });
        }

        // 1. Fetch Student details for Admission Number and Name
        const [students] = await masterPool.execute('SELECT admission_number, student_name FROM students WHERE id = ?', [student_id]);
        if (students.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        const { admission_number, student_name } = students[0];

        // 2. Insert Request into MySQL
        const query = `
            INSERT INTO transport_requests 
            (admission_number, student_name, route_id, route_name, stage_name, bus_id, fare, status, request_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
        `;
        
        await masterPool.execute(query, [
            admission_number,
            student_name,
            route_id,
            route_name,
            stage_name,
            bus_id || null,
            fare || 0.00
        ]);

        res.status(201).json({ success: true, message: 'Transport request submitted successfully' });

    } catch (error) {
        console.error('Error creating transport request:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getMyTransportRequests = async (req, res) => {
    try {
        const student_id = req.user.id;
        
        // Fetch admission_number to query requests
        const [students] = await masterPool.execute('SELECT admission_number FROM students WHERE id = ?', [student_id]);
        
        if (students.length === 0) {
             return res.json({ success: true, data: [] });
        }
        const admission_number = students[0].admission_number;

        const [rows] = await masterPool.execute(
            'SELECT * FROM transport_requests WHERE admission_number = ? ORDER BY request_date DESC',
            [admission_number]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching transport requests:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
