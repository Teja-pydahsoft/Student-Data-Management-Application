export const getCustodianTemplate = () => {
    // A4 Portrait dimensions: 595 x 842 points
    const pageWidth = 595;
    const center = (width) => (pageWidth - width) / 2;

    return [
        // --- Header (Same as Bonafide) ---
        // Logo
        {
            id: 'logo',
            type: 'image',
            content: 'logo',
            x: 480,
            y: 30,
            width: 80,
            height: 60
        },
        // College Name
        {
            id: 'college_name',
            type: 'text',
            content: '{{college_name}}',
            x: center(500),
            y: 40,
            fontSize: 22,
            font: 'Bold',
            align: 'center',
            width: 500,
            color: '#000000'
        },
        // Subtitle
        {
            id: 'header_sub1',
            type: 'text',
            content: '(Approved by AICTE and Affiliated to JNT University, Kakinada)',
            x: center(500),
            y: 68,
            fontSize: 10,
            font: 'Helvetica',
            align: 'center',
            width: 500,
            color: '#000000'
        },
        // Address
        {
            id: 'header_addr',
            type: 'text',
            content: 'Yanam Road, PATAVALA, KAKINADA-533461, E.G.Dt.',
            x: center(500),
            y: 82,
            fontSize: 10,
            font: 'Bold', // Bold address parts as per screenshot approximation
            align: 'center',
            width: 500,
            color: '#000000'
        },
        // Line Separator
        {
            id: 'header_line',
            type: 'line',
            x: 30,
            y: 110,
            width: 535,
            height: 0,
            color: '#000000',
            strokeWidth: 1.5
        },

        // --- Date ---
        {
            id: 'date_label',
            type: 'text',
            content: 'Date: {{date}}',
            x: 430,
            y: 140,
            fontSize: 11,
            font: 'Helvetica',
            align: 'right',
            width: 130,
            color: '#000000'
        },

        // --- Title ---
        {
            id: 'cert_title',
            type: 'text',
            content: 'TO WHOM SO EVER IT MAY CONCERN',
            x: center(350),
            y: 200,
            fontSize: 14,
            font: 'Bold',
            align: 'center',
            width: 350,
            color: '#000000'
        },
        // Underline for Title
        {
            id: 'title_underline',
            type: 'line',
            x: center(300),
            y: 215,
            width: 300,
            height: 0,
            color: '#000000',
            strokeWidth: 1
        },

        // --- Body ---
        // "This is to certify that Mr. [NAME] S/o [PARENT] bearing Roll No: [ROLL] is studying [COURSE] ([BRANCH]) in our College."
        {
            id: 'body_line1',
            type: 'text',
            content: 'This is to certify that Mr./Ms. {{student_name}} S/o, D/o {{parent_name}} bearing Roll No: {{admission_number}} is studying {{course}} ({{branch}}) in our College.',
            x: 60,
            y: 260,
            fontSize: 12,
            font: 'Helvetica', // Mixed bolding is hard in designer, stick to regular/variables
            align: 'justify',
            width: 475,
            color: '#000000'
        },

        // "The following Certificate is in our Custody."
        {
            id: 'custody_intro',
            type: 'text',
            content: 'The following Certificate is in our Custody.',
            x: center(400),
            y: 320,
            fontSize: 12,
            font: 'Helvetica',
            align: 'center',
            width: 400,
            color: '#000000'
        },

        // Custody List
        {
            id: 'custody_list',
            type: 'text',
            content: '{{custody_list}}',
            x: center(300),
            y: 350,
            fontSize: 12,
            font: 'Bold',
            align: 'left', // List aligned left but centered visually
            width: 300,
            color: '#000000'
        },

        // Purpose - Using "Reason" label as requested
        {
            id: 'purpose_line',
            type: 'text',
            content: 'Reason: {{purpose}}',
            x: 60,
            y: 450, // Spaced down
            fontSize: 12,
            font: 'Helvetica', // Bold label might be nice, but stick to simple
            align: 'left', // Align left for "Reason: ..."
            width: 475,
            color: '#000000'
        },

        // --- Footer ---
        {
            id: 'principal_label',
            type: 'text',
            content: 'Principal',
            x: 60,
            y: 650,
            fontSize: 12,
            font: 'Bold',
            align: 'left',
            width: 150,
            color: '#000000'
        },
        {
            id: 'principal_name',
            type: 'text',
            content: '(Dr.P.V.Surya Prakash)',
            x: 40,
            y: 670, // Below label
            fontSize: 12,
            font: 'Helvetica',
            align: 'left',
            width: 200,
            color: '#000000'
        }
    ];
};
