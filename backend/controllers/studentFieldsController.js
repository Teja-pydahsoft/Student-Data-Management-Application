const { masterPool } = require('../config/database');

/**
 * GET /api/rbac/student-fields
 * Get all available student data fields from the database schema
 */
const getStudentFields = async (req, res) => {
    try {
        // Get column information from the students table
        const [columns] = await masterPool.query(`
      SELECT 
        COLUMN_NAME as fieldName,
        DATA_TYPE as dataType,
        COLUMN_TYPE as columnType,
        IS_NULLABLE as isNullable,
        COLUMN_KEY as columnKey,
        EXTRA as extra,
        COLUMN_COMMENT as comment
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'students'
      ORDER BY ORDINAL_POSITION
    `);

        // Categorize fields into logical groups
        const fieldCategories = {
            basic: {
                label: 'Basic Information',
                icon: 'User',
                color: 'blue',
                fields: []
            },
            contact: {
                label: 'Contact Details',
                icon: 'Phone',
                color: 'green',
                fields: []
            },
            academic: {
                label: 'Academic Information',
                icon: 'GraduationCap',
                color: 'purple',
                fields: []
            },
            parent: {
                label: 'Parent/Guardian Information',
                icon: 'Users',
                color: 'amber',
                fields: []
            },
            documents: {
                label: 'Documents & Status',
                icon: 'FileText',
                color: 'rose',
                fields: []
            },
            previous_education: {
                label: 'Previous Education',
                icon: 'BookOpen',
                color: 'indigo',
                fields: []
            },
            administrative: {
                label: 'Administrative',
                icon: 'Shield',
                color: 'slate',
                fields: []
            }
        };

        // Skip system fields
        const systemFields = ['id', 'created_at', 'updated_at', 'deleted_at'];

        // Categorize each field
        columns.forEach(col => {
            const fieldName = col.fieldName;

            // Skip system fields
            if (systemFields.includes(fieldName)) return;

            // Determine field category based on field name
            let category = 'administrative'; // default
            let label = fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            let inputType = 'text';

            // Determine input type from data type
            if (col.dataType.includes('int')) inputType = 'number';
            else if (col.dataType === 'date') inputType = 'date';
            else if (col.dataType === 'datetime' || col.dataType === 'timestamp') inputType = 'datetime-local';
            else if (col.columnType.startsWith('enum')) inputType = 'select';
            else if (col.dataType === 'text' || col.dataType === 'longtext') inputType = 'textarea';

            // Categorize based on field name patterns
            if (fieldName.match(/^(student_name|name|email|phone|mobile|gender|dob|date_of_birth|blood_group|aadhar|adhar)/i)) {
                category = 'basic';
            } else if (fieldName.match(/^(address|city|village|mandal|district|state|pincode|pin_code|emergency)/i)) {
                category = 'contact';
            } else if (fieldName.match(/^(admission|pin_no|pin_number|college|course|branch|year|semester|section|roll|batch|stud_type)/i)) {
                category = 'academic';
            } else if (fieldName.match(/^(father|mother|parent|guardian)/i)) {
                category = 'parent';
            } else if (fieldName.match(/^(tc|certificate|photo|document|file)/i)) {
                category = 'documents';
            } else if (fieldName.match(/^(ssc|inter|diploma|ug|pg|previous|qualification)/i)) {
                category = 'previous_education';
            } else if (fieldName.match(/^(status|registration|remarks|notes|hostel|transport|scholarship)/i)) {
                category = 'administrative';
            }

            fieldCategories[category].fields.push({
                key: fieldName,
                label: label,
                type: inputType,
                dataType: col.dataType,
                nullable: col.isNullable === 'YES'
            });
        });

        // Remove empty categories
        const nonEmptyCategories = Object.keys(fieldCategories)
            .filter(key => fieldCategories[key].fields.length > 0)
            .map(key => ({
                id: key,
                ...fieldCategories[key]
            }));

        res.json({
            success: true,
            data: {
                categories: nonEmptyCategories,
                totalFields: columns.filter(c => !systemFields.includes(c.fieldName)).length
            }
        });

    } catch (error) {
        console.error('Error fetching student fields:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch student fields',
            error: error.message
        });
    }
};

module.exports = {
    getStudentFields
};
