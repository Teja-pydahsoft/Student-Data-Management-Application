const Razorpay = require('razorpay');
const crypto = require('crypto');
const PaymentConfig = require('../MongoDb-Models/PaymentConfig');
const Transaction = require('../MongoDb-Models/Transaction');
const FeeHead = require('../MongoDb-Models/FeeHead');
const { masterPool } = require('../config/database');
const mongoose = require('mongoose');

// Create Razorpay Order
exports.createOrder = async (req, res) => {
    try {
        const { studentId, amount, feeHeadId, studentYear, semester, remarks } = req.body;

        if (!studentId || !amount) {
            return res.status(400).json({ success: false, message: 'Student ID and amount are required' });
        }

        // 1. Fetch Student Details to get College/Course
        const [students] = await masterPool.query(
            'SELECT s.student_name, s.course, s.branch, s.student_data FROM students s WHERE s.admission_number = ?',
            [studentId]
        );

        if (!students || students.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        const student = students[0];
        let collegeName = 'Pydah Group';
        if (student.student_data) {
            try {
                const sd = typeof student.student_data === 'string' ? JSON.parse(student.student_data) : student.student_data;
                if (sd.college) collegeName = sd.college;
                else if (sd.College) collegeName = sd.College;
            } catch (e) {
                console.error('Error parsing student_data:', e);
            }
        }

        // 2. Fetch Active Payment Config for this College/Course
        const paymentConfig = await PaymentConfig.findOne({
            college: collegeName,
            course: student.course,
            is_active: true,
            razorpay_key_id: { $exists: true, $ne: '' }
        });

        if (!paymentConfig) {
            return res.status(404).json({ success: false, message: 'Online payment not configured for this college/course' });
        }

        // 3. Initialize Razorpay
        const razorpay = new Razorpay({
            key_id: paymentConfig.razorpay_key_id,
            key_secret: paymentConfig.razorpay_key_secret
        });

        // 4. Create Order
        const options = {
            amount: Math.round(amount * 100), // amount in smallest currency unit (paise)
            currency: 'INR',
            receipt: `rcpt_${Date.now()}_${studentId.replace(/\s+/g, '')}`,
            notes: {
                studentId,
                feeHeadId: feeHeadId || '',
                studentYear: studentYear || '',
                semester: semester || '',
                remarks: remarks || 'Online Fee Payment'
            }
        };

        const order = await razorpay.orders.create(options);

        res.json({
            success: true,
            order,
            key_id: paymentConfig.razorpay_key_id,
            studentDetails: {
                name: student.student_name,
                email: '', // Could fetch from user model if needed
                contact: '' // Could fetch from student_data if needed
            }
        });

    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }
};

// Verify Payment and Record Transaction
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            studentId,
            amount,
            feeHeadId,
            studentYear,
            semester,
            remarks
        } = req.body;

        // 1. Fetch Student/Config to get secret for verification
        const [students] = await masterPool.query(
            'SELECT s.course, s.student_data FROM students s WHERE s.admission_number = ?',
            [studentId]
        );

        if (!students || students.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found during verification' });
        }

        const student = students[0];
        let collegeName = 'Pydah Group';
        if (student.student_data) {
            try {
                const sd = typeof student.student_data === 'string' ? JSON.parse(student.student_data) : student.student_data;
                if (sd.college) collegeName = sd.college;
                else if (sd.College) collegeName = sd.College;
            } catch (e) { /* silent */ }
        }

        const paymentConfig = await PaymentConfig.findOne({
            college: collegeName,
            course: student.course,
            is_active: true
        });

        if (!paymentConfig) {
            return res.status(404).json({ success: false, message: 'Payment configuration lost' });
        }

        // 2. Verify Signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", paymentConfig.razorpay_key_secret)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        // 3. Record Transaction in MongoDB
        // Note: transactionType 'DEBIT' is used for payments in this system (inverted logic confirmed earlier)
        const newTransaction = new Transaction({
            studentId,
            amount: Number(amount),
            transactionType: 'DEBIT', // Payment Received
            paymentMode: 'UPI', // Defaulting to UPI for Razorpay for now, or 'Card'/'Net Banking'
            referenceNo: razorpay_payment_id,
            referenceOrderId: razorpay_order_id, // Custom field if needed, or put in remarks
            remarks: remarks || `Online Payment via Razorpay (${razorpay_payment_id})`,
            feeHead: feeHeadId || null,
            studentYear: studentYear?.toString(),
            semester: semester?.toString(),
            paymentConfigId: paymentConfig._id,
            depositedToAccount: paymentConfig.account_name,
            paymentDate: new Date(),
            collectedBy: 'online_system',
            collectedByName: 'Razorpay Integration'
        });

        await newTransaction.save();

        res.json({
            success: true,
            message: 'Payment verified and recorded successfully',
            transaction: newTransaction
        });

    } catch (error) {
        console.error('Error verifying Razorpay payment:', error);
        res.status(500).json({ success: false, message: 'Failed to verify payment' });
    }
};
